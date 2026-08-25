import { randomInt, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const OTP_PATTERN = /^\d{6}$/;

export function generateWithdrawalOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function hashWithdrawalOtp(otp: string) {
  if (!OTP_PATTERN.test(otp)) throw new Error("Withdrawal OTP must be a six-digit code.");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(otp, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyWithdrawalOtp(otp: string, encoded: string) {
  if (!OTP_PATTERN.test(otp)) return false;
  const [algorithm, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const derived = await scrypt(otp, salt, 64) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
