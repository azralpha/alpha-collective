import { formatNaira } from "@shared/marketplace";

export const WALLET_BALANCE_PRIVACY_KEY = "alpha-collective-hide-wallet-balances";

export function displayWalletAmount(amount: number, hidden: boolean) {
  return hidden ? "••••••" : formatNaira(amount);
}
