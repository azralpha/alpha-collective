import { describe, expect, it } from "vitest";
import { isWithdrawalOtpEmailDeliveryConfigured } from "./withdrawalOtpEmail";

describe("withdrawal OTP email configuration", () => {
  it("does not report OTP email delivery as configured without an explicit production activation flag", () => {
    const beforeApiKey = process.env.RESEND_API_KEY;
    const beforeFrom = process.env.RESEND_FROM_EMAIL;
    const beforeEnabled = process.env.RESEND_OTP_EMAIL_ENABLED;
    process.env.RESEND_API_KEY = "configured-key";
    process.env.RESEND_FROM_EMAIL = "wallet@example.com";
    delete process.env.RESEND_OTP_EMAIL_ENABLED;
    expect(isWithdrawalOtpEmailDeliveryConfigured()).toBe(false);
    process.env.RESEND_OTP_EMAIL_ENABLED = "true";
    expect(isWithdrawalOtpEmailDeliveryConfigured()).toBe(true);
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    if (beforeApiKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = beforeApiKey;
    if (beforeFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = beforeFrom;
    if (beforeEnabled === undefined) delete process.env.RESEND_OTP_EMAIL_ENABLED; else process.env.RESEND_OTP_EMAIL_ENABLED = beforeEnabled;
  });
});
