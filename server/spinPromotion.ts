import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createSpinRewardClaim, getActiveSpinRewardClaimByVisitorHash, getSpinPromotionSettings, listSpinEligibleGiftCandidates } from "./db";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const MAX_CLAIM_MINUTES = 30;

export const spinClaimInputSchema = z.object({
  visitorId: z.string().trim().min(16).max(160).regex(/^[A-Za-z0-9_-]+$/, "Use a valid visitor identifier."),
});

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashSpinClaimToken(token: string) {
  return hashValue(token);
}

function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

function normaliseRewardName(value: string, fallback: string) {
  const text = value.replace(/[^A-Za-z0-9\s₦&!,-]/g, "").replace(/\s+/g, " ").trim();
  return text.length >= 3 && text.length <= 100 ? text : fallback;
}

type GiftCandidate = Awaited<ReturnType<typeof listSpinEligibleGiftCandidates>>[number];

function safeMinimumSpend(input: { rewardCost: number; averageGrossMargin: number; requiredMargin: number; requestedMinimum?: number }) {
  const marginBuffer = Math.max(0.04, input.averageGrossMargin - input.requiredMargin / 100);
  const floor = Math.max(12_000, Math.ceil(input.rewardCost / marginBuffer));
  const requested = Number.isFinite(input.requestedMinimum) ? Math.floor(input.requestedMinimum!) : floor;
  return Math.min(1_000_000, Math.max(floor, requested));
}

async function chooseGiftWithGemini(input: { candidates: GiftCandidate[]; requiredMargin: number; averageGrossMargin: number }) {
  const fallback = input.candidates[0];
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !fallback) return { candidate: fallback, rewardName: `Free ${fallback?.title ?? "gift"} unlocked`, requestedMinimum: undefined, requestedCountdown: undefined };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Choose one gift ID only from this supplied private eligible catalogue. The average eligible-catalogue gross margin is ${(input.averageGrossMargin * 100).toFixed(1)}%. Suggest a short, honest reward name and a reasonable minimum Nigerian Naira cart spend. The program will calculate the final threshold independently. This promotion must preserve at least ${input.requiredMargin}% net platform profit after the reward cost. Do not infer inventory, supplier, or product details beyond this list. Return JSON only: {"rewardItemId":number,"rewardName":string,"minSpendRequirement":number,"countdownMinutes":number}. Eligible gifts: ${input.candidates.map(item => `${item.id} | ${item.title} | retail ₦${item.price}`).join("; ")}` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 160, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) return { candidate: fallback, rewardName: `Free ${fallback.title} unlocked`, requestedMinimum: undefined, requestedCountdown: undefined };
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
    const parsed = z.object({ rewardItemId: z.number().int(), rewardName: z.string().max(120), minSpendRequirement: z.number().int().min(500), countdownMinutes: z.number().int().min(1).max(MAX_CLAIM_MINUTES) }).safeParse(JSON.parse(text));
    if (!parsed.success) return { candidate: fallback, rewardName: `Free ${fallback.title} unlocked`, requestedMinimum: undefined, requestedCountdown: undefined };
    const candidate = input.candidates.find(item => item.id === parsed.data.rewardItemId) ?? fallback;
    return { candidate, rewardName: normaliseRewardName(parsed.data.rewardName, `Free ${candidate.title} unlocked`), requestedMinimum: parsed.data.minSpendRequirement, requestedCountdown: parsed.data.countdownMinutes };
  } catch {
    return { candidate: fallback, rewardName: `Free ${fallback.title} unlocked`, requestedMinimum: undefined, requestedCountdown: undefined };
  }
}

function publicClaim(claim: NonNullable<Awaited<ReturnType<typeof getActiveSpinRewardClaimByVisitorHash>>>, token?: string) {
  return {
    enabled: true as const,
    claimed: true as const,
    ...(token ? { claimToken: token } : {}),
    rewardName: claim.rewardName,
    rewardItemId: `official-${claim.rewardOfficialProductId}`,
    minimumSpend: claim.minimumSpend,
    expiresAt: claim.expiresAt,
  };
}

export async function getPublicSpinPromotionSettings() {
  const settings = await getSpinPromotionSettings();
  return { enabled: settings.enabled };
}

export async function claimSpinReward(input: z.infer<typeof spinClaimInputSchema>) {
  const settings = await getSpinPromotionSettings();
  if (!settings.enabled) return { enabled: false as const, claimed: false as const, reason: "disabled" as const };
  const visitorHash = hashValue(input.visitorId);
  const existing = await getActiveSpinRewardClaimByVisitorHash(visitorHash);
  if (existing) return { ...publicClaim(existing), reused: true as const };
  const candidates = await listSpinEligibleGiftCandidates(settings.profitSafeguardMargin);
  if (!candidates.length) return { enabled: true as const, claimed: false as const, reason: "no_eligible_gift" as const };
  const averageGrossMargin = candidates.reduce((sum, candidate) => sum + candidate.grossMargin, 0) / candidates.length;
  const choice = await chooseGiftWithGemini({ candidates, requiredMargin: settings.profitSafeguardMargin, averageGrossMargin });
  const minimumSpend = safeMinimumSpend({ rewardCost: choice.candidate.rewardCost, averageGrossMargin, requiredMargin: settings.profitSafeguardMargin, requestedMinimum: choice.requestedMinimum });
  const countdownMinutes = Math.min(MAX_CLAIM_MINUTES, Math.max(5, choice.requestedCountdown ?? settings.countdownMinutes));
  const token = opaqueToken();
  const expiresAt = new Date(Date.now() + countdownMinutes * 60_000);
  const claim = await createSpinRewardClaim({ tokenHash: hashValue(token), visitorHash, rewardName: choice.rewardName, rewardOfficialProductId: choice.candidate.id, rewardCost: choice.candidate.rewardCost, minimumSpend, profitSafeguardMargin: settings.profitSafeguardMargin, expiresAt });
  if (!claim) throw new Error("Spin claim could not be saved.");
  return { ...publicClaim(claim, token), reused: false as const };
}
