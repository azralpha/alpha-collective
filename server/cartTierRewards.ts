export const CART_REWARD_TYPES = ["alpha_wallet_credit", "free_shipping", "catalog_gift"] as const;
export type CartRewardType = (typeof CART_REWARD_TYPES)[number];

export type CartRewardTier = {
  id: number;
  name: string;
  minimumSpend: number;
  rewardType: CartRewardType;
  rewardValue: number;
  giftOfficialProductId: number | null;
  profitSafeguardMargin: number;
  active: boolean;
};

export type CartProfitFact = {
  productId: string;
  revenue: number;
  platformProfit: number | null;
};

export type CartTierProgress = {
  subtotal: number;
  nextTier: CartRewardTier | null;
  unlockedTier: CartRewardTier | null;
  amountRemaining: number;
  progressPercent: number;
  profitAmount: number;
  profitMarginPercent: number;
  profitSafeguardPassed: boolean;
  hasUnknownProfit: boolean;
};

function orderActiveTiers(tiers: CartRewardTier[]) {
  return tiers.filter(tier => tier.active).sort((left, right) => left.minimumSpend - right.minimumSpend || left.id - right.id);
}

export function calculateCartTierProgress(input: { subtotal: number; tiers: CartRewardTier[]; profitFacts: CartProfitFact[] }): CartTierProgress {
  const subtotal = Math.max(0, Math.floor(input.subtotal));
  const tiers = orderActiveTiers(input.tiers);
  const reached = tiers.filter(tier => subtotal >= tier.minimumSpend);
  const candidate = reached.at(-1) ?? null;
  const nextTier = tiers.find(tier => tier.minimumSpend > subtotal) ?? null;
  const hasUnknownProfit = input.profitFacts.some(fact => fact.platformProfit === null);
  const profitAmount = input.profitFacts.reduce((total, fact) => total + Math.max(0, fact.platformProfit ?? 0), 0);
  const profitMarginPercent = subtotal > 0 ? Math.floor((profitAmount / subtotal) * 10_000) / 100 : 0;
  const requiredMargin = candidate?.profitSafeguardMargin ?? Number.POSITIVE_INFINITY;
  const profitSafeguardPassed = candidate !== null && !hasUnknownProfit && profitMarginPercent >= requiredMargin;
  const unlockedTier = profitSafeguardPassed ? candidate : null;
  const amountRemaining = nextTier ? Math.max(0, nextTier.minimumSpend - subtotal) : 0;
  const progressPercent = nextTier
    ? Math.min(100, Math.max(0, Math.round((subtotal / Math.max(nextTier.minimumSpend, 1)) * 100)))
    : tiers.length && candidate ? 100 : 0;
  return { subtotal, nextTier, unlockedTier, amountRemaining, progressPercent, profitAmount, profitMarginPercent, profitSafeguardPassed, hasUnknownProfit };
}

export function isWithinTierUpsellRange(progress: CartTierProgress) {
  return Boolean(progress.nextTier && progress.subtotal >= Math.ceil(progress.nextTier.minimumSpend * 0.75) && progress.amountRemaining > 0);
}

export function rewardLabel(tier: Pick<CartRewardTier, "name" | "rewardType" | "rewardValue">) {
  if (tier.rewardType === "alpha_wallet_credit") return `₦${tier.rewardValue.toLocaleString("en-NG")} Shopping Bonus`;
  if (tier.rewardType === "free_shipping") return "Free delivery voucher";
  return "Complimentary catalogue gift";
}
