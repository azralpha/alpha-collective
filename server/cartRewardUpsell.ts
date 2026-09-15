import { z } from "zod";
import { getCartTierProgress, listPublishedTierUpsellCandidates } from "./db";
import { isWithinTierUpsellRange } from "./cartTierRewards";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

export const cartRewardUpsellInputSchema = z.object({
  items: z.array(z.object({ productId: z.string().trim().min(1).max(120), quantity: z.number().int().min(1).max(10) })).min(1).max(12),
});

type Candidate = Awaited<ReturnType<typeof listPublishedTierUpsellCandidates>>[number];

async function chooseUpsellsWithGemini(input: { amountRemaining: number; target: number; candidates: Candidate[] }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !input.candidates.length) return input.candidates.slice(0, 2);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Choose exactly two product IDs from the supplied published catalogue that best help a shopper bridge a remaining ₦${input.amountRemaining.toLocaleString("en-NG")} toward a ₦${input.target.toLocaleString("en-NG")} cart reward target. Prefer low-cost relevant prices near the gap. Return JSON only: {"productIds":["id","id"]}. Catalogue: ${input.candidates.map(item => `${item.id} | ${item.title} | ₦${item.price}`).join("; ")}` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 120, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) return input.candidates.slice(0, 2);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
  const parsed = z.object({ productIds: z.array(z.string()).min(1).max(2) }).safeParse(JSON.parse(text));
  if (!parsed.success) return input.candidates.slice(0, 2);
  const allowed = new Map(input.candidates.map(candidate => [candidate.id, candidate]));
  const selected = Array.from(new Set(parsed.data.productIds)).flatMap(id => allowed.get(id) ? [allowed.get(id)!] : []);
  return selected.length ? selected.slice(0, 2) : input.candidates.slice(0, 2);
}

export async function getCartRewardUpsells(input: z.infer<typeof cartRewardUpsellInputSchema>) {
  const progress = await getCartTierProgress(input.items);
  if (!isWithinTierUpsellRange(progress) || !progress.nextTier) return { eligible: false as const, recommendations: [], amountRemaining: progress.amountRemaining, nextTier: null };
  const candidates = await listPublishedTierUpsellCandidates({ amountRemaining: progress.amountRemaining, excludeProductIds: input.items.map(item => item.productId) });
  const recommendations = await chooseUpsellsWithGemini({ amountRemaining: progress.amountRemaining, target: progress.nextTier.minimumSpend, candidates });
  return {
    eligible: true as const,
    amountRemaining: progress.amountRemaining,
    nextTier: { name: progress.nextTier.name, minimumSpend: progress.nextTier.minimumSpend },
    recommendations: recommendations.map(item => ({ productId: item.id, title: item.title, price: item.price, imageUrl: item.imageUrl, category: item.category })),
  };
}
