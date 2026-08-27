export type StoredSpinClaim = {
  claimToken: string;
  rewardName: string;
  rewardItemId: string;
  minimumSpend: number;
  expiresAt: string;
};

const CLAIM_KEY = "alpha-market-spin-claim";
const VISITOR_KEY = "alpha-market-spin-visitor";
const DISMISS_KEY = "alpha-market-spin-dismissed";

export function getSpinVisitorId() {
  let value = window.localStorage.getItem(VISITOR_KEY);
  if (!value) {
    value = typeof crypto.randomUUID === "function" ? crypto.randomUUID().replaceAll("-", "") : `${Date.now()}${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_KEY, value);
  }
  return value;
}

export function getStoredSpinClaim(): StoredSpinClaim | null {
  try {
    const raw = window.localStorage.getItem(CLAIM_KEY);
    const claim = raw ? JSON.parse(raw) as StoredSpinClaim : null;
    if (!claim || typeof claim.claimToken !== "string" || typeof claim.minimumSpend !== "number" || new Date(claim.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(CLAIM_KEY);
      return null;
    }
    return claim;
  } catch {
    return null;
  }
}

export function saveSpinClaim(claim: StoredSpinClaim) {
  window.localStorage.setItem(CLAIM_KEY, JSON.stringify(claim));
  window.localStorage.removeItem(DISMISS_KEY);
}

export function clearSpinClaim() {
  window.localStorage.removeItem(CLAIM_KEY);
}

export function hasDismissedSpinPopup() {
  const value = Number(window.localStorage.getItem(DISMISS_KEY));
  return Number.isFinite(value) && Date.now() - value < 24 * 60 * 60 * 1000;
}

export function dismissSpinPopup() {
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
}
