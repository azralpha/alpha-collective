const CJ_API_ROOT = "https://developers.cjdropshipping.com/api2.0/v1";

type CjTokenResponse = { code?: number; result?: boolean; message?: string; data?: { accessToken?: string; accessTokenExpiryDate?: string; openId?: number } };
type CjOrderResponse = { code?: number; result?: boolean; success?: boolean; message?: string; requestId?: string; data?: { orderId?: string; orderNumber?: string } };
type CjProductListResponse = { code?: number; result?: boolean; message?: string; data?: { content?: Array<{ productList?: Array<{ id?: string; sku?: string; spu?: string; nameEn?: string; productNameEn?: string; bigImage?: string; productImage?: string; description?: string; sellPrice?: string | number; nowPrice?: string | number; discountPrice?: string | number }> }> } };
type CjProductFallbackResponse = { code?: number; result?: boolean; message?: string; data?: { list?: Array<{ pid?: string; productSku?: string; productNameEn?: string; productImage?: string; sellPrice?: string | number }> } };
type CjProductVariant = { vid?: string; variantSku?: string; variantSellPrice?: string | number; inventoryNum?: number | string; inventories?: Array<{ countryCode?: string; totalInventory?: number | string; cjInventory?: number | string; factoryInventory?: number | string }> };
type CjProductQueryResponse = { code?: number; result?: boolean; message?: string; data?: { pid?: string; productSku?: string; sellPrice?: string | number; variants?: CjProductVariant[] } };
type CjFreightResponse = { code?: number; result?: boolean; message?: string; data?: Array<{ logisticPrice?: string | number; totalPostageFee?: string | number }> };

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

function parseCjInventory(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Math.max(0, Number(value));
  return null;
}

type CjAvailableVariant = {
  vid: string;
  variantSku: string;
  inventoryCountryCode: string;
  inventoryQuantity: number | null;
  inventoryKnown: boolean;
  variantSellPrice?: string | number;
};

function firstReportedInventory(...values: Array<string | number | undefined>) {
  for (const value of values) {
    const quantity = parseCjInventory(value);
    if (quantity !== null) return quantity;
  }
  return null;
}

/**
 * CJ product/query sometimes returns variant rows before its warehouse stock blocks
 * are populated. Missing inventory is therefore unknown, not proof of zero stock.
 * A confirmed zero remains unavailable; an unknown variant can be drafted, but starts
 * with public stock zero and a stale snapshot until a later inventory refresh succeeds.
 */
function selectCjAvailableVariant(variants: CjProductVariant[] | undefined, preferredVariantId?: string | null, preferredVariantSku?: string | null) {
  const candidates: CjAvailableVariant[] = [];
  for (const variant of variants ?? []) {
    if (!variant.vid || !variant.variantSku) continue;
    const inventoryRows = variant.inventories ?? [];
    const usableRows = inventoryRows.map(inventory => ({
      country: inventory.countryCode?.trim().toUpperCase() || "CN",
      quantity: firstReportedInventory(inventory.totalInventory, inventory.cjInventory, inventory.factoryInventory),
    })).filter((inventory): inventory is { country: string; quantity: number } => inventory.quantity !== null);
    if (usableRows.length) {
      for (const inventory of usableRows) candidates.push({ vid: variant.vid, variantSku: variant.variantSku.trim().toUpperCase(), inventoryCountryCode: inventory.country, inventoryQuantity: inventory.quantity, inventoryKnown: true, variantSellPrice: variant.variantSellPrice });
    } else {
      const aggregateQuantity = parseCjInventory(variant.inventoryNum);
      candidates.push({ vid: variant.vid, variantSku: variant.variantSku.trim().toUpperCase(), inventoryCountryCode: "CN", inventoryQuantity: aggregateQuantity, inventoryKnown: aggregateQuantity !== null, variantSellPrice: variant.variantSellPrice });
    }
  }
  const chooseFrom = (pool: CjAvailableVariant[]) => {
    const available = pool.filter(candidate => candidate.inventoryQuantity !== null && candidate.inventoryQuantity > 0).sort((left, right) => (right.inventoryQuantity ?? 0) - (left.inventoryQuantity ?? 0))[0];
    if (available) return available;
    const unknown = pool.find(candidate => !candidate.inventoryKnown);
    return unknown ?? null;
  };
  const normalizedPreferredSku = preferredVariantSku?.trim().toUpperCase();
  if (normalizedPreferredSku) {
    const exactSubmittedVariant = candidates.filter(candidate => candidate.variantSku === normalizedPreferredSku);
    if (exactSubmittedVariant.length) return chooseFrom(exactSubmittedVariant);
  }
  if (preferredVariantId) return chooseFrom(candidates.filter(candidate => candidate.vid === preferredVariantId));
  return chooseFrom(candidates);
}

