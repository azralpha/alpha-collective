import { describe, expect, it } from "vitest";

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

describe("GEMINI_API_KEY", () => {
  it.skipIf(!geminiApiKey)("authenticates a read-only Gemini models request", async () => {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": geminiApiKey! },
    });
    if (!response.ok) throw new Error(`Gemini models request failed with HTTP ${response.status}.`);
    const payload = await response.json() as { models?: Array<{ name?: string }> };
    expect(payload.models?.some(model => model.name?.startsWith("models/gemini-"))).toBe(true);
  }, 15_000);
});
