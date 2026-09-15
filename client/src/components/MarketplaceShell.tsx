import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getMarketplaceCategoryMetadata, MARKETPLACE_CATEGORIES } from "@shared/marketplace";
import { Gift, Grid2X2, Home, Mail, Search, ShieldCheck, ShoppingCart, Sparkles, Store, UserRound, WalletCards, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import CartDrawer from "./CartDrawer";
import AlphaAiSupport from "./AlphaAiSupport";
import SpinClaimBanner from "./SpinClaimBanner";
import SpinToWinPromotion from "./SpinToWinPromotion";
import NewsletterSubscribe from "./NewsletterSubscribe";

export const WHATSAPP_SUPPORT_URL =
  "https://wa.me/2340000000000?text=Hello%20Alpha%20Market%2C%20I%20need%20help%20with%20my%20order.";

const mobileNavigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/shop", label: "Categories", icon: Grid2X2 },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/task-2-earn", label: "Earn", icon: Sparkles },
  { href: "/sell", label: "Sell", icon: Store },
  { href: "/wallet", label: "Wallet", icon: WalletCards },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

export function AlphaMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand-lockup" aria-label="Alpha Market home">
      <span className="alpha-mark alpha-wolf-mark" aria-hidden="true" />
      {!compact ? (
        <span className="brand-copy">
          <strong>ALPHA</strong>
          <small>market</small>
        </span>
      ) : null}
    </Link>
  );
}

export default function MarketplaceShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { itemCount } = useCart();
  const { user } = useAuth();
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  return (
    <div className="marketplace-app">
      <div className="announcement-bar">
        <span>Fresh finds for African products</span>
        <span className="announcement-dot" aria-hidden="true" />
        <span><strong>Pay on Delivery</strong> available after KYC verification</span>
      </div>
      <header className="site-header">
        <div className="header-main">
          <AlphaMark />
          <Link href="/shop" className="header-search" aria-label="Search Alpha Market">
            <Search size={21} aria-hidden="true" />
            <span>Search gadgets, ankara, serum</span>
          </Link>
          <div className="header-actions">
            {user?.role === "admin" ? <Link href="/admin/products" className="admin-link" aria-label="Review vendor products"><ShieldCheck size={20} /><span>Review</span></Link> : null}
            {user?.role === "admin" ? <Link href="/admin/official-products" className="admin-link" aria-label="Manage official products and hidden sourcing"><Store size={20} /><span>Source</span></Link> : null}
            {user?.role === "admin" ? <Link href="/admin/rewards" className="admin-link" aria-label="Manage tiered cart rewards"><Gift size={20} /><span>Tiered</span></Link> : null}
            {user?.role === "admin" ? <Link href="/admin/newsletter" className="admin-link" aria-label="Stage newsletter campaigns"><Mail size={20} /><span>Mail</span></Link> : null}
            {user?.role === "admin" ? <Link href="/admin/wallet-orders" className="admin-link" aria-label="Review wallet escrow orders"><ShieldCheck size={20} /><span>Escrow</span></Link> : null}
            {user ? <Link href="/rewards" className="admin-link" aria-label="Open Alpha Rewards"><Gift size={20} /><span>Rewards</span></Link> : null}
            {user ? <Link href="/task-2-earn" className="admin-link" aria-label="Open Task 2 Earn"><Sparkles size={20} /><span>Earn</span></Link> : null}
            {user ? <Link href="/wallet" className="admin-link" aria-label="Open Alpha Wallet"><WalletCards size={20} /><span>Wallet</span></Link> : null}
            {user ? <Link href="/profile" className="admin-link" aria-label="Open your profile dashboard"><UserRound size={20} /><span>Profile</span></Link> : null}
            <button type="button" className="cart-link" aria-label={`Open cart with ${itemCount} items`} onClick={() => setCartDrawerOpen(true)}>
              <ShoppingCart size={23} />
              {itemCount > 0 ? <span className="cart-count">{itemCount}</span> : null}
            </button>
          </div>
        </div>
        <nav aria-label="Shop categories" className="header-category-nav">
          {MARKETPLACE_CATEGORIES.map(category => <Link key={category} href={`/shop?category=${getMarketplaceCategoryMetadata(category).slug}`} className="header-category-chip">{category}</Link>)}
          <Link href="/rewards" className="header-category-chip header-reward-chip"><Gift size={17} /> Rewards</Link>
        </nav>
      </header>
      <SpinClaimBanner />
      <main>{children}</main>
      <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
      <AlphaAiSupport />
      <SpinToWinPromotion />
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation" style={{ "--mobile-nav-index": mobileNavigation.findIndex(item => item.href === (location.startsWith("/shop") ? "/shop" : location)) } as React.CSSProperties}>
        {mobileNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={(href === "/shop" ? location.startsWith("/shop") : location === href) ? "active" : ""}><Icon size={20} /><span>{label}</span></Link>)}
      </nav>
      <footer className="site-footer">
        <div>
          <AlphaMark />
          <p>Independent Nigerian commerce, shaped around local sellers and everyday discovery.</p>
        </div>
        <div className="footer-links">
          <Link href="/shop">Shop collections</Link>
          <Link href="/sell">Sell on Alpha Market</Link>
          <Link href="/terms-of-use">Terms of Use</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer">WhatsApp support</a>
        </div>
        <NewsletterSubscribe />
        <p className="footer-note">© {new Date().getFullYear()} Alpha Collective Corporation. Alpha Market is the public marketplace brand. Pay on Delivery is available to KYC-verified buyers.</p>
      </footer>
    </div>
  );
}
