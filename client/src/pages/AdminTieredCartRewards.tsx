import { useAuth } from "@/_core/hooks/useAuth";
import MarketplaceShell from "@/components/MarketplaceShell";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { Gift, Pencil, Plus, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type RewardType = "alpha_wallet_credit" | "free_shipping" | "catalog_gift";
const blankForm = () => ({ name: "", minimumSpend: "15000", rewardType: "alpha_wallet_credit" as RewardType, rewardValue: "1000", giftOfficialProductId: "", profitSafeguardMargin: "25", active: true });

export default function AdminTieredCartRewards() {
  const { loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const tiers = trpc.marketplace.admin.cartRewardTiers.useQuery(undefined, { enabled: isAuthenticated });
  const products = trpc.marketplace.admin.officialProducts.useQuery({ status: "active", page: 1, pageSize: 100 }, { enabled: isAuthenticated });
  const spinSettings = trpc.marketplace.admin.spinPromotionSettings.useQuery(undefined, { enabled: isAuthenticated });
  const create = trpc.marketplace.admin.createCartRewardTier.useMutation({ onSuccess: async () => { await utils.marketplace.admin.cartRewardTiers.invalidate(); toast.success("Tiered cart reward saved."); setEditingId(null); setForm(blankForm()); } });
  const update = trpc.marketplace.admin.updateCartRewardTier.useMutation({ onSuccess: async () => { await utils.marketplace.admin.cartRewardTiers.invalidate(); toast.success("Tiered cart reward updated."); setEditingId(null); setForm(blankForm()); } });
  const saveSpinSettings = trpc.marketplace.admin.saveSpinPromotionSettings.useMutation({ onSuccess: async () => { await utils.marketplace.admin.spinPromotionSettings.invalidate(); toast.success("Spin to Win policy saved."); } });
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [spinEnabled, setSpinEnabled] = useState(false);
  const [spinMargin, setSpinMargin] = useState("25");
  const [spinCountdown, setSpinCountdown] = useState("20");
  useEffect(() => {
    if (!spinSettings.data) return;
    setSpinEnabled(spinSettings.data.enabled);
    setSpinMargin(String(spinSettings.data.profitSafeguardMargin));
    setSpinCountdown(String(spinSettings.data.countdownMinutes));
  }, [spinSettings.data]);
  const busy = create.isPending || update.isPending || saveSpinSettings.isPending;

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Checking administrator access…</p></div></MarketplaceShell>;
  if (!isAuthenticated || tiers.error) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card"><ShieldCheck size={28} /><h2>Administrator access required.</h2><p>Only Alpha Collective Corporation administrators can configure cart rewards.</p></div></div></MarketplaceShell>;

  const save = async () => {
    const payload = { name: form.name, minimumSpend: Number(form.minimumSpend), rewardType: form.rewardType, rewardValue: form.rewardType === "alpha_wallet_credit" ? Number(form.rewardValue) : 0, giftOfficialProductId: form.rewardType === "catalog_gift" && form.giftOfficialProductId ? Number(form.giftOfficialProductId) : null, profitSafeguardMargin: Number(form.profitSafeguardMargin), active: form.active };
    try { if (editingId) await update.mutateAsync({ ...payload, id: editingId }); else await create.mutateAsync(payload); } catch (error) { toast.error(error instanceof Error ? error.message : "Reward tier could not be saved."); }
  };
  const edit = (tier: NonNullable<typeof tiers.data>[number]) => {
    setEditingId(tier.id);
    setForm({ name: tier.name, minimumSpend: String(tier.minimumSpend), rewardType: tier.rewardType, rewardValue: String(tier.rewardValue), giftOfficialProductId: tier.giftOfficialProductId ? String(tier.giftOfficialProductId) : "", profitSafeguardMargin: String(tier.profitSafeguardMargin), active: tier.active });
  };
  const saveSpin = async () => {
    try { await saveSpinSettings.mutateAsync({ enabled: spinEnabled, profitSafeguardMargin: Number(spinMargin), countdownMinutes: Number(spinCountdown) }); } catch (error) { toast.error(error instanceof Error ? error.message : "Spin to Win policy could not be saved."); }
  };

  return <MarketplaceShell><main className="page-shell tiered-reward-admin-page">
    <section className="admin-review-hero"><div><span className="eyebrow">Alpha Collective Corporation · administrator workspace</span><h1 className="page-title">Tiered Cart Rewards.</h1><p className="section-kicker">Create incentives that are evaluated against cart spend, verified profit, and payment settlement before any reward is issued.</p></div><Gift size={34} aria-hidden="true" /></section>
    <section className="official-product-form spin-policy-card"><div className="section-title-row"><div><span className="eyebrow"><Sparkles size={14} /> Promotion controls</span><h2>Spin to Win</h2></div><span className="private-source-label"><ShieldCheck size={14} /> Administrator only</span></div><p className="section-kicker">The wheel reveals one server-validated, low-cost active gift. Gemini may suggest an eligible item, but the server sets the final threshold and rejects carts whose verified profit does not cover the gift plus this margin.</p><div className="admin-form-grid"><label className="tier-status-toggle"><span>Promotion status</span><input type="checkbox" checked={spinEnabled} onChange={event => setSpinEnabled(event.target.checked)} /><strong>{spinEnabled ? "Enabled" : "Disabled"}</strong></label><label>Minimum protected margin (%)<input inputMode="numeric" value={spinMargin} onChange={event => setSpinMargin(event.target.value)} /><small className="field-helper">Default 25%. Supplier costs and calculations remain private.</small></label><label>Prize countdown (minutes)<input inputMode="numeric" value={spinCountdown} onChange={event => setSpinCountdown(event.target.value)} /><small className="field-helper">Allowed range: 5–30 minutes. Expired or unverified claims cannot add a gift.</small></label></div><div className="admin-review-actions"><button type="button" className="button button-primary" disabled={busy} onClick={saveSpin}><Save size={17} />Save Spin to Win policy</button></div></section>
    <section className="official-product-form"><div className="section-title-row"><h2>{editingId ? "Edit reward tier" : "Create reward tier"}</h2><span className="private-source-label"><ShieldCheck size={14} /> Administrator only</span></div><div className="admin-form-grid"><label>Tier name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Silver Supporter" /></label><label>Min spend target (₦)<input inputMode="numeric" value={form.minimumSpend} onChange={event => setForm({ ...form, minimumSpend: event.target.value })} /></label><label>Reward type<select value={form.rewardType} onChange={event => setForm({ ...form, rewardType: event.target.value as RewardType, rewardValue: event.target.value === "alpha_wallet_credit" ? form.rewardValue : "0" })}><option value="alpha_wallet_credit">Alpha Wallet credit</option><option value="free_shipping">Free shipping</option><option value="catalog_gift">Catalogue gift</option></select></label>{form.rewardType === "alpha_wallet_credit" ? <label>Shopping Bonus value (₦)<input inputMode="numeric" value={form.rewardValue} onChange={event => setForm({ ...form, rewardValue: event.target.value })} /><small className="field-helper">Issued to the non-withdrawable Shopping Bonus balance after verified payment.</small></label> : null}{form.rewardType === "catalog_gift" ? <label>Gift product<select value={form.giftOfficialProductId} onChange={event => setForm({ ...form, giftOfficialProductId: event.target.value })}><option value="">Select active official product</option>{products.data?.items.map(product => <option key={product.id} value={product.id}>{product.title} · {formatNaira(product.price)}</option>)}</select><small className="field-helper">Added at ₦0 to the paid order for manual fulfilment review; it never triggers supplier ordering.</small></label> : null}<label>Profit safeguard margin (%)<input inputMode="numeric" value={form.profitSafeguardMargin} onChange={event => setForm({ ...form, profitSafeguardMargin: event.target.value })} /><small className="field-helper">Default 25%. A tier cannot issue unless internal verified margin meets it.</small></label><label className="tier-status-toggle"><span>Status</span><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} /><strong>{form.active ? "Active" : "Inactive"}</strong></label></div><div className="admin-review-actions"><button type="button" className="button button-primary" disabled={busy} onClick={save}>{editingId ? <Save size={17} /> : <Plus size={17} />}{editingId ? "Save reward tier" : "Create reward tier"}</button>{editingId ? <button type="button" className="button button-secondary" onClick={() => { setEditingId(null); setForm(blankForm()); }}>Cancel edit</button> : null}</div></section>
    <section className="official-product-list"><div className="catalogue-list-heading"><div><span className="eyebrow">Current policy</span><h2>Configured reward tiers</h2></div><strong>{tiers.data?.length ?? 0} saved</strong></div>{tiers.data?.length ? <div className="tiered-reward-list">{tiers.data.map(tier => <article key={tier.id} className="tiered-reward-row"><div><span className="eyebrow">{tier.active ? "Active" : "Inactive"} · {tier.rewardType.replaceAll("_", " ")}</span><h3>{tier.name}</h3><p>Target {formatNaira(tier.minimumSpend)} · {tier.rewardType === "alpha_wallet_credit" ? `${formatNaira(tier.rewardValue)} Shopping Bonus` : tier.rewardType === "free_shipping" ? "Free delivery voucher" : "Catalogue gift"} · minimum verified margin {tier.profitSafeguardMargin}%</p></div><button type="button" className="button button-secondary" onClick={() => edit(tier)}><Pencil size={16} /> Edit</button></article>)}</div> : <div className="empty-panel"><h2>No reward tiers yet.</h2><p>Create an active tier to show cart progress and allow verified rewards.</p></div>}</section>
  </main></MarketplaceShell>;
}
