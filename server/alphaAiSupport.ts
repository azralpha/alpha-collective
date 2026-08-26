import { z } from "zod";
import { getSupportOrderSummary, searchPublishedSupportProducts } from "./db";
import { sanitizePlainText } from "./securityText";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

export const supportMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(600).transform(sanitizePlainText),
});

export const alphaAiSupportInputSchema = z.object({
  messages: z.array(supportMessageSchema).min(1).max(12),
});

type SupportMessage = z.infer<typeof supportMessageSchema>;

const orderReferencePattern = /\bAC-[A-Z0-9]{6,32}\b/i;

function redactSensitiveText(text: string) {
  return sanitizePlainText(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/\b\d{10,19}\b/g, "[number removed]");
}

export function extractSupportOrderReference(text: string) {
  return text.match(orderReferencePattern)?.[0]?.toUpperCase() ?? null;
}

function wantsRecommendations(text: string) {
  return /\b(recommend|recommendation|find|looking for|show me|product|buy|need|want)\b/i.test(text);
}

function createSystemPrompt(input: { order: Awaited<ReturnType<typeof getSupportOrderSummary>> | null; products: Awaited<ReturnType<typeof searchPublishedSupportProducts>> }) {
  const orderFact = input.order
    ? `Authenticated order fact: reference ${input.order.reference}; payment status ${input.order.paymentStatus}; fulfilment status ${input.order.fulfillmentStatus}; created ${input.order.createdAt.toISOString()}.`
    : "No authenticated order fact is available. Never claim to have found an order unless a tool fact is provided.";
  const productFact = input.products.length
    ? `Published catalogue matches: ${input.products.map(item => `${item.title} | ₦${item.price.toLocaleString("en-NG")} | ${item.url}`).join("; ")}.`
    : "No published catalogue matches were supplied.";
  return [
    "You are Alpha AI, the official 24/7 virtual assistant for Alpha Market in Nigeria.",
    "Be helpful, concise, polite, and use plain text. Answer only from the conversation and supplied facts. Do not invent stock, delivery dates, discounts, orders, payments, seller information, supplier details, or policy terms. Never end a response with a colon or an unfinished list introduction.",
    "Payment facts: Paystack and Flutterwave are available for online Naira checkout. Alpha Wallet is available to KYC-verified users. NOWPayments Crypto is a controlled administrator test path, not a general buyer checkout method. State that payment completion is provider-verified. Explain that local-vendor funds are protected in escrow while the order is fulfilled and buyers can confirm delivery; do not promise a release date.",
    "Never ask for or process card details, wallet PINs, passwords, bank account numbers, government IDs, payment addresses, or customer emails. Order lookup is available only for the signed-in customer and an Alpha Market order reference; email-only lookup is not available.",
    "If a customer provides an order reference without an authenticated order fact, ask them to sign in. Do not mention email lookup unless they explicitly ask to use an email address.",
    orderFact,
    productFact,
  ].join("\n");
}

function normalizeGeminiReply(value: unknown) {
  if (typeof value !== "string") throw new Error("Gemini did not return a support response.");
  const reply = sanitizePlainText(value).slice(0, 1800);
  if (!reply) throw new Error("Gemini did not return a usable support response.");
  return reply;
}

async function callGeminiSupport(input: { messages: SupportMessage[]; systemPrompt: string }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Alpha AI Support is not configured.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: input.messages.map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: redactSensitiveText(message.content) }] })),
      generationConfig: { temperature: 0.25, maxOutputTokens: 450 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini support request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return normalizeGeminiReply(payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join(""));
}

export async function answerAlphaAiSupport(input: { userId?: number; messages: SupportMessage[] }) {
  const latestUserMessage = [...input.messages].reverse().find(message => message.role === "user")?.content ?? "";
  const reference = extractSupportOrderReference(latestUserMessage);
  const order = input.userId && reference ? await getSupportOrderSummary(input.userId, reference) : null;
  const products = wantsRecommendations(latestUserMessage) ? await searchPublishedSupportProducts(latestUserMessage, 4) : [];
  const recommendations = products.map(product => ({ title: product.title, price: product.price, url: product.url }));
  const reply = await callGeminiSupport({ messages: input.messages, systemPrompt: createSystemPrompt({ order, products }) });
  return { reply, recommendations, orderLookup: reference ? (order ? "found" : input.userId ? "not_found" : "sign_in_required") : "not_requested" as const };
}
