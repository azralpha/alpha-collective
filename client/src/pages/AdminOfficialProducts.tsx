import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { MARKETPLACE_CATEGORIES, formatNaira } from "@shared/marketplace";
import { FileUp, LockKeyhole, Pencil, Plus, Save, ShieldCheck } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type Provider = "local_vendor" | "auto_fulfill_api" | "manual_admin";
type Currency = "NGN" | "USD";

const blankForm = () => ({
  title: "", category: "Fashion" as (typeof MARKETPLACE_CATEGORIES)[number], price: "", formerPrice: "", badge: "", description: "", detail: "", imageUrls: [] as string[], status: "draft" as "draft" | "active" | "rejected",
  fulfillmentProvider: "manual_admin" as Provider, externalSkuId: "", supplierCost: "", supplierCurrency: "USD" as Currency,
});

export default function AdminOfficialProducts() {
  const { loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const products = trpc.marketplace.admin.officialProducts.useQuery(undefined, { enabled: isAuthenticated });
  const upload = trpc.marketplace.admin.uploadOfficialProductImage.useMutation();
  const create = trpc.marketplace.admin.createOfficialProduct.useMutation({ onSuccess: async () => { await Promise.all([utils.marketplace.admin.officialProducts.invalidate(), utils.marketplace.publicProducts.invalidate()]); toast.success("Official catalogue product saved."); setEditingId(null); setForm(blankForm()); } });
  const update = trpc.marketplace.admin.updateOfficialProduct.useMutation({ onSuccess: async () => { await Promise.all([utils.marketplace.admin.officialProducts.invalidate(), utils.marketplace.publicProducts.invalidate()]); toast.success("Official catalogue product updated."); setEditingId(null); setForm(blankForm()); } });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm);

  const busy = upload.isPending || create.isPending || update.isPending;
  const canAutoFulfil = form.fulfillmentProvider !== "auto_fulfill_api" || form.externalSkuId.trim().length > 0;

  function edit(product: NonNullable<typeof products.data>[number]) {
    setEditingId(product.id);
    setForm({ title: product.title, category: product.category, price: String(product.price), formerPrice: product.formerPrice ? String(product.formerPrice) : "", badge: product.badge ?? "", description: product.description, detail: product.detail, imageUrls: product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [], status: product.status, fulfillmentProvider: product.fulfillmentProvider ?? "manual_admin", externalSkuId: product.externalSkuId ?? "", supplierCost: product.supplierCost !== null && product.supplierCost !== undefined ? String(product.supplierCost) : "", supplierCurrency: product.supplierCurrency ?? "USD" });
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

  async function save() {
    if (!form.imageUrls.length) return toast.error("Add at least one public product image.");
    if (!canAutoFulfil) return toast.error("Auto-Fulfill API products require an External SKU ID.");
    const payload = { title: form.title, category: form.category, price: Number(form.price), formerPrice: form.formerPrice ? Number(form.formerPrice) : null, badge: form.badge || null, description: form.description, detail: form.detail, imageUrls: form.imageUrls, status: form.status, fulfillmentProvider: form.fulfillmentProvider, externalSkuId: form.externalSkuId || null, supplierCost: form.supplierCost ? Number(form.supplierCost) : null, supplierCurrency: form.supplierCurrency };
    try { if (editingId) await update.mutateAsync({ ...payload, id: editingId }); else await create.mutateAsync(payload); } catch (error) { toast.error(error instanceof Error ? error.message : "The official product could not be saved."); }
  }

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Checking administrator access…</p></div></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card"><h2>Sign in for official catalogue management.</h2><button className="button button-primary" onClick={() => startLogin()}>Sign in <ShieldCheck size={17} /></button></div></div></MarketplaceShell>;
  if (products.error) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card"><h2>Administrator access required.</h2><p>Only Alpha Collective administrators can manage official products and hidden sourcing data.</p></div></div></MarketplaceShell>;

  return <MarketplaceShell><main className="page-shell dropship-admin-page">
    <section className="admin-review-hero"><div><span className="eyebrow">Administrator workspace</span><h1 className="page-title">Official catalogue products.</h1><p className="section-kicker">Create white-labeled Alpha Collective products. Buyers never receive the sourcing information shown below.</p></div><a className="button button-secondary" href="/admin/dropship-integrations">Dropship Integrations</a></section>
    <section className="official-product-form"><div className="section-title-row"><h2>{editingId ? "Edit official product" : "Create official product"}</h2><span className="private-source-label"><LockKeyhole size={14} /> Administrator only</span></div>
      <div className="admin-form-grid">
        <label>Product title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label>Category<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as typeof form.category })}>{MARKETPLACE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Customer price (₦)<input inputMode="numeric" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label>
        <label>Former price (optional ₦)<input inputMode="numeric" value={form.formerPrice} onChange={event => setForm({ ...form, formerPrice: event.target.value })} /></label>
        <label>Badge (optional)<input value={form.badge} onChange={event => setForm({ ...form, badge: event.target.value })} /></label>
        <label>Publication<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as typeof form.status })}><option value="draft">Draft</option><option value="active">Active</option><option value="rejected">Rejected</option></select></label>
      </div>
      <label>Product description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <label>Product detail<textarea value={form.detail} onChange={event => setForm({ ...form, detail: event.target.value })} /></label>
      <label className="image-upload-field"><span>Public product images</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onImages} disabled={busy} /><span className="file-helper"><FileUp size={15} /> Up to five JPG, PNG, or WebP images</span></label>
      {form.imageUrls.length ? <div className="official-image-preview">{form.imageUrls.map(url => <img key={url} src={url} alt="Official product preview" />)}</div> : null}
      <section className="hidden-source-section"><div><span className="eyebrow">Dropship / Source Details (Hidden)</span><p>Strictly server-side. This information is never included in public or vendor APIs.</p></div><div className="admin-form-grid"><label>Fulfilment provider<select value={form.fulfillmentProvider} onChange={event => setForm({ ...form, fulfillmentProvider: event.target.value as Provider })}><option value="local_vendor">Local Vendor</option><option value="auto_fulfill_api">Auto-Fulfill API</option><option value="manual_admin">Manual Admin</option></select></label><label>External SKU ID{form.fulfillmentProvider === "auto_fulfill_api" ? " (required)" : " (optional)"}<input value={form.externalSkuId} onChange={event => setForm({ ...form, externalSkuId: event.target.value })} /></label><label>Supplier cost<input inputMode="numeric" value={form.supplierCost} onChange={event => setForm({ ...form, supplierCost: event.target.value })} /></label><label>Supplier currency<select value={form.supplierCurrency} onChange={event => setForm({ ...form, supplierCurrency: event.target.value as Currency })}><option value="USD">USD</option><option value="NGN">NGN</option></select></label></div></section>
      <div className="admin-review-actions"><button className="button button-primary" disabled={busy} onClick={save}>{editingId ? <Save size={17} /> : <Plus size={17} />}{editingId ? "Save official product" : "Create official product"}</button>{editingId ? <button className="button button-secondary" onClick={() => { setEditingId(null); setForm(blankForm()); }}>Cancel edit</button> : null}</div>
    </section>
    <section className="official-product-list"><h2>Saved official products</h2>{products.isLoading ? <p className="loading-line">Loading official catalogue…</p> : products.data?.length ? products.data.map(product => <article className="official-product-row" key={product.id}><div>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <div className="official-image-fallback" />}<div><span className="eyebrow">{product.category} · {product.status}</span><h3>{product.title}</h3><p>Buyer display: <strong>Alpha Collective Official</strong> · {formatNaira(product.price)}</p><small>Hidden sourcing: {product.fulfillmentProvider?.replaceAll("_", " ") ?? "manual admin"} · {product.externalSkuId ? "SKU mapped" : "No external SKU"}</small></div></div><button className="button button-secondary" onClick={() => edit(product)}><Pencil size={16} /> Edit</button></article>) : <div className="empty-panel"><h2>No official products yet.</h2><p>Create the first white-labeled catalogue entry above.</p></div>}</section>
  </main></MarketplaceShell>;
}
