import { describe, expect, it } from "vitest";

describe("NOWPayments production configuration", () => {
  it("requires the explicit production flag and official API base URL", () => {
    expect(process.env.NOWPAYMENTS_TEST_MODE).toBe("false");
    expect(process.env.NOWPAYMENTS_API_BASE_URL).toBe("https://api.nowpayments.io/v1");
  });
});
