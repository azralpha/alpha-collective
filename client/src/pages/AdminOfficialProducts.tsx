import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { getCjMassImportSkuEntries } from "@/lib/cjMassImportInput";
import { trpc } from "@/lib/trpc";
import { hasManualRetailPrice } from "@/lib/officialProductPricing";
import { MARKETPLACE_CATEGORIES, formatNaira } from "@shared/marketplace";
import { ChevronLeft, ChevronRight, Download, FileUp, Loader2, LockKeyhole, Pencil, Plus, Save, ShieldCheck, Sparkles } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Provider = "local_vendor" | "auto_fulfill_api" | "manual_admin";
type Currency = "NGN" | "USD";
type CatalogueStatus = "all" | "draft" | "active" | "rejected";
type CatalogueCategory = "all" | (typeof MARKETPLACE_CATEGORIES)[number];
type CjMassBatch = {
  id: number;
  status: "queued" | "processing" | "completed" | "completed_with_errors" | "failed";
  requestedSkuCount: number;
  processedSkuCount: number;
  succeededSkuCount: number;
  failedSkuCount: number;
  items: Array<{ id: number; submittedSku: string; status: string; officialProductId: number | null; errorSummary: string | null }>;
};

const blankForm = () => ({
  title: "", category: "Fashion" as (typeof MARKETPLACE_CATEGORIES)[number], price: "", formerPrice: "", badge: "", description: "", detail: "", imageUrls: [] as string[], status: "draft" as "draft" | "active" | "rejected",
  fulfillmentProvider: "manual_admin" as Provider, externalSkuId: "", supplierCost: "", supplierCurrency: "USD" as Currency, aiCleanTitle: null as string | null, aiSeoDescription: null as string | null, aiMetaDescription: null as string | null, aiSuggestedTags: null as string[] | null,
});

