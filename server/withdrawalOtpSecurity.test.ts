import { describe, expect, it } from "vitest";
import { generateWithdrawalOtp, hashWithdrawalOtp, verifyWithdrawalOtp } from "./withdrawalOtpSecurity";

describe("withdrawal OTP security", () => {
  it("generates a six-digit OTP without exposing its persisted representation", async () => {
    const otp = generateWithdrawalOtp();
    const stored = await hashWithdrawalOtp(otp);
    expect(otp).toMatch(/^\d{6}$/);
    expect(stored).toMatch(/^scrypt\$/);
    expect(stored).not.toContain(otp);
  });

  it("accepts only the original six-digit OTP", async () => {
    const stored = await hashWithdrawalOtp("031245");
    await expect(verifyWithdrawalOtp("031245", stored)).resolves.toBe(true);
    await expect(verifyWithdrawalOtp("031246", stored)).resolves.toBe(false);
    await expect(verifyWithdrawalOtp("31245", stored)).resolves.toBe(false);
  });
});
