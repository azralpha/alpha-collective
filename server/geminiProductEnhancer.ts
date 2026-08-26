import { z } from "zod";
import { sanitizePlainText } from "./securityText";

const GEMINI_MODEL = "gemini-2.5-flash";

const generatedProductEnhancementSchema = z.object({
  cleanTitle: z.string().trim().min(2).max(180),
  seoDescription: z.string().trim().min(40).max(600),
  metaDescription: z.string().trim().min(50).max(150),
  suggestedTags: z.array(z.string().trim().min(2).max(40)).length(5),
});

export type GeminiProductEnhancement = z.infer<typeof generatedProductEnhancementSchema>;

export type GeminiProductEnhancementInput = {
  title: string;
  description: string;
  specifications?: string | null;
};

const responseSchema = {
  type: "object",
  properties: {
    cleanTitle: { type: "string" },
    seoDescription: { type: "string" },
    metaDescription: { type: "string" },
    suggestedTags: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
  },
  required: ["cleanTitle", "seoDescription", "metaDescription", "suggestedTags"],
};

function normalizeEnhancement(value: unknown): GeminiProductEnhancement {
  const parsed = generatedProductEnhancementSchema.parse(value);
  const suggestedTags = Array.from(new Set(parsed.suggestedTags.map(tag => sanitizePlainText(tag).toLowerCase()).filter(Boolean)));
  const normalized = {
    cleanTitle: sanitizePlainText(parsed.cleanTitle),
    seoDescription: sanitizePlainText(parsed.seoDescription),
    metaDescription: sanitizePlainText(parsed.metaDescription),
    suggestedTags,
  };
  if (suggestedTags.length !== 5) throw new Error("Gemini must return exactly five distinct suggested tags.");
  return generatedProductEnhancementSchema.parse(normalized);
}

export function parseGeminiProductEnhancement(responseText: string): GeminiProductEnhancement {
  return normalizeEnhancement(JSON.parse(responseText));
}

function enhancementPrompt(input: GeminiProductEnhancementInput) {
  return [
    "You are an Alpha Market product-copy editor for a Nigerian marketplace.",
    "Return only the required JSON object. Do not invent technical specifications, safety claims, warranties, brands, stock levels, delivery promises, discounts, or supplier information.",
    "Write accurate, concise, customer-friendly English based only on the supplied product content.",
    "The seoDescription must be exactly two short sentences. The metaDescription must be at most 150 characters. suggestedTags must contain exactly five distinct, lowercase search keywords.",
    `Raw title: ${input.title}`,
    `Raw description: ${input.description}`,
    `Specifications: ${input.specifications?.trim() || "Not supplied"}`,
  ].join("\n");
}

export async function generateGeminiProductEnhancement(input: GeminiProductEnhancementInput): Promise<GeminiProductEnhancement> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Gemini product enhancement is not configured.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: enhancementPrompt(input) }] }],
      generationConfig: { temperature: 0.25, responseMimeType: "application/json", responseSchema },
    }),
  });
  if (!response.ok) throw new Error(`Gemini product enhancement request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const responseText = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("").trim();
  if (!responseText) throw new Error("Gemini did not return product enhancement content.");
  return parseGeminiProductEnhancement(responseText);
}

/** Imports must remain draft-safe even when an enhancement request is unavailable. */
export async function tryGenerateGeminiProductEnhancement(input: GeminiProductEnhancementInput): Promise<GeminiProductEnhancement | null> {
  try {
    return await generateGeminiProductEnhancement(input);
  } catch (error) {
    console.warn("[Gemini] Product enhancement skipped:", error instanceof Error ? error.message : error);
    return null;
  }
}
