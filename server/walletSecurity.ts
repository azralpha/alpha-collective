import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const PIN_PATTERN = /^\d{4}$/;

export function validateTransactionPin(pin: string) {
  if (!PIN_PATTERN.test(pin)) throw new Error("Your transaction PIN must be exactly four digits.");
}

export async function hashTransactionPin(pin: string) {
  validateTransactionPin(pin);
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(pin, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyTransactionPin(pin: string, storedHash: string | null) {
  if (!storedHash || !PIN_PATTERN.test(pin)) return false;
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(pin, salt, 64) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
