import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import MarketplaceShell from "@/components/MarketplaceShell";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { BadgeCheck, Bolt, Copy, Crown, Gift, ShieldCheck, Truck, Trophy, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type Tab = "buyer" | "vendor";

export default function Rewards() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("buyer");
  const rewards = trpc.marketplace.rewards.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const createReferral = trpc.marketplace.createReferralShare.useMutation({
    onSuccess: async data => { await rewards.refetch(); await navigator.clipboard.writeText(`${window.location.origin}/?ref=${data.shareCode}`); toast.success("Your referral link was copied."); },
  });
  const buyer = rewards.data?.buyer;
  const vendor = rewards.data?.vendor;
  const referral = useMemo(() => buyer?.referrals.find(item => item.status === "shared") ?? buyer?.referrals[0], [buyer?.referrals]);
  const cashbackPending = buyer?.pending.filter(item => item.type === "cashback").reduce((sum, item) => sum + item.amount, 0) ?? 0;

  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><section className="rewards-signin"><Gift size={34} /><span className="eyebrow">Alpha Rewards</span><h1>Your rewards are waiting.</h1><p>Sign in to see your Shopping Bonus, delivery tokens, buyer milestones, and approved-vendor progress.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to view rewards</button></section></div></MarketplaceShell>;

  return <MarketplaceShell><div className="page-shell rewards-page">
    <section className="rewards-hero"><div><span className="eyebrow eyebrow-dark">Alpha Rewards</span><h1>Earn more from every good find.</h1><p>All cash rewards become <strong>Shopping Bonus</strong> for Alpha Collective purchases. They never increase your withdrawable balance.</p></div><div className="rewards-hero-icon"><Gift size={42} /></div></section>
    <div className="rewards-tabs" role="tablist" aria-label="Rewards dashboard tabs"><button className={tab === "buyer" ? "active" : ""} onClick={() => setTab("buyer")} role="tab" aria-selected={tab === "buyer"}>Buyer Rewards</button><button className={tab === "vendor" ? "active" : ""} onClick={() => setTab("vendor")} role="tab" aria-selected={tab === "vendor"}>Vendor Rewards</button></div>
    {rewards.isLoading ? <p className="loading-line">Loading your reward progress…</p> : null}
    {rewards.error ? <div className="form-error">{rewards.error.message}</div> : null}
    {tab === "buyer" && buyer ? <section className="rewards-grid">
      <article className="reward-card reward-card-featured"><div className="reward-card-icon"><Gift size={20} /></div><span className="reward-kicker">Anti-fraud referrals</span><h2>Share your link.</h2><p>Both accounts receive Shopping Bonus only after the new buyer’s first successfully delivered order of at least ₦5,000. Matching device or network signals are silently voided.</p>{referral ? <div className="reward-code"><code>{referral.shareCode}</code><button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${referral.shareCode}`); toast.success("Referral link copied."); }} aria-label="Copy referral link"><Copy size={16} /></button></div> : <button className="button button-primary" disabled={createReferral.isPending} onClick={() => createReferral.mutate({ channel: "whatsapp" })}>{createReferral.isPending ? "Creating…" : "Create my unique link"}</button>}{createReferral.error ? <p className="form-error">{createReferral.error.message}</p> : null}</article>
      <article className="reward-card"><div className="reward-card-icon gold"><WalletCards size={20} /></div><span className="reward-kicker">2% cashback</span><h2>{formatNaira(cashbackPending)} pending</h2><p>Two percent of an eligible delivered order total is held through the 48-hour return window, then released to Shopping Bonus.</p><div className="reward-state"><ShieldCheck size={16} /> Delivery confirmed before reward release</div></article>
      <article className="reward-card"><div className="reward-card-icon blue"><BadgeCheck size={20} /></div><span className="reward-kicker">KYC completion bonus</span><h2>{buyer.kycStatus === "verified" ? "Verification completed" : "Earn ₦500"}</h2><p>Complete Smile ID verification to receive a one-time ₦500 Shopping Bonus when secure provider approval is active.</p><Link href="/kyc" className="button button-secondary">{buyer.kycStatus === "verified" ? "View verification" : "Verify ID"}</Link></article>
      <article className="reward-card"><div className="reward-card-icon green"><Truck size={20} /></div><span className="reward-kicker">Free delivery token</span><h2>{formatNaira(buyer.monthlySpend)} / {formatNaira(buyer.freeDeliveryThreshold)}</h2><p>Spend over ₦50,000 on successfully delivered orders this calendar month to earn a free delivery voucher for your next checkout.</p><div className="reward-progress"><i style={{ width: `${Math.min(100, buyer.monthlySpend / buyer.freeDeliveryThreshold * 100)}%` }} /></div><strong className="reward-voucher-count">{buyer.activeVouchers.length} active voucher{buyer.activeVouchers.length === 1 ? "" : "s"}</strong></article>
      <article className="rewards-footnote"><ShieldCheck size={19} /><p><strong>Reward safety:</strong> Shopping Bonus is purchase-only and cannot be withdrawn. The KYC reward is queued only by an approved Smile ID result; provider activation and its secure callback remain intentionally deferred until configured.</p></article>
    </section> : null}
    {tab === "vendor" && vendor ? <section className="rewards-grid vendor-rewards-grid">
      {!vendor.vendor ? <article className="rewards-empty"><Trophy size={30} /><h2>Become an approved vendor to compete.</h2><p>Vendor rewards use only approved stores and successfully delivered orders.</p><Link href="/sell" className="button button-primary">Apply to sell</Link></article> : <>
        <article className="reward-card reward-card-featured"><div className="reward-card-icon"><Trophy size={20} /></div><span className="reward-kicker">Top 5 Vendors · {vendor.month}</span><h2>Delivery leaderboard</h2><p>Ranked only by successfully delivered orders from officially approved vendors. Monthly payouts stay pending until the 48-hour return window closes.</p><ol className="reward-leaderboard">{vendor.leaderboard.length ? vendor.leaderboard.map((item, index) => <li key={item.vendorUserId}><span><b>{index + 1}</b>{item.storeName}</span><strong>{item.deliveries} delivered</strong></li>) : <li>No delivered approved-vendor orders yet this month.</li>}</ol></article>
        <article className="reward-card"><div className="reward-card-icon gold"><Bolt size={20} /></div><span className="reward-kicker">Fast dispatch</span><h2>{vendor.hasLightningSellerBadge ? "Lightning Seller" : "Dispatch within 24 hours"}</h2><p>After an administrator records verified logistics hand-over within 24 hours, your profile earns the Lightning Seller badge and a ₦250 Shopping Bonus.</p><div className="reward-state">{vendor.hasLightningSellerBadge ? <><Bolt size={16} /> Badge earned</> : <><Truck size={16} /> Awaiting verified hand-over</>}</div></article>
        <article className="reward-card"><div className="reward-card-icon green"><Crown size={20} /></div><span className="reward-kicker">Dropped commission milestone</span><h2>{vendor.metrics.deliveries} / 50 deliveries</h2><p>Reach 50 successful deliveries with zero returns in the month to earn 0% platform commission for the rest of that month.</p><div className="reward-progress"><i style={{ width: `${Math.min(100, vendor.metrics.deliveries / 50 * 100)}%` }} /></div><strong className="reward-voucher-count">{vendor.metrics.returns} return{vendor.metrics.returns === 1 ? "" : "s"} this month</strong></article>
        <article className="reward-card"><div className="reward-card-icon blue"><ShieldCheck size={20} /></div><span className="reward-kicker">Your status</span><h2>{vendor.vendor.storeName}</h2><p>{vendor.vendor.status === "approved" ? "Your official approval allows your genuinely delivered orders to count toward all vendor rewards." : "Vendor rewards activate after your store is officially approved."}</p>{vendor.commissionOverride ? <div className="reward-state"><BadgeCheck size={16} /> 0% commission active this month</div> : null}</article>
      </>}
    </section> : null}
  </div></MarketplaceShell>;
}