async function queryCjProductDetail(token: string, productSku: string) {
  const detail = await cjFetch<CjProductQueryResponse>(`/product/query?productSku=${encodeURIComponent(productSku)}`, { method: "GET", headers: { "CJ-Access-Token": token } });
  if (!detail?.result || !detail.data?.pid) throw new CjDropshippingError("CJ could not retrieve current inventory for this product.", 422, false);
  return detail.data;
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

/** Reads CJ catalogue, inventory, and freight quotes only to prepare a landed-cost unpublished draft. */
export async function fetchCjProductForMassImport(sku: string, destinationCountryCode = "NG") {
  const imported = await fetchCjProductForImport(sku);
  const token = await accessToken();
  const detail = await queryCjProductDetail(token, imported.sku);
  const selected = selectCjAvailableVariant(detail.variants, undefined, sku);
  if (!selected) throw new CjDropshippingError("CJ reports this product as out of stock, so no draft was created.", 422, false);

  const freight = await cjFetch<CjFreightResponse>("/logistic/freightCalculate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
    body: JSON.stringify({ startCountryCode: selected.inventoryCountryCode, endCountryCode: destinationCountryCode, products: [{ quantity: 1, vid: selected.vid }] }),
  });
  const shippingCosts = (freight?.result ? freight.data ?? [] : []).map(option => parseCjSupplierCost(option.totalPostageFee, option.logisticPrice)).filter((cost): cost is number => cost !== null);
  if (!shippingCosts.length) throw new CjDropshippingError("CJ did not return a usable shipping quote for Nigeria, so no draft was created.", 422, false);
  const supplierProductCost = parseCjSupplierCost(selected.variantSellPrice, detail.sellPrice, imported.supplierCost ?? undefined);
  if (supplierProductCost === null) throw new CjDropshippingError("CJ did not return a trustworthy product cost for automatic pricing, so no draft was created.", 422, false);
  const supplierShippingCost = Math.max(...shippingCosts);

  return {
    ...imported,
    sku: selected.variantSku,
    externalProductId: detail.pid,
    externalVariantId: selected.vid,
    stockQuantity: selected.inventoryQuantity ?? 0,
    inventoryKnown: selected.inventoryKnown,
    inventoryCountryCode: selected.inventoryCountryCode,
    supplierProductCost,
    supplierShippingCost,
    supplierCost: Number((supplierProductCost + supplierShippingCost).toFixed(2)),
    supplierCostAvailable: true as const,
    supplierCurrency: "USD" as const,
  };
}

/** Returns available CJ catalogue entries for an administrator-led bulk draft import. */
export async function fetchCjProductCatalog(limit: number) {
  const token = await accessToken();
  const payload = await cjFetch<CjProductListResponse>(`/product/listV2?page=1&size=${Math.min(limit, 100)}&features=enable_description`, { method: "GET", headers: { "CJ-Access-Token": token } });
  const candidates = payload?.data?.content?.flatMap(section => section.productList ?? []) ?? [];
  return candidates.filter(candidate => candidate.sku || candidate.spu).slice(0, limit).map(candidate => {
    const imported = importableCjProduct(candidate, candidate.sku ?? candidate.spu ?? "CJ-CATALOG");
    const supplierCost = imported.supplierCost ?? 0;
    return { ...imported, externalProductId: candidate.id ?? candidate.spu ?? imported.sku, externalVariantId: null, stockQuantity: null, inventoryKnown: false, supplierProductCost: supplierCost, supplierShippingCost: 0, supplierCost, supplierCurrency: "USD" as const };
  });
}
/** Reads a current stock snapshot only; it neither quotes freight nor creates a supplier order. */
export async function fetchCjInventorySnapshot(input: { productSku: string; preferredVariantId?: string | null }) {
  const token = await accessToken();
  const detail = await queryCjProductDetail(token, input.productSku);
  const selected = selectCjAvailableVariant(detail.variants, input.preferredVariantId);
  return { externalProductId: detail.pid, externalVariantId: selected?.vid ?? input.preferredVariantId ?? null, stockQuantity: selected?.inventoryQuantity ?? 0, inventoryCountryCode: selected?.inventoryCountryCode ?? null };
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
