import { fetchAliExpressCatalogRefs, fetchAliExpressProductForMassImport, normalizeAliExpressProductReference } from "./aliexpressDropship";
import { fetchCjProductCatalog, fetchCjProductForMassImport } from "./cjDropshipping";

export const SUPPLIER_IDS = ["cj_dropshipping", "aliexpress"] as const;
export type SupplierId = typeof SUPPLIER_IDS[number];
export const SUPPLIER_LABELS: Record<SupplierId, string> = {
  cj_dropshipping: "CJ Dropshipping",
  aliexpress: "AliExpress",
};

export type SupplierCatalogRef = { id: string; previewImageUrl: string | null };
export type SupplierProduct = {
  sku: string;
  externalProductId: string;
  externalVariantId: string | null;
  title: string;
  description: string;
  imageUrls: string[];
  supplierCost: number;
  supplierProductCost?: number;
  supplierShippingCost?: number;
  supplierCurrency: "USD" | "NGN";
  stockQuantity: number | null;
  inventoryKnown: boolean;
  inventoryCountryCode?: string | null;
};

export function normalizeSupplierReference(supplier: SupplierId, value: string) {
  if (supplier === "aliexpress") return normalizeAliExpressProductReference(value);
  const sku = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,120}$/.test(sku)) throw new Error("Each CJ entry must be a valid product SKU, SPU, or ID.");
  return sku;
}

export async function fetchSupplierCatalogRefs(supplier: SupplierId, limit: number, keyword = ""): Promise<SupplierCatalogRef[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Choose between 1 and 500 supplier products.");
  if (supplier === "aliexpress") {
    const refs = await fetchAliExpressCatalogRefs(limit, keyword);
    return refs.map(ref => ({ id: ref.productId, previewImageUrl: ref.previewImageUrl }));
  }
  const products = await fetchCjProductCatalog(limit);
  return products.filter(product => Boolean(product.sku)).slice(0, limit).map(product => ({ id: String(product.sku), previewImageUrl: product.imageUrls?.[0] ?? null }));
}

export async function fetchSupplierProductForImport(supplier: SupplierId, reference: string, previewImageUrl?: string | null): Promise<SupplierProduct> {
  const normalized = normalizeSupplierReference(supplier, reference);
  if (supplier === "aliexpress") return fetchAliExpressProductForMassImport(normalized, previewImageUrl);
  const product = await fetchCjProductForMassImport(normalized);
  return {
    sku: product.sku,
    externalProductId: `cj_dropshipping:${product.externalProductId}`,
    externalVariantId: product.externalVariantId,
    title: product.title,
    description: product.description,
    imageUrls: product.imageUrls,
    supplierCost: product.supplierCost,
    supplierProductCost: product.supplierProductCost,
    supplierShippingCost: product.supplierShippingCost,
    supplierCurrency: product.supplierCurrency,
    stockQuantity: product.stockQuantity,
    inventoryKnown: product.inventoryKnown,
    inventoryCountryCode: product.inventoryCountryCode,
  };
}

export async function fetchSupplierProducts(input: { supplier: SupplierId; skus: string[]; limit: number }): Promise<SupplierProduct[]> {
  const refs = input.skus.length
    ? input.skus.slice(0, input.limit).map(value => ({ id: normalizeSupplierReference(input.supplier, value), previewImageUrl: null }))
    : await fetchSupplierCatalogRefs(input.supplier, input.limit);
  const products: SupplierProduct[] = [];
  for (const ref of refs) products.push(await fetchSupplierProductForImport(input.supplier, ref.id, ref.previewImageUrl));
  return products;
}

export function supplierIsConfigured(supplier: SupplierId) {
  if (supplier === "cj_dropshipping") return Boolean(process.env.CJ_DROPSHIPPING_API_KEY?.trim());
  return Boolean(process.env.ALIEXPRESS_APP_KEY?.trim() && process.env.ALIEXPRESS_APP_SECRET?.trim());
}
