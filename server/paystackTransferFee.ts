export const PAYSTACK_TRANSFER_FEE_MARKUP_PERCENT = 20;

export type PaystackWithdrawalFeeQuote = {
  requestedAmount: number;
  basePaystackFee: number;
  processingFee: number;
  totalDebited: number;
};

/**
 * Published NGN transfer tiers: <= ₦5,000 costs ₦10; ₦5,001–₦50,000 costs ₦25;
 * above ₦50,000 costs ₦50. The platform applies the approved 20% markup to that fee.
 */
export function quotePaystackWithdrawalFee(requestedAmount: number): PaystackWithdrawalFeeQuote {
  if (!Number.isSafeInteger(requestedAmount) || requestedAmount < 1) throw new Error("Withdrawal amount must be a positive whole-Naira amount.");
  const basePaystackFee = requestedAmount <= 5_000 ? 10 : requestedAmount <= 50_000 ? 25 : 50;
  const processingFee = Math.ceil((basePaystackFee * (100 + PAYSTACK_TRANSFER_FEE_MARKUP_PERCENT)) / 100);
  return { requestedAmount, basePaystackFee, processingFee, totalDebited: requestedAmount + processingFee };
}

export function hasSufficientWithdrawalBalance(withdrawableBalance: number, quote: PaystackWithdrawalFeeQuote) {
  return Number.isSafeInteger(withdrawableBalance) && withdrawableBalance >= quote.totalDebited;
}
