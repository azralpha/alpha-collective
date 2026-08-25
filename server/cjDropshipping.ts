const CJ_API_ROOT = "https://developers.cjdropshipping.com/api2.0/v1";

type CjTokenResponse = { code?: number; result?: boolean; message?: string; data?: { accessToken?: string; accessTokenExpiryDate?: string; openId?: number } };
type CjOrderResponse = { code?: number; result?: boolean; success?: boolean; message?: string; requestId?: string; data?: { orderId?: string; orderNumber?: string } };
type CjProductListResponse = { code?: number; result?: boolean; message?: string; data?: { content?: Array<{ productList?: Array<{ sku?: string; spu?: string; nameEn?: string; productNameEn?: string; bigImage?: string; productImage?: string; description?: string; sellPrice?: string | number; nowPrice?: string | number; discountPrice?: string | number }> }> } };

export class CjDropshippingError extends Error {
  constructor(message: string, readonly statusCode?: number, readonly retryable = false) { super(message); }
}

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

function apiKey() {
  const value = process.env.CJ_DROPSHIPPING_API_KEY?.trim();
  if (!value) throw new CjDropshippingError("CJ Dropshipping is not configured.");
  return value;
}

async function cjFetch<T>(path: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${CJ_API_ROOT}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new CjDropshippingError("CJ Dropshipping did not respond in time.", 503, true);
  }
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok) throw new CjDropshippingError("CJ Dropshipping rejected the request.", response.status, response.status >= 500 || response.status === 429);
  return payload;
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
  const payload = await cjFetch<CjTokenResponse>("/authentication/getAccessToken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apiKey() }) });
  if (!payload?.result || !payload.data?.accessToken) throw new CjDropshippingError(payload?.message || "CJ Dropshipping could not issue an access token.", 400, false);
  const parsedExpiry = payload.data.accessTokenExpiryDate ? Date.parse(payload.data.accessTokenExpiryDate) : NaN;
  tokenCache = { accessToken: payload.data.accessToken, expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 14 * 24 * 60 * 60 * 1000 };
  return tokenCache.accessToken;
}

export function isCjDropshippingConfigured() {
  return Boolean(process.env.CJ_DROPSHIPPING_API_KEY?.trim());
}

/** Validates the configured CJ credential by requesting an access token only. No product, customer, or order data is sent. */
export async function validateCjDropshippingCredential() {
  await accessToken();
  return true;
}

function uniqueImageUrls(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && /^https:\/\//.test(value))))).slice(0, 5);
}

function imageUrlsFromDescription(description: string | undefined) {
  if (!description) return [];
  return Array.from(description.matchAll(/<img[^>]+src=["'](https:\/\/[^"']+)["']/gi)).map(match => match[1]);
}

function plainDescription(value: string | undefined, fallback: string) {
  const text = (value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  return text.length >= 12 ? text.slice(0, 1200) : `${fallback}. Imported from CJ Dropshipping; review the product details before publishing.`;
}

/** Fetches CJ catalogue data only. It never creates an order or sends customer information. */
export async function fetchCjProductForImport(sku: string) {
  const token = await accessToken();
  const normalizedSku = sku.trim().toUpperCase();
  const payload = await cjFetch<CjProductListResponse>(`/product/listV2?page=1&size=20&keyWord=${encodeURIComponent(normalizedSku)}&features=enable_description`, {
    method: "GET",
    headers: { "CJ-Access-Token": token },
  });
  if (!payload) throw new CjDropshippingError("CJ Dropshipping returned an empty product response.", 502, true);
  const candidates = payload.data?.content?.flatMap(section => section.productList ?? []) ?? [];
  const product = candidates.find(candidate => (candidate.sku ?? candidate.spu ?? "").toUpperCase() === normalizedSku);
  if (!payload.result || !product) throw new CjDropshippingError("CJ could not find that product SKU.", 404, false);
  const title = (product.nameEn ?? product.productNameEn ?? "").trim();
  if (!title) throw new CjDropshippingError("CJ returned a product without a usable English title.", 422, false);
  const supplierCost = Number(product.nowPrice ?? product.discountPrice ?? product.sellPrice);
  if (!Number.isFinite(supplierCost) || supplierCost < 0) throw new CjDropshippingError("CJ returned an invalid supplier price.", 422, false);
  const imageUrls = uniqueImageUrls([product.bigImage, product.productImage, ...imageUrlsFromDescription(product.description)]);
  if (!imageUrls.length) throw new CjDropshippingError("CJ returned no importable product images.", 422, false);
  return { sku: normalizedSku, title, description: plainDescription(product.description, title), imageUrls, supplierCost: Number(supplierCost.toFixed(2)), supplierCurrency: "USD" as const };
}

export type CjCreateOrderInput = {
  orderNumber: string;
  externalSkuId: string;
  quantity: number;
  buyerName: string;
  buyerPhone: string;
  state: string;
  lga: string;
  streetDetails: string;
  logisticsName: string;
  fromCountryCode: string;
  orderMode: "create_only" | "balance_payment";
};

export async function createCjOrder(input: CjCreateOrderInput) {
  const token = await accessToken();
  const payload = await cjFetch<CjOrderResponse>("/shopping/order/createOrderV3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
    body: JSON.stringify({
      orderNumber: input.orderNumber,
      shippingCountry: "Nigeria",
      shippingCountryCode: "NG",
      shippingProvince: input.state,
      shippingCity: input.lga,
      shippingPhone: input.buyerPhone,
      shippingCustomerName: input.buyerName,
      shippingAddress: input.streetDetails,
      logisticName: input.logisticsName,
      fromCountryCode: input.fromCountryCode,
      platform: "Api",
      orderFlow: 1,
      payType: input.orderMode === "balance_payment" ? 2 : 3,
      products: [{ sku: input.externalSkuId, quantity: input.quantity, storeLineItemId: `${input.orderNumber}-${input.externalSkuId}` }],
    }),
  });
  if (!payload?.result || (payload.code && payload.code !== 200)) throw new CjDropshippingError(payload?.message || "CJ Dropshipping could not create this supplier order.", 400, false);
  return { orderId: payload.data?.orderId ?? null, requestId: payload.requestId ?? null };
}
