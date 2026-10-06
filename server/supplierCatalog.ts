import { fetchCjProductCatalog, fetchCjProductForImport } from "./cjDropshipping";

export const SUPPLIER_IDS = ["cj_dropshipping", "dsers", "inventory_source", "syncee", "doba"] as const;
export type SupplierId = typeof SUPPLIER_IDS[number];

export const SUPPLIER_LABELS: Record<SupplierId, string> = {
  cj_dropshipping: "CJ Dropshipping",
  dsers: "DSers",
  inventory_source: "Inventory Source",
  syncee: "Syncee",
  doba: "Doba",
};

type SupplierProduct = {
  sku: string;
  externalProductId: string;
  externalVariantId: string | null;
  title: string;
  description: string;
  imageUrls: string[];
  supplierCost: number;
  supplierCurrency: "USD" | "NGN";
  stockQuantity: number | null;
  inventoryKnown: boolean;
};

type GenericSupplierProduct = Partial<SupplierProduct> & { id?: string; productId?: string; productSku?: string; name?: string; price?: number | string; cost?: number | string; images?: string[]; image?: string; stock?: number | string };

function envKey(supplier: SupplierId, suffix: "API_URL" | "API_KEY") {
  return process.env[`SUPPLIER_${supplier.toUpperCase()}_${suffix}`]?.trim() || "";
}

function normalizeProduct(product: GenericSupplierProduct, supplier: SupplierId, fallbackSku: string): SupplierProduct {
  const sku = String(product.sku ?? product.productSku ?? fallbackSku).trim().toUpperCase();
  const title = String(product.title ?? product.name ?? "").trim();
  const supplierCost = Number(product.supplierCost ?? product.cost ?? product.price);
  const imageUrls = Array.from(new Set([...(product.imageUrls ?? []), ...(product.images ?? []), product.image].filter((url): url is string => typeof url === "string" && /^https:\/\//.test(url)))).slice(0, 5);
  if (!title || !imageUrls.length || !Number.isFinite(supplierCost) || supplierCost < 0) throw new Error(`${SUPPLIER_LABELS[supplier]} returned incomplete product data for ${fallbackSku}.`);
  const stock = product.stockQuantity ?? product.stock;
  const stockQuantity = stock === undefined || stock === null || stock === "" ? null : Math.max(0, Math.floor(Number(stock)));
  return { sku, externalProductId: `${supplier}:${String(product.externalProductId ?? product.id ?? sku)}`, externalVariantId: product.externalVariantId ?? null, title, description: String(product.description ?? `${title}. Review the supplier details before publishing.`).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200), imageUrls, supplierCost, supplierCurrency: product.supplierCurrency === "NGN" ? "NGN" : "USD", stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : null, inventoryKnown: stockQuantity !== null };
}

async function fetchGenericSupplier(supplier: Exclude<SupplierId, "cj_dropshipping">, skus: string[], limit: number) {
  const apiUrl = envKey(supplier, "API_URL");
  const apiKey = envKey(supplier, "API_KEY");
  if (!apiUrl || !apiKey) throw new Error(`${SUPPLIER_LABELS[supplier]} is not configured. Add SUPPLIER_${supplier.toUpperCase()}_API_URL and SUPPLIER_${supplier.toUpperCase()}_API_KEY on Render.`);
  const url = new URL(apiUrl);
  if (skus.length) url.searchParams.set("skus", skus.join(","));
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { headers: { accept: "application/json", authorization: `Bearer ${apiKey}`, "x-api-key": apiKey }, signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => null) as { products?: GenericSupplierProduct[]; data?: { products?: GenericSupplierProduct[] } } | null;
  if (!response.ok) throw new Error(`${SUPPLIER_LABELS[supplier]} rejected the catalogue request.`);
  const products = payload?.products ?? payload?.data?.products ?? [];
  return products.slice(0, limit).map((product, index) => normalizeProduct(product, supplier, skus[index] ?? `${supplier}-${index + 1}`));
}

export async function fetchSupplierProducts(input: { supplier: SupplierId; skus: string[]; limit: number }): Promise<SupplierProduct[]> {
  if (input.supplier === "cj_dropshipping") {
    if (!input.skus.length) return fetchCjProductCatalog(input.limit);
    const products = [] as SupplierProduct[];
    for (const sku of input.skus.slice(0, input.limit)) {
      const product = await fetchCjProductForImport(sku);
      products.push({ ...product, externalProductId: `cj_dropshipping:${product.sku}`, externalVariantId: null, supplierCost: product.supplierCost ?? 0, stockQuantity: null, inventoryKnown: false });
    }
    return products;
  }
  return fetchGenericSupplier(input.supplier, input.skus, input.limit);
}

export function supplierIsConfigured(supplier: SupplierId) {
  return supplier === "cj_dropshipping" ? Boolean(process.env.CJ_DROPSHIPPING_API_KEY?.trim()) : Boolean(envKey(supplier, "API_URL") && envKey(supplier, "API_KEY"));
}
