import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory } from "@shared/marketplace";
import { ArrowRight, CheckCircle2, Landmark, WalletCards } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Sell() {
  const { loading, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<MarketplaceCategory>("Fashion");
  const dashboard = trpc.marketplace.vendor.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const submitApplication = trpc.marketplace.vendor.submitApplication.useMutation({
    onSuccess: async result => { await utils.marketplace.vendor.dashboard.invalidate(); toast.success(result.alreadySubmitted ? "Your seller application is already on file." : "Your seller application was saved."); setLocation("/vendor/dashboard"); },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submitApplication.mutate({ name: String(form.get("name") ?? ""), storeName: String(form.get("storeName") ?? ""), whatsapp: String(form.get("whatsapp") ?? ""), category });
  };

  return (
    <MarketplaceShell><div className="page-shell"><div className="seller-layout"><section className="seller-intro"><span className="eyebrow eyebrow-dark">Your local storefront</span><h1>Sell on Alpha Collective.</h1><p>For independent sellers who want a clean place to show good products, keep a simple draft catalogue, and receive clear guidance around local withdrawals.</p><div className="seller-checks"><div className="seller-check"><b>10–15%</b>Transparent commission, set around the category and launch agreement.</div><div className="seller-check"><b>₦ withdrawals</b>Local bank-transfer payout guidance before you begin.</div><div className="seller-check"><b>Draft first</b>Submit products for review before they are made active.</div></div></section><aside className="seller-side"><span className="eyebrow">What happens next</span><h2>Apply, draft, then grow.</h2><p>We collect the essentials, confirm your seller status, and keep your product submissions in a practical dashboard.</p><a href="#seller-application" className="text-link">Start the application <ArrowRight size={16} /></a></aside></div>
      <section id="seller-application" className="section" style={{ width: "100%" }}><span className="eyebrow">Seller application</span><h2 className="section-title">Tell us what you are selling.</h2>{loading ? <p className="loading-line">Checking your seller access…</p> : !isAuthenticated ? <div className="sign-in-card" style={{ marginTop: 23 }}><h2>Sign in to apply.</h2><p>Seller applications are attached to your account so you can return to drafts and application status later.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to sell <ArrowRight size={17} /></button></div> : dashboard.isLoading ? <p className="loading-line" style={{ marginTop: 23 }}>Loading your seller status…</p> : dashboard.data?.application ? <div className="application-status"><strong>Application on file: {dashboard.data.application.status}</strong><p>Your seller space is tied to {user?.name ?? "your account"}. Continue to your dashboard to review your status and products.</p><Link href="/vendor/dashboard" className="text-link" style={{ marginTop: 11 }}>Open seller dashboard <ArrowRight size={15} /></Link></div> : <form className="seller-form" onSubmit={handleSubmit}><div className="form-grid"><div className="form-field"><label htmlFor="sellerName">Your name</label><input id="sellerName" name="name" defaultValue={user?.name ?? ""} required placeholder="Your name" /></div><div className="form-field"><label htmlFor="storeName">Store name</label><input id="storeName" name="storeName" required placeholder="Your shop name" /></div><div className="form-field"><label htmlFor="sellerWhatsApp">WhatsApp number</label><input id="sellerWhatsApp" name="whatsapp" required placeholder="0800 000 0000" /></div><div className="form-field"><label htmlFor="sellerCategory">Primary category</label><select id="sellerCategory" value={category} onChange={event => setCategory(event.target.value as MarketplaceCategory)}>{MARKETPLACE_CATEGORIES.map(item => <option value={item} key={item}>{item}</option>)}</select></div></div>{submitApplication.error ? <div className="form-error">{submitApplication.error.message}</div> : null}<button className="button button-primary" type="submit" style={{ marginTop: 20 }} disabled={submitApplication.isPending}>{submitApplication.isPending ? "Saving application…" : "Save seller application"} <ArrowRight size={17} /></button></form>}</section>
      <section className="section" style={{ width: "100%" }}><div className="trust-row"><div className="trust-item"><WalletCards className="trust-icon" size={22} /><div><strong>Commission clarity</strong><p>Keep the 10–15% guide visible while you agree the appropriate rate for your category.</p></div></div><div className="trust-item"><Landmark className="trust-icon" size={22} /><div><strong>Local payouts</strong><p>Confirm account details and transfer timing during onboarding before you list active products.</p></div></div><div className="trust-item"><CheckCircle2 className="trust-icon" size={22} /><div><strong>Product review</strong><p>New products are saved as drafts. A seller review process is needed before public activation.</p></div></div></div></section>
    </div></MarketplaceShell>
  );
}
