import { describe, expect, it } from "vitest";
import { isWithdrawalOtpEmailDeliveryConfigured } from "./withdrawalOtpEmail";

describe("Resend production activation", () => {
  it("keeps withdrawal email delivery disabled until a separately validated provider is explicitly activated", () => {
    expect(isWithdrawalOtpEmailDeliveryConfigured()).toBe(false);
  });
});
