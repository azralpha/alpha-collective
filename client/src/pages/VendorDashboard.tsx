import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { calculateVendorCommission, formatNaira, MARKETPLACE_CATEGORIES, type MarketplaceCategory } from "@shared/marketplace";
import { ArrowRight, Plus, WalletCards } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function VendorDashboard() {
  const { loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.marketplace.vendor.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const [category, setCategory] = useState<MarketplaceCategory>("Fashion");
  const createProduct = trpc.marketplace.vendor.createProduct.useMutation({
    onSuccess: async () => { await utils.marketplace.vendor.dashboard.invalidate(); toast.success("Your product was saved as a draft."); },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = Number(form.get("price"));
    createProduct.mutate({ title: String(form.get("title") ?? ""), category, price, description: String(form.get("description") ?? "") });
    event.currentTarget.reset();
  };

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading your seller dashboard…</p></div></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 38 }}><h2>Sign in for your seller space.</h2><p>Applications and product drafts are attached to your account.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to sell <ArrowRight size={17} /></button></div></div></MarketplaceShell>;
  if (dashboard.isLoading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading your seller dashboard…</p></div></MarketplaceShell>;
  if (dashboard.error) return <MarketplaceShell><div className="page-shell"><div className="form-error">{dashboard.error.message}</div></div></MarketplaceShell>;
  if (!dashboard.data?.application) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 38 }}><h2>Your seller space starts with an application.</h2><p>Tell us about your store, category, and WhatsApp number first.</p><Link className="button button-primary" href="/sell">Sell on Alpha Collective <ArrowRight size={17} /></Link></div></div></MarketplaceShell>;

  const { application, products } = dashboard.data;
  const rate = application.commissionRate;
  return (
    <MarketplaceShell><div className="page-shell"><section><span className="eyebrow">Seller dashboard</span><h1 className="page-title">{application.storeName}</h1><p className="section-kicker">Application status: <strong style={{ textTransform: "capitalize", color: "var(--ink)" }}>{application.status}</strong>. Your submitted products remain drafts until a seller review makes them active.</p><div className="dashboard-metrics"><div className="metric"><strong>{products.length}</strong><span>product drafts</span></div><div className="metric"><strong>{rate}%</strong><span>current commission guide</span></div><div className="metric"><strong>₦</strong><span>bank payout guidance</span></div></div></section><div className="dashboard-layout"><section><div className="section-heading"><div><span className="eyebrow">Your catalogue</span><h2 className="section-title">Saved products.</h2></div></div><div className="dashboard-products">{products.length > 0 ? products.map(product => <div key={product.id} className="vendor-product-row"><div><h3>{product.title}</h3><p>{product.category} · {formatNaira(product.price)} · Estimated {rate}% commission: {formatNaira(calculateVendorCommission(product.price, rate))}</p></div><span className="status-tag">{product.status}</span></div>) : <div className="empty-panel" style={{ marginTop: 20 }}><h2>No drafts yet.</h2><p>Add your first product at the side. It will be saved as a draft.</p></div>}</div></section><aside><div className="summary-card"><span className="eyebrow">Add to catalogue</span><h2 style={{ marginTop: 8 }}>Create a draft.</h2><form className="product-form" onSubmit={handleSubmit} style={{ border: 0, padding: 0, marginTop: 18 }}><div className="form-field"><label htmlFor="productTitle">Product title</label><input id="productTitle" name="title" required placeholder="What are you selling?" /></div><div className="form-field" style={{ marginTop: 13 }}><label htmlFor="productCategory">Category</label><select id="productCategory" value={category} onChange={event => setCategory(event.target.value as MarketplaceCategory)}>{MARKETPLACE_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="form-field" style={{ marginTop: 13 }}><label htmlFor="productPrice">Price in Naira</label><input id="productPrice" name="price" type="number" min="500" required placeholder="e.g. 15000" /></div><div className="form-field" style={{ marginTop: 13 }}><label htmlFor="productDescription">Short description</label><textarea id="productDescription" name="description" minLength={12} required placeholder="Materials, size, condition, or the useful details." /></div>{createProduct.error ? <div className="form-error">{createProduct.error.message}</div> : null}<button type="submit" className="button button-primary" style={{ marginTop: 18 }} disabled={createProduct.isPending}>{createProduct.isPending ? "Saving draft…" : "Save product draft"} <Plus size={16} /></button></form><div className="cod-chip"><WalletCards size={14} /> Confirm payout timing and account details during onboarding.</div></div></aside></div></div></MarketplaceShell>
  );
}
