import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupportOrderSummary: vi.fn(),
  searchPublishedSupportProducts: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { answerAlphaAiSupport, extractSupportOrderReference } from "./alphaAiSupport";

describe("Alpha AI Support", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    mocks.getSupportOrderSummary.mockResolvedValue(null);
    mocks.searchPublishedSupportProducts.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "I can help with that." }] } }] }) }));
  });

  it("extracts only Alpha Market order references and does not treat an email as an order lookup key", () => {
    expect(extractSupportOrderReference("Please track AC-ABC1234")).toBe("AC-ABC1234");
    expect(extractSupportOrderReference("Please track me@example.com")).toBeNull();
  });

  it("scopes order lookup to the authenticated user and redacts customer email before Gemini receives chat content", async () => {
    mocks.getSupportOrderSummary.mockResolvedValue({ reference: "AC-ABC1234", paymentStatus: "paid", fulfillmentStatus: "pending", createdAt: new Date("2026-08-26T10:00:00.000Z") });
    await answerAlphaAiSupport({ userId: 42, messages: [{ role: "user", content: "Track AC-ABC1234 for ada@example.com" }] });

    expect(mocks.getSupportOrderSummary).toHaveBeenCalledWith(42, "AC-ABC1234");
    const body = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(JSON.stringify(body)).not.toContain("ada@example.com");
    expect(JSON.stringify(body)).toContain("[email removed]");
  });

  it("uses only published catalogue results as product facts", async () => {
    mocks.searchPublishedSupportProducts.mockResolvedValue([{ title: "Smart Watch", price: 12500, url: "/product/official-6" }]);
    const result = await answerAlphaAiSupport({ messages: [{ role: "user", content: "Can you recommend a smartwatch?" }] });
    expect(mocks.searchPublishedSupportProducts).toHaveBeenCalledWith("Can you recommend a smartwatch?", 4);
    expect(result.recommendations).toEqual([{ title: "Smart Watch", price: 12500, url: "/product/official-6" }]);
    expect(mocks.getSupportOrderSummary).not.toHaveBeenCalled();
  });

  it("does not treat generic support wording as a product search term", async () => {
    await answerAlphaAiSupport({ messages: [{ role: "user", content: "Can you recommend a product?" }] });
    expect(mocks.searchPublishedSupportProducts).toHaveBeenCalledWith("Can you recommend a product?", 4);
  });
});
