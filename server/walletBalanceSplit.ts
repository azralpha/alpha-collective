export function splitWalletPayment(total: number, bonusBalance: number) {
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Wallet payment total must be a positive whole-Naira amount.");
  if (!Number.isSafeInteger(bonusBalance) || bonusBalance < 0) throw new Error("Shopping Bonus balance must be a non-negative whole-Naira amount.");
  const bonusDebit = Math.min(total, bonusBalance);
  return { bonusDebit, withdrawableDebit: total - bonusDebit };
}
