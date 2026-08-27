import { useAuth } from "@/_core/hooks/useAuth";
import MarketplaceShell from "@/components/MarketplaceShell";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { Eye, Image, Mail, RefreshCw, Send, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type StagedCampaign = { id: number; subject: string; htmlBody: string; htmlPreview: string; recipientCount: number; status: "draft" | "sending" | "sent" | "failed"; productSnapshot: Array<{ id: string; title: string; price: number; description: string; imageUrl: string; productUrl: string }> };

export default function AdminNewsletter() {
  const { loading, isAuthenticated } = useAuth();
  const [campaign, setCampaign] = useState<StagedCampaign | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const campaigns = trpc.marketplace.admin.newsletterCampaigns.useQuery(undefined, { enabled: isAuthenticated });
  const preview = trpc.marketplace.admin.newsletterCampaignPreview.useQuery({ campaignId: campaign?.id ?? 0 }, { enabled: isAuthenticated && Boolean(campaign?.id) });

  const generateDraft = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/marketing/auto-newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "draft" }) });
      const payload = await response.json() as { campaign?: StagedCampaign; error?: string };
      if (!response.ok || !payload.campaign) throw new Error(payload.error || "The newsletter draft could not be generated.");
      setCampaign({ ...payload.campaign, htmlPreview: payload.campaign.htmlBody.replaceAll("{{ALPHA_UNSUBSCRIBE_URL}}", "#unsubscribe-preview") });
      await campaigns.refetch();
      toast.success("Newsletter draft staged. Review it before sending.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The newsletter draft could not be generated.");
    } finally { setIsGenerating(false); }
  };
  const sendDraft = async () => {
    if (!campaign) return;
    setIsSending(true);
    try {
      const response = await fetch("/api/marketing/auto-newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send", campaignId: campaign.id, confirmation }) });
      const payload = await response.json() as { result?: { sent: number; failed: number; total: number }; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "The newsletter could not be sent.");
      toast.success(`Campaign processed: ${payload.result.sent} sent, ${payload.result.failed} failed.`);
      setConfirmation("");
      await campaigns.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The newsletter could not be sent.");
    } finally { setIsSending(false); }
  };
  const selected = preview.data ?? campaign;

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Checking administrator access…</p></div></MarketplaceShell>;
  if (!isAuthenticated || campaigns.error) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card"><ShieldCheck size={28} /><h2>Administrator access required.</h2><p>Only Alpha Collective Corporation administrators can stage newsletter campaigns.</p></div></div></MarketplaceShell>;
  return <MarketplaceShell><main className="page-shell newsletter-admin-page"><section className="admin-review-hero"><div><span className="eyebrow">Alpha Collective Corporation · marketing workspace</span><h1 className="page-title">Newsletter staging.</h1><p className="section-kicker">Generate an AI-assisted campaign from current, high-margin arrivals, inspect every product and recipient count, then confirm a single explicit broadcast.</p></div><Mail size={34} aria-hidden="true" /></section>
    <section className="newsletter-staging-card"><div><span className="eyebrow"><ShieldCheck size={14} /> Draft before delivery</span><h2>Prepare the next Alpha VIP email.</h2><p>Generation reads at most three published official arrivals from the last seven days with verified internal margin and an absolute HTTPS image. It creates a saved draft only—no subscriber is contacted.</p></div><button type="button" className="button button-primary" disabled={isGenerating} onClick={generateDraft}><RefreshCw size={17} className={isGenerating ? "is-spinning-icon" : ""} />{isGenerating ? "Generating draft…" : "Generate Gemini draft"}</button></section>
    {selected ? <section className="newsletter-preview-grid"><article className="newsletter-preview-panel"><div className="section-title-row"><div><span className="eyebrow"><Eye size={14} /> Campaign preview</span><h2>{selected.subject}</h2></div><span className={`newsletter-status status-${selected.status}`}>{selected.status}</span></div><div className="newsletter-metrics"><span><Users size={16} />{selected.recipientCount} active recipients</span><span><Image size={16} />{selected.productSnapshot.length} featured products</span></div><iframe className="newsletter-iframe" title="Newsletter email preview" sandbox="" srcDoc={selected.htmlPreview} /><div className="newsletter-send-confirmation"><h3>Review complete?</h3><p>Sending is disabled until you type <strong>SEND NEWSLETTER</strong>. This confirms the selected audience count and starts one idempotent delivery attempt per active subscriber.</p><label>Confirmation phrase<input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="SEND NEWSLETTER" autoComplete="off" /></label><button type="button" className="button button-primary" disabled={isSending || confirmation !== "SEND NEWSLETTER" || selected.status !== "draft"} onClick={sendDraft}><Send size={17} />{isSending ? "Sending campaign…" : `Send to ${selected.recipientCount} recipients`}</button></div></article><aside className="newsletter-products-panel"><span className="eyebrow">Included products</span><h2>Check data before email.</h2>{selected.productSnapshot.map(product => <article key={product.id} className="newsletter-product-card"><img src={product.imageUrl} alt="" /><div><strong>{product.title}</strong><span>{formatNaira(product.price)}</span><p>{product.description}</p><a href={product.productUrl} target="_blank" rel="noreferrer">Open product</a></div></article>)}</aside></section> : null}
    <section className="official-product-list newsletter-history"><div className="catalogue-list-heading"><div><span className="eyebrow">Saved drafts and sends</span><h2>Campaign history</h2></div><strong>{campaigns.data?.length ?? 0} saved</strong></div>{campaigns.data?.length ? <div className="newsletter-history-list">{campaigns.data.map(item => <button key={item.id} type="button" className="newsletter-history-row" onClick={() => setCampaign({ ...item, htmlPreview: item.htmlBody.replaceAll("{{ALPHA_UNSUBSCRIBE_URL}}", "#unsubscribe-preview") } as StagedCampaign)}><span className={`newsletter-status status-${item.status}`}>{item.status}</span><div><strong>{item.subject}</strong><small>{item.recipientCount} recipients · {new Date(item.createdAt).toLocaleString()}</small></div></button>)}</div> : <div className="empty-panel"><h2>No campaigns staged.</h2><p>Generate a draft only when recent published arrivals have trusted source cost, images, and descriptions.</p></div>}</section>
  </main></MarketplaceShell>;
}
