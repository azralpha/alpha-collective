const CJ_API_ROOT = "https://developers.cjdropshipping.com/api2.0/v1";

type CjTokenResponse = { code?: number; result?: boolean; message?: string; data?: { accessToken?: string; accessTokenExpiryDate?: string; openId?: number } };
type CjOrderResponse = { code?: number; result?: boolean; success?: boolean; message?: string; requestId?: string; data?: { orderId?: string; orderNumber?: string } };
type CjProductListResponse = { code?: number; result?: boolean; message?: string; data?: { content?: Array<{ productList?: Array<{ id?: string; sku?: string; spu?: string; nameEn?: string; productNameEn?: string; bigImage?: string; productImage?: string; description?: string; sellPrice?: string | number; nowPrice?: string | number; discountPrice?: string | number }> }> } };
type CjProductFallbackResponse = { code?: number; result?: boolean; message?: string; data?: { list?: Array<{ pid?: string; productSku?: string; productNameEn?: string; productImage?: string; sellPrice?: string | number }> } };

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

function isMatchingCjIdentifier(candidate: { id?: string; sku?: string; spu?: string }, normalizedIdentifier: string) {
  return [candidate.sku, candidate.spu, candidate.id].some(value => value?.trim().toUpperCase() === normalizedIdentifier);
}

function isMatchingCjParentSpu(candidate: { sku?: string; spu?: string }, normalizedIdentifier: string) {
  return [candidate.sku, candidate.spu].some(value => {
    const baseIdentifier = value?.trim().toUpperCase() ?? "";
    return baseIdentifier.length >= 8 && normalizedIdentifier.length > baseIdentifier.length && normalizedIdentifier.startsWith(baseIdentifier);
  });
}

function parseCjSupplierCost(...values: Array<string | number | undefined>) {
  for (const value of values) {
    if (typeof value === "number") {
      if (Number.isFinite(value) && value >= 0) return Number(value.toFixed(2));
      continue;
    }
    const normalized = value?.trim();
    if (!normalized || /^(?:null|n\/?a|unavailable|--+)$/i.test(normalized)) continue;
    const matches = normalized.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
    if (matches.length !== 1) continue;
    const parsed = Number(matches[0].replace(/,/g, ""));
    if (Number.isFinite(parsed) && parsed >= 0) return Number(parsed.toFixed(2));
  }
  return null;
}

function importableCjProduct(product: { sku?: string; spu?: string; nameEn?: string; productNameEn?: string; bigImage?: string; productImage?: string; description?: string; sellPrice?: string | number; nowPrice?: string | number; discountPrice?: string | number }, fallbackIdentifier: string) {
  const title = (product.nameEn ?? product.productNameEn ?? "").trim();
  if (!title) throw new CjDropshippingError("CJ returned a product without a usable English title.", 422, false);
  const supplierCost = parseCjSupplierCost(product.nowPrice, product.discountPrice, product.sellPrice);
  const imageUrls = uniqueImageUrls([product.bigImage, product.productImage, ...imageUrlsFromDescription(product.description)]);
  if (!imageUrls.length) throw new CjDropshippingError("CJ returned no importable product images.", 422, false);
  return { sku: (product.sku ?? product.spu ?? fallbackIdentifier).trim().toUpperCase(), title, description: plainDescription(product.description, title), imageUrls, supplierCost, supplierCostAvailable: supplierCost !== null, supplierCurrency: "USD" as const };
}

/** Fetches CJ catalogue data only. It never creates an order or sends customer information. */
export async function fetchCjProductForImport(sku: string) {
  const token = await accessToken();
  const normalizedSku = sku.trim().toUpperCase();
  const payload = await cjFetch<CjProductListResponse>(`/product/listV2?page=1&size=100&keyWord=${encodeURIComponent(normalizedSku)}&features=enable_description`, {
    method: "GET",
    headers: { "CJ-Access-Token": token },
  });
  if (!payload) throw new CjDropshippingError("CJ Dropshipping returned an empty product response.", 502, true);
  const candidates = payload.data?.content?.flatMap(section => section.productList ?? []) ?? [];
  const exactProduct = candidates.find(candidate => isMatchingCjIdentifier(candidate, normalizedSku));
  if (payload.result && exactProduct) return { ...importableCjProduct(exactProduct, normalizedSku), matchType: "exact" as const };
  const parentMatches = payload.result ? candidates.filter(candidate => isMatchingCjParentSpu(candidate, normalizedSku)) : [];
  if (parentMatches.length === 1) return { ...importableCjProduct(parentMatches[0], normalizedSku), matchType: "parent_spu" as const };

  const fallback = await cjFetch<CjProductFallbackResponse>(`/product/list?pageNum=1&pageSize=20&productSku=${encodeURIComponent(normalizedSku)}`, {
    method: "GET",
    headers: { "CJ-Access-Token": token },
  });
  if (!fallback) throw new CjDropshippingError("CJ returned an empty fallback product response.", 502, true);
  const fallbackProduct = fallback.data?.list?.find(candidate => [candidate.productSku, candidate.pid].some(value => value?.trim().toUpperCase() === normalizedSku));
  if (!fallback.result || !fallbackProduct) throw new CjDropshippingError("CJ did not return an exact match for this product identifier. Confirm the CJ Product ID or SPU and that the listing is active.", 404, false);
  return { ...importableCjProduct({ sku: fallbackProduct.productSku, nameEn: fallbackProduct.productNameEn, productImage: fallbackProduct.productImage, sellPrice: fallbackProduct.sellPrice }, normalizedSku), matchType: "exact" as const };
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
