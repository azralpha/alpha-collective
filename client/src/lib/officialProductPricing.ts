export function hasManualRetailPrice(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return false;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount >= 500 && amount <= 5_000_000;
}
