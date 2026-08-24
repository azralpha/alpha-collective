import MarketplaceShell, { WHATSAPP_SUPPORT_URL } from "@/components/MarketplaceShell";
import ProductCard from "@/components/ProductCard";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { MARKETPLACE_CATEGORIES, MARKETPLACE_PRODUCTS, type MarketplaceCategory } from "@shared/marketplace";
import { ArrowRight, CheckCircle2, Flame, MessageCircle, PackageCheck, ShieldCheck, Tag, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const categoryNotes: Record<MarketplaceCategory, string> = {
  Fashion: "wear it out",
  Gadgets: "plug in",
  Beauty: "feel good",
  "Home & Furniture": "stay in",
  Vehicles: "get moving",
  "Animals & Pets": "care well",
};

const categoryCards = MARKETPLACE_CATEGORIES.flatMap(name => {
  const product = MARKETPLACE_PRODUCTS.find(item => item.category === name);
  return product ? [{ name, product, note: categoryNotes[name] }] : [];
});

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const referralStatus = trpc.marketplace.myReferralStatus.useQuery(undefined, { enabled: isAuthenticated });
  const createReferralShare = trpc.marketplace.createReferralShare.useMutation({
    onSuccess: async data => {
      setShareCode(data.shareCode);
      const shareUrl = `${window.location.origin}/shop?ref=${data.shareCode}`;
      const shareText = `Shop Alpha Collective with my referral code ${data.shareCode} and get ₦500 off eligible orders: ${shareUrl}`;
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Your referral message is ready to share.");
      } catch {
        toast.success("Your referral code is ready to share.");
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    },
    onError: () => toast.error("We could not prepare a referral code. Please try again."),
  });
  const issuedReward = referralStatus.data?.find(share => share.rewardStatus === "issued");

  const createOrShareReferral = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    createReferralShare.mutate({ channel: "whatsapp" });
  };

  return (
    <MarketplaceShell>
      <section className="deal-hero">
        <img src="/manus-storage/alpha-collective-hero_3f1a59b7.jpg" alt="A collection of local fashion, beauty, home and technology finds" />
        <div className="deal-hero-overlay" />
        <div className="deal-hero-content">
          <span className="deal-hero-kicker"><Flame size={17} /> Local sellers. Good prices.</span>
          <h1>Naija deals,<br />straight from<br />independent sellers.</h1>
          <p>Fashion, gadgets, beauty, home, vehicles and pet essentials in Naira — with Pay on Delivery so your order is saved before delivery.</p>
          <div className="deal-hero-actions">
            <Link href="/shop" className="deal-cta deal-cta-primary">Shop Naija’s Good Finds <ArrowRight size={19} /></Link>
            <Link href="/sell" className="deal-cta deal-cta-secondary">Sell on Alpha Collective <ArrowRight size={19} /></Link>
          </div>
          <div className="deal-hero-trust">
            <span><Truck size={19} /> Pay on Delivery</span>
            <span><PackageCheck size={19} /> Order saved</span>
            <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer"><MessageCircle size={19} /> WhatsApp help</a>
          </div>
        </div>
      </section>

      <section className="section deal-discovery-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Browse by feeling</span>
            <h2 className="section-title">Small categories. Good surprises.</h2>
          </div>
          <Link href="/shop" className="text-link">All collections <ArrowRight size={16} /></Link>
        </div>
        <div className="category-grid">
          {categoryCards.map(category => (
            <Link key={category.name} href={`/shop?category=${category.name}`} className="category-card">
              <img src={category.product.imageUrl} alt="" />
              <span>{category.name}</span>
              <small>{category.note}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="section deal-products-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">This week’s good price</span>
            <h2 className="section-title">Flash finds from the collective.</h2>
          </div>
          <Link href="/shop" className="text-link">See all finds <ArrowRight size={16} /></Link>
        </div>
        <div className="product-grid">
          {MARKETPLACE_PRODUCTS.map(product => <ProductCard key={product.id} product={product} />)}
        </div>
        <div className="trust-row">
          <div className="trust-item"><Truck className="trust-icon" size={22} /><div><strong>Pay on Delivery</strong><p>Choose delivery payment at checkout. Your order is saved before the hand-off.</p></div></div>
          <div className="trust-item"><MessageCircle className="trust-icon" size={22} /><div><strong>WhatsApp support</strong><p><a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer">Ask a real question</a> when you need help with an order or seller.</p></div></div>
          <div className="trust-item"><ShieldCheck className="trust-icon" size={22} /><div><strong>Seller-led delivery</strong><p>Each listing keeps the vendor name close, so your local find stays traceable.</p></div></div>
        </div>
      </section>

      <section id="rewards" className="section">
        <div className="referral-band">
          <div>
            <span className="eyebrow eyebrow-dark">Bring your people</span>
            <h2>Share and get ₦500 off.</h2>
            <p>Sign in, make a code, then send it to a different shopper. When their eligible order qualifies, they get ₦500 off and a separate ₦500 reward is issued to your account.</p>
          </div>
          <div className="referral-action">
            <button className="button button-cream" onClick={createOrShareReferral} disabled={createReferralShare.isPending}>
              <Tag size={16} /> {!isAuthenticated ? "Sign in to create a code" : createReferralShare.isPending ? "Preparing…" : "Create a referral code"}
            </button>
            {shareCode ? <div className="referral-code">Your share code: <strong>{shareCode}</strong></div> : issuedReward?.rewardCode ? <div className="referral-code">Your earned reward: <strong>{issuedReward.rewardCode}</strong></div> : <span className="referral-code">Different shopper · ₦500 each</span>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="seller-panel">
          <div className="seller-panel-copy">
            <span className="eyebrow eyebrow-dark">A seller-first market</span>
            <h2>Bring your good thing to more people.</h2>
            <p>Open a practical storefront, keep your catalogue moving, and receive clear payout guidance for local transfers.</p>
            <Link href="/sell" className="button button-cream">Sell on Alpha Collective <ArrowRight size={17} /></Link>
          </div>
          <div className="seller-panel-stats">
            <div className="seller-stat"><strong>10–15%</strong><span>Transparent seller commission</span></div>
            <div className="seller-stat"><strong>₦</strong><span>Local bank-transfer withdrawal guidance</span></div>
            <div className="seller-stat"><strong><CheckCircle2 size={32} /></strong><span>Product drafts before you go live</span></div>
          </div>
        </div>
      </section>
    </MarketplaceShell>
  );
}