const catalogueStatusOptions: Array<{ value: CatalogueStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminOfficialProducts() {
  const { loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [catalogueStatus, setCatalogueStatus] = useState<CatalogueStatus>("all");
  const [catalogueCategory, setCatalogueCategory] = useState<CatalogueCategory>("all");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [cataloguePage, setCataloguePage] = useState(1);
  const [cataloguePageSize, setCataloguePageSize] = useState(25);
  const catalogueInput = useMemo(() => ({
    status: catalogueStatus === "all" ? undefined : catalogueStatus,
    category: catalogueCategory === "all" ? undefined : catalogueCategory,
    search: catalogueSearch.trim() || undefined,
    page: cataloguePage,
    pageSize: cataloguePageSize,
  }), [catalogueCategory, cataloguePage, cataloguePageSize, catalogueSearch, catalogueStatus]);
  const products = trpc.marketplace.admin.officialProducts.useQuery(catalogueInput, { enabled: isAuthenticated });
  const upload = trpc.marketplace.admin.uploadOfficialProductImage.useMutation();
  const importCj = trpc.marketplace.admin.importCjProduct.useMutation();
  const startMassImport = trpc.marketplace.admin.startCjMassImport.useMutation();
  const processMassItem = trpc.marketplace.admin.processNextCjMassImportItem.useMutation();
  const previewGeminiEnhancement = trpc.marketplace.admin.generateGeminiProductEnhancement.useMutation();
  const enhanceSavedProduct = trpc.marketplace.admin.enhanceOfficialProductWithGemini.useMutation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm);
  const [cjSku, setCjSku] = useState("");
  const [cjSkuText, setCjSkuText] = useState("");
  const massSkuEntries = useMemo(() => getCjMassImportSkuEntries(cjSkuText), [cjSkuText]);
  const massSkuLimitExceeded = massSkuEntries.length > 50;
  const [markupPercent, setMarkupPercent] = useState("50");
  const [exchangeRateNgnPerUsd, setExchangeRateNgnPerUsd] = useState("");
  const [massCategory, setMassCategory] = useState<(typeof MARKETPLACE_CATEGORIES)[number]>("Gadgets");
  const [massBatchId, setMassBatchId] = useState<number | null>(null);
  const [completedBatchId, setCompletedBatchId] = useState<number | null>(null);
  const massProgress = trpc.marketplace.admin.cjMassImportProgress.useQuery({ batchId: massBatchId ?? 0 }, { enabled: isAuthenticated && massBatchId !== null, refetchInterval: massBatchId ? 800 : false });
  const batch = massProgress.data as CjMassBatch | undefined;
  const busy = upload.isPending || importCj.isPending || startMassImport.isPending || processMassItem.isPending || previewGeminiEnhancement.isPending || enhanceSavedProduct.isPending;
  const canAutoFulfil = form.fulfillmentProvider !== "auto_fulfill_api" || form.externalSkuId.trim().length > 0;
  const create = trpc.marketplace.admin.createOfficialProduct.useMutation({
    onSuccess: async () => {
      setCatalogueStatus("all");
      setCataloguePage(1);
      await Promise.all([utils.marketplace.admin.officialProducts.invalidate(), utils.marketplace.publicProducts.invalidate()]);
      toast.success("Official catalogue product saved.");
      setEditingId(null);
      setForm(blankForm());
    },
  });
  const update = trpc.marketplace.admin.updateOfficialProduct.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.marketplace.admin.officialProducts.invalidate(), utils.marketplace.publicProducts.invalidate()]);
      toast.success("Official catalogue product updated.");
      setEditingId(null);
      setForm(blankForm());
    },
  });

  function edit(product: NonNullable<typeof products.data>["items"][number]) {
    setEditingId(product.id);
    setForm({ title: product.title, category: product.category, price: String(product.price), formerPrice: product.formerPrice ? String(product.formerPrice) : "", badge: product.badge ?? "", description: product.description, detail: product.detail, imageUrls: product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [], status: product.status, fulfillmentProvider: product.fulfillmentProvider ?? "manual_admin", externalSkuId: product.externalSkuId ?? "", supplierCost: product.supplierCost !== null && product.supplierCost !== undefined ? String(product.supplierCost) : "", supplierCurrency: product.supplierCurrency ?? "USD", aiCleanTitle: product.aiCleanTitle ?? null, aiSeoDescription: product.aiSeoDescription ?? null, aiMetaDescription: product.aiMetaDescription ?? null, aiSuggestedTags: product.aiSuggestedTags ?? null });
  }

  async function onImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 5);
    if (!files.length) return;
    try {
      const dataUrls = await Promise.all(files.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("The image could not be read."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      })));
      const urls = await Promise.all(dataUrls.map(dataUrl => upload.mutateAsync({ dataUrl })));
      setForm(current => ({ ...current, imageUrls: urls.map(item => item.imageUrl) }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Image upload failed."); }
  }

  async function onCjImport() {
    if (!cjSku.trim()) return toast.error("Enter a CJ product SKU first.");
    try {
      const imported = await importCj.mutateAsync({ sku: cjSku.trim() });
      setForm(current => ({ ...current, title: imported.title, description: imported.description, detail: imported.description, imageUrls: imported.imageUrls, price: "", formerPrice: "", status: "draft", fulfillmentProvider: imported.fulfillmentProvider, externalSkuId: imported.sku, supplierCost: imported.supplierCost === null ? "" : String(imported.supplierCost), supplierCurrency: imported.supplierCurrency, aiCleanTitle: imported.enhancement?.cleanTitle ?? null, aiSeoDescription: imported.enhancement?.seoDescription ?? null, aiMetaDescription: imported.enhancement?.metaDescription ?? null, aiSuggestedTags: imported.enhancement?.suggestedTags ?? null }));
      if (!imported.supplierCostAvailable) toast.warning("CJ imported the draft without a trustworthy supplier cost. Enter or verify that hidden cost before publishing.");
      else if (imported.matchType === "parent_spu") toast.info(`CJ resolved this variant-style code to base SKU ${imported.sku}. Review the product details and images before saving.`);
      else toast.success("CJ details imported into an unpublished draft. Set your Naira retail price before saving.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "CJ product import failed."); }
  }

  async function onMassImport() {
    if (!cjSkuText.trim()) return toast.error("Paste one or more CJ SKUs first.");
    if (massSkuLimitExceeded) return toast.error("Import up to 50 unique CJ SKUs in one batch.");
    if (!exchangeRateNgnPerUsd.trim()) return toast.error("Enter the USD-to-Naira exchange rate you want this batch to use.");
    try {
      const started = await startMassImport.mutateAsync({ skuText: cjSkuText, markupPercent: Number(markupPercent), exchangeRateNgnPerUsd: Number(exchangeRateNgnPerUsd), category: massCategory });
      if (!started) throw new Error("The CJ import batch could not be created.");
      setCompletedBatchId(null);
      setMassBatchId(started.id);
      toast.success(`CJ batch created for ${started.requestedSkuCount} SKU${started.requestedSkuCount === 1 ? "" : "s"}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "The CJ mass import could not be started."); }
  }

  useEffect(() => {
    if (!batch || (batch.status !== "queued" && batch.status !== "processing") || processMassItem.isPending) return;
    void processMassItem.mutateAsync({ batchId: batch.id }).then(() => massProgress.refetch()).catch(error => toast.error(error instanceof Error ? error.message : "A CJ batch item could not be processed."));
  }, [batch, massProgress, processMassItem]);

  useEffect(() => {
    if (!batch || !["completed", "completed_with_errors", "failed"].includes(batch.status) || completedBatchId === batch.id) return;
    setCompletedBatchId(batch.id);
    setCatalogueStatus("all");
    setCataloguePage(1);
    void Promise.all([utils.marketplace.admin.officialProducts.invalidate(), utils.marketplace.publicProducts.invalidate()]).then(() => {
      const outcome = batch.succeededSkuCount ? `${batch.succeededSkuCount} draft${batch.succeededSkuCount === 1 ? "" : "s"} are now in Saved official products.` : "No new drafts were created for this batch.";
      toast.success(outcome);
    });
  }, [batch, completedBatchId, utils.marketplace.admin.officialProducts, utils.marketplace.publicProducts]);

  async function save() {
    if (!form.imageUrls.length) return toast.error("Add at least one public product image.");
    if (!hasManualRetailPrice(form.price)) return toast.error("Enter your own retail price in Naira before saving this product.");
    if (!canAutoFulfil) return toast.error("Auto-Fulfill API products require an External SKU ID.");
    const payload = { title: form.title, category: form.category, price: Number(form.price), formerPrice: form.formerPrice ? Number(form.formerPrice) : null, badge: form.badge || null, description: form.description, detail: form.detail, aiCleanTitle: form.aiCleanTitle, aiSeoDescription: form.aiSeoDescription, aiMetaDescription: form.aiMetaDescription, aiSuggestedTags: form.aiSuggestedTags, imageUrls: form.imageUrls, status: form.status, fulfillmentProvider: form.fulfillmentProvider, externalSkuId: form.externalSkuId || null, supplierCost: form.supplierCost ? Number(form.supplierCost) : null, supplierCurrency: form.supplierCurrency };
    try { if (editingId) await update.mutateAsync({ ...payload, id: editingId }); else await create.mutateAsync(payload); } catch (error) { toast.error(error instanceof Error ? error.message : "The official product could not be saved."); }
  }

  async function enhanceWithGemini() {
    if (!form.title.trim() || !form.description.trim()) return toast.error("Add a product title and description before requesting Gemini enhancement.");
    try {
      const enhancement = editingId
        ? (await enhanceSavedProduct.mutateAsync({ id: editingId })).enhancement
        : await previewGeminiEnhancement.mutateAsync({ title: form.title, description: form.description, specifications: form.detail || null });
      setForm(current => ({ ...current, title: enhancement.cleanTitle, description: enhancement.seoDescription, detail: enhancement.seoDescription, aiCleanTitle: enhancement.cleanTitle, aiSeoDescription: enhancement.seoDescription, aiMetaDescription: enhancement.metaDescription, aiSuggestedTags: enhancement.suggestedTags }));
      toast.success(editingId ? "Gemini enhancement saved. Review the draft fields, then save when ready." : "Gemini enhancement is ready. Review it before saving this draft.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gemini product enhancement could not be completed."); }
  }

  function resetCataloguePage(action: () => void) {
    action();
    setCataloguePage(1);
  }

  function showImportedDrafts() {
    setCatalogueStatus("draft");
    setCataloguePage(1);
    document.getElementById("saved-official-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyBatchReviewReport() {
    if (!batch) return;
    const report = batch.items.map(item => `${item.submittedSku}\t${item.status}\t${item.officialProductId ?? ""}\t${item.errorSummary ?? ""}`).join("\n");
    try { await navigator.clipboard.writeText(`CJ batch ${batch.id}\nSKU\tStatus\tDraft ID\tReview note\n${report}`); toast.success("CJ batch review report copied."); } catch { toast.error("The batch review report could not be copied."); }
  }

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Checking administrator access…</p></div></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card"><h2>Sign in for official catalogue management.</h2><button className="button button-primary" onClick={() => startLogin()}>Sign in <ShieldCheck size={17} /></button></div></div></MarketplaceShell>;
  if (products.error) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card"><h2>Administrator access required.</h2><p>Only Alpha Collective Corporation administrators can manage official products and hidden sourcing data.</p></div></div></MarketplaceShell>;

  const productPage = products.data;
  const productItems = productPage?.items ?? [];
  const productTotal = productPage?.total ?? 0;
  const productStart = productTotal ? (productPage!.page - 1) * productPage!.pageSize + 1 : 0;
  const productEnd = productTotal ? Math.min(productPage!.page * productPage!.pageSize, productTotal) : 0;
  const importedDraftCount = batch?.items.filter(item => item.status === "imported" && item.officialProductId).length ?? 0;

  return <MarketplaceShell><main className="page-shell dropship-admin-page">
    <section className="admin-review-hero"><div><span className="eyebrow">Alpha Collective Corporation · administrator workspace</span><h1 className="page-title">Official catalogue products.</h1><p className="section-kicker">Create white-labeled Alpha Market products. Buyers never receive the sourcing information shown below.</p></div><a className="button button-secondary" href="/admin/dropship-integrations">Dropship Integrations</a></section>
    <section className="official-product-form"><div className="section-title-row"><h2>{editingId ? "Edit official product" : "Create official product"}</h2><span className="private-source-label"><LockKeyhole size={14} /> Administrator only</span></div>
      <section className="cj-import-panel"><div><span className="eyebrow">Mass Import from CJ Dropshipping</span><h3>Create multiple unpublished Alpha Market drafts.</h3><p>Each available item is quoted to Nigeria, watermarked, converted to WebP, and saved as an unpublished draft with a landed-cost price. No supplier order is created.</p></div><div className="cj-mass-import-grid"><label className="cj-sku-textarea">Paste Multiple SKUs (comma or line-break separated)<textarea value={cjSkuText} onChange={event => setCjSkuText(event.target.value)} placeholder={"CJNSSYWY01847\nCJ-EXAMPLE-002"} disabled={busy} /><small className={`field-helper ${massSkuLimitExceeded ? "text-red-700" : ""}`}>{massSkuEntries.length} unique SKU{massSkuEntries.length === 1 ? "" : "s"} ready · maximum 50 per draft batch.</small></label><label>Global Profit Markup (%)<input inputMode="decimal" value={markupPercent} onChange={event => setMarkupPercent(event.target.value)} placeholder="e.g. 50" disabled={busy} /></label><label>USD to Naira exchange rate<input inputMode="decimal" value={exchangeRateNgnPerUsd} onChange={event => setExchangeRateNgnPerUsd(event.target.value)} placeholder="Enter your current rate" disabled={busy} /><small className="field-helper">Required so automatic draft prices never rely on a guessed exchange rate.</small></label><label>Draft category<select value={massCategory} onChange={event => setMassCategory(event.target.value as typeof massCategory)} disabled={busy}>{MARKETPLACE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label><button className="button button-primary" disabled={busy || !cjSkuText.trim() || !exchangeRateNgnPerUsd.trim() || massSkuLimitExceeded} onClick={onMassImport}>{startMassImport.isPending ? <Loader2 className="spin" size={17} /> : <Download size={17} />}{startMassImport.isPending ? "Starting batch…" : `Run ${massSkuEntries.length || ""} SKU Mass Import`}</button></div>{batch ? <div className="cj-import-progress" aria-live="polite"><div><strong>{batch.status === "completed" ? "Import complete" : batch.status === "completed_with_errors" ? "Import completed with review items" : batch.status === "failed" ? "Import did not complete" : `Importing product ${Math.min(batch.processedSkuCount + 1, batch.requestedSkuCount)} of ${batch.requestedSkuCount}`}</strong><span>{batch.processedSkuCount} of {batch.requestedSkuCount} processed · {batch.succeededSkuCount} drafted · {batch.failedSkuCount} need review</span></div><progress value={batch.processedSkuCount} max={batch.requestedSkuCount} /><small>{Math.round((batch.processedSkuCount / Math.max(batch.requestedSkuCount, 1)) * 100)}% complete. {batch.items.filter(item => item.errorSummary).slice(-3).map(item => `${item.submittedSku}: ${item.errorSummary}`).join(" · ")}</small><div className="cj-import-actions">{importedDraftCount ? <button type="button" className="catalogue-jump-button" onClick={showImportedDrafts}>Review {importedDraftCount} imported draft{importedDraftCount === 1 ? "" : "s"}</button> : null}<button type="button" className="button button-secondary" onClick={copyBatchReviewReport}>Copy review report</button></div></div> : null}<div className="cj-import-actions cj-single-import"><label>Or fetch one CJ Product SKU<input value={cjSku} onChange={event => setCjSku(event.target.value)} placeholder="e.g. CJNSSYWY01847" disabled={busy} /></label><button className="button button-secondary" disabled={busy || !cjSku.trim()} onClick={onCjImport}>{importCj.isPending ? <Loader2 className="spin" size={17} /> : <Download size={17} />}{importCj.isPending ? "Fetching CJ details…" : "Fetch Product Details"}</button></div></section>
      <div className="admin-form-grid"><label>Product title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Category<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as typeof form.category })}>{MARKETPLACE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label><label>Customer price (₦)<input inputMode="numeric" value={form.price} placeholder="Set your retail price" onChange={event => setForm({ ...form, price: event.target.value })} /><small className="field-helper">Required manually; CJ supplier cost is not used as the buyer price.</small></label><label>Former price (optional ₦)<input inputMode="numeric" value={form.formerPrice} onChange={event => setForm({ ...form, formerPrice: event.target.value })} /></label><label>Badge (optional)<input value={form.badge} onChange={event => setForm({ ...form, badge: event.target.value })} /></label><label>Publication<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as typeof form.status })}><option value="draft">Draft</option><option value="active">Active</option><option value="rejected">Rejected</option></select></label></div>
      <label>Product description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><label>Product detail<textarea value={form.detail} onChange={event => setForm({ ...form, detail: event.target.value })} /></label>
      <section className="hidden-source-section"><div><span className="eyebrow">Gemini Product Enhancement</span><p>Administrator-only copy assistance. Gemini receives only the product title, description, and optional product detail. It never publishes a product, changes pricing, or receives supplier, buyer, order, or delivery data.</p></div><div className="cj-import-actions"><button type="button" className="button button-secondary" disabled={busy || !form.title.trim() || !form.description.trim()} onClick={enhanceWithGemini}>{previewGeminiEnhancement.isPending || enhanceSavedProduct.isPending ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}{editingId ? "Enhance & save AI fields" : "Enhance with Gemini"}</button>{form.aiMetaDescription ? <p className="field-helper"><strong>AI meta description:</strong> {form.aiMetaDescription}<br /><strong>Suggested tags:</strong> {form.aiSuggestedTags?.join(", ")}</p> : null}</div></section>
      <label className="image-upload-field"><span>Public product images</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onImages} disabled={busy} /><span className="file-helper"><FileUp size={15} /> Up to five JPG, PNG, or WebP images — each is watermarked and optimized as WebP.</span></label>
      {form.imageUrls.length ? <div className="official-image-preview">{form.imageUrls.map(url => <img key={url} src={url} alt="Official product preview" />)}</div> : null}
      <section className="hidden-source-section"><div><span className="eyebrow">Dropship / Source Details (Hidden)</span><p>Strictly server-side. This information is never included in public or vendor APIs.</p></div><div className="admin-form-grid"><label>Fulfilment provider<select value={form.fulfillmentProvider} onChange={event => setForm({ ...form, fulfillmentProvider: event.target.value as Provider })}><option value="local_vendor">Local Vendor</option><option value="auto_fulfill_api">Auto-Fulfill API</option><option value="manual_admin">Manual Admin</option></select></label><label>External SKU ID{form.fulfillmentProvider === "auto_fulfill_api" ? " (required)" : " (optional)"}<input value={form.externalSkuId} onChange={event => setForm({ ...form, externalSkuId: event.target.value })} /></label><label>Supplier cost<input inputMode="numeric" value={form.supplierCost} onChange={event => setForm({ ...form, supplierCost: event.target.value })} /></label><label>Supplier currency<select value={form.supplierCurrency} onChange={event => setForm({ ...form, supplierCurrency: event.target.value as Currency })}><option value="USD">USD</option><option value="NGN">NGN</option></select></label></div></section>
      <div className="admin-review-actions"><button className="button button-primary" disabled={busy || create.isPending || update.isPending} onClick={save}>{editingId ? <Save size={17} /> : <Plus size={17} />}{editingId ? "Save official product" : "Create official product"}</button>{editingId ? <button className="button button-secondary" onClick={() => { setEditingId(null); setForm(blankForm()); }}>Cancel edit</button> : null}</div>
    </section>
    <section className="official-product-list" id="saved-official-products"><div className="catalogue-list-heading"><div><span className="eyebrow">Catalogue browser</span><h2>Saved official products</h2></div><strong>{productTotal} saved</strong></div><div className="catalogue-browse-controls"><div className="catalogue-status-toggle" role="tablist" aria-label="Official product status"><span>Status</span>{catalogueStatusOptions.map(option => <button type="button" role="tab" aria-selected={catalogueStatus === option.value} className={catalogueStatus === option.value ? "active" : ""} key={option.value} onClick={() => resetCataloguePage(() => setCatalogueStatus(option.value))}>{option.label}</button>)}</div><label className="catalogue-search">Search saved products<input value={catalogueSearch} onChange={event => resetCataloguePage(() => setCatalogueSearch(event.target.value))} placeholder="Product title" /></label><label>Category<select value={catalogueCategory} onChange={event => resetCataloguePage(() => setCatalogueCategory(event.target.value as CatalogueCategory))}><option value="all">All categories</option>{MARKETPLACE_CATEGORIES.map(category => <option value={category} key={category}>{category}</option>)}</select></label><label>Show<select value={cataloguePageSize} onChange={event => resetCataloguePage(() => setCataloguePageSize(Number(event.target.value)))}><option value={25}>25 products</option><option value={50}>50 products</option><option value={100}>100 products</option></select></label></div><p className="catalogue-page-summary">{productTotal ? `Showing ${productStart}–${productEnd} of ${productTotal} saved product${productTotal === 1 ? "" : "s"}.` : "No saved products match these controls."}</p>{products.isLoading ? <p className="loading-line">Loading official catalogue…</p> : productItems.length ? <div className="catalogue-row-list">{productItems.map(product => <article className="official-product-row" key={product.id}><div>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <div className="official-image-fallback" />}<div><span className="eyebrow">{product.category} · {product.status}</span><h3>{product.title}</h3><p>Buyer display: <strong>Alpha Market Official</strong> · {formatNaira(product.price)}</p><small>Hidden sourcing: {product.fulfillmentProvider?.replaceAll("_", " ") ?? "manual admin"} · {product.externalSkuId ? "SKU mapped" : "No external SKU"}</small></div></div><button className="button button-secondary" onClick={() => edit(product)}><Pencil size={16} /> Edit</button></article>)}</div> : <div className="empty-panel"><h2>No official products found.</h2><p>Try another status, category, or title search, or create the first white-labeled catalogue entry above.</p></div>}{productPage && productPage.totalPages > 1 ? <nav className="catalogue-pagination" aria-label="Official product pages"><button type="button" className="button button-secondary" disabled={productPage.page === 1} onClick={() => setCataloguePage(current => Math.max(1, current - 1))}><ChevronLeft size={16} /> Previous</button><span>Page {productPage.page} of {productPage.totalPages}</span><button type="button" className="button button-secondary" disabled={productPage.page === productPage.totalPages} onClick={() => setCataloguePage(current => Math.min(productPage.totalPages, current + 1))}>Next <ChevronRight size={16} /></button></nav> : null}</section>
  </main></MarketplaceShell>;
}
