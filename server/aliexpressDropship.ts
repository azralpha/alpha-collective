import { AliExpressApiError, callAliExpressBusinessApi } from "./aliexpressOpenPlatform";
import { getAliExpressAccessToken } from "./aliexpressOAuth";

const SEARCH_METHOD = "aliexpress.ds.text.search";
const DETAIL_METHOD = "aliexpress.ds.product.get";
const PAGE_SIZE = 20;

export type AliExpressCatalogRef = { productId: string; previewImageUrl: string | null };
export type AliExpressImportProduct = {
  sku: string;
  externalProductId: string;
  externalVariantId: string;
  title: string;
  description: string;
  imageUrls: string[];
  supplierCost: number;
  supplierCurrency: "USD" | "NGN";
  stockQuantity: number;
  inventoryKnown: true;
};

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

function resultData(payload: AnyRecord) {
  const data = record(payload.data ?? payload.result);
  return Object.keys(data).length ? data : payload;
}

function parsePrice(...values: unknown[]) {
  for (const value of values) {
    const parsed = typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : Number(value);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100_000) return parsed;
  }
  return null;
}

function parseStock(value: unknown) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 0 ? Math.min(2_000_000_000, Math.floor(quantity)) : null;
}

function stripMarkup(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function collectImageUrls(value: unknown, result: string[] = [], depth = 0): string[] {
  if (depth > 7 || value == null) return result;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https:\/\//i.test(trimmed) && /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(trimmed)) result.push(trimmed);
    return result;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectImageUrls(entry, result, depth + 1);
    return result;
  }
  const object = record(value);
  for (const [key, entry] of Object.entries(object)) {
    if (/image|pic|url/i.test(key)) collectImageUrls(entry, result, depth + 1);
  }
  return result;
}

function unwrapProduct(payload: AnyRecord) {
  const data = resultData(payload);
  const result = record(data.result ?? data);
  return { result, base: record(result.ae_item_base_info_dto), multimedia: record(result.ae_multimedia_info_dto) };
}

export function normalizeAliExpressProductDetail(input: { productId: string; payload: AnyRecord; fallbackImageUrl?: string | null }): AliExpressImportProduct {
  const { result, base, multimedia } = unwrapProduct(input.payload);
  const title = String(base.subject ?? result.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (!title) throw new AliExpressApiError(`AliExpress did not return a product title for ${input.productId}.`);
  const skus = list(result.ae_item_sku_info_dtos).map(record);
  const candidates = skus.map(sku => {
    const price = parsePrice(sku.offer_sale_price, sku.sku_price, sku.channel_discount_price);
    const stock = parseStock(sku.sku_available_stock);
    return { sku, price, stock };
  }).filter((entry): entry is { sku: AnyRecord; price: number; stock: number } => entry.price !== null && entry.stock !== null);
  if (!candidates.length) throw new AliExpressApiError(`AliExpress did not return a verified variant price and stock value for ${input.productId}.`);
  candidates.sort((a, b) => b.stock - a.stock || a.price - b.price);
  const selected = candidates[0];
  const variantId = String(selected.sku.sku_id ?? selected.sku.id ?? "").trim();
  if (!variantId) throw new AliExpressApiError(`AliExpress did not return a variant ID for ${input.productId}.`);
  const imageUrls = Array.from(new Set([
    ...collectImageUrls(multimedia),
    ...collectImageUrls(result.ae_item_base_info_dto),
    ...list(selected.sku.ae_sku_property_dtos).map(value => record(value).sku_image).filter((value): value is string => typeof value === "string"),
    input.fallbackImageUrl,
  ].filter((value): value is string => typeof value === "string" && /^https:\/\//i.test(value)))).slice(0, 5);
  if (!imageUrls.length) throw new AliExpressApiError(`AliExpress did not return a product image for ${input.productId}.`);
  const description = stripMarkup(base.mobile_detail ?? result.mobile_detail ?? base.subject ?? title) || title;
  const currency = String(selected.sku.currency_code ?? "USD").toUpperCase() === "NGN" ? "NGN" : "USD";
  return {
    sku: variantId,
    externalProductId: `aliexpress:${input.productId}`,
    externalVariantId: variantId,
    title,
    description,
    imageUrls,
    supplierCost: selected.price,
    supplierCurrency: currency,
    stockQuantity: selected.stock,
    inventoryKnown: true,
  };
}

export async function fetchAliExpressCatalogRefs(limit: number, keyword = ""): Promise<AliExpressCatalogRef[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new AliExpressApiError("Choose between 1 and 500 AliExpress products.");
  const accessToken = await getAliExpressAccessToken();
  const refs: AliExpressCatalogRef[] = [];
  const seen = new Set<string>();
  const totalPages = Math.ceil(limit / PAGE_SIZE);
  for (let pageIndex = 1; pageIndex <= totalPages && refs.length < limit; pageIndex += 1) {
    const params: Record<string, string | number> = {
      local: "en_US",
      countryCode: "NG",
      currency: "USD",
      sortBy: "orders,desc",
      pageSize: PAGE_SIZE,
      pageIndex,
    };
    if (keyword.trim()) params.keyWord = keyword.trim().slice(0, 100);
    const payload = await callAliExpressBusinessApi<AnyRecord>(SEARCH_METHOD, params, accessToken);
    const data = resultData(payload);
    const products = list(data.products);
    for (const value of products) {
      const product = record(value);
      const productId = String(product.itemId ?? product.product_id ?? "").trim();
      if (!/^\d{6,24}$/.test(productId) || seen.has(productId)) continue;
      seen.add(productId);
      refs.push({ productId, previewImageUrl: typeof product.itemMainPic === "string" ? product.itemMainPic : null });
      if (refs.length >= limit) break;
    }
    const totalCount = Number(data.totalCount ?? 0);
    if (products.length < PAGE_SIZE || (totalCount > 0 && refs.length >= totalCount)) break;
  }
  return refs;
}

export async function fetchAliExpressProductForMassImport(productId: string, fallbackImageUrl?: string | null): Promise<AliExpressImportProduct> {
  if (!/^\d{6,24}$/.test(productId)) throw new AliExpressApiError("Enter a valid AliExpress product ID.");
  const accessToken = await getAliExpressAccessToken();
  const payload = await callAliExpressBusinessApi<AnyRecord>(DETAIL_METHOD, {
    ship_to_country: "NG",
    product_id: productId,
    target_currency: "USD",
    target_language: "en",
    remove_personal_benefit: true,
  }, accessToken);
  return normalizeAliExpressProductDetail({ productId, payload, fallbackImageUrl });
}

export function normalizeAliExpressProductReference(value: string) {
  const trimmed = value.trim();
  const urlMatch = /\/item\/(?:[^/?#]*?\/)?(\d{6,24})(?:\.html)?/i.exec(trimmed) ?? /[?&]product_id=(\d{6,24})/i.exec(trimmed);
  const productId = urlMatch?.[1] ?? trimmed;
  if (!/^\d{6,24}$/.test(productId)) throw new AliExpressApiError("Each AliExpress entry must be a numeric product ID or an AliExpress item URL.");
  return productId;
}
