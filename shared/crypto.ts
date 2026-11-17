export const SUPPORTED_CRYPTO_ASSETS = [
  { ticker: "usdttrx", label: "USDT (TRX)" },
  { ticker: "usdttrc20", label: "USDT (TRC20)" },
] as const;

export const SUPPORTED_CRYPTO_TICKERS = SUPPORTED_CRYPTO_ASSETS.map(asset => asset.ticker) as [string, ...string[]];

export type SupportedCryptoTicker = typeof SUPPORTED_CRYPTO_ASSETS[number]["ticker"];

export function isSupportedCryptoTicker(value: string): value is SupportedCryptoTicker {
  return SUPPORTED_CRYPTO_TICKERS.includes(value);
}
