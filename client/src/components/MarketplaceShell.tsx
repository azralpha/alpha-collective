import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { MARKETPLACE_CATEGORIES } from "@shared/marketplace";
import { Gift, Grid2X2, Home, Search, ShieldCheck, ShoppingCart, Store, WalletCards, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import DraggableSupportBubble from "./DraggableSupportBubble";

export const WHATSAPP_SUPPORT_URL =
  "https://wa.me/2340000000000?text=Hello%20Alpha%20Collective%2C%20I%20need%20help%20with%20my%20order.";

export function AlphaMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand-lockup" aria-label="Alpha Collective home">
      <span className="alpha-mark alpha-wolf-mark" aria-hidden="true" />
      {!compact ? (
        <span className="brand-copy">
          <strong>ALPHA</strong>
          <small>collective corporation</small>
        </span>
      ) : null}
    </Link>
  );
}

export default function MarketplaceShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { itemCount } = useCart();
  const { user } = useAuth();

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
          <Link href="/shop" className="header-search" aria-label="Search Alpha Collective">
            <Search size={21} aria-hidden="true" />
            <span>Search gadgets, ankara, serum</span>
          </Link>
          <div className="header-actions">
            {user?.role === "admin" ? <Link href="/admin/products" className="admin-link" aria-label="Review vendor products"><ShieldCheck size={20} /><span>Review</span></Link> : null}
            {user?.role === "admin" ? <Link href="/admin/official-products" className="admin-link" aria-label="Manage official products and hidden sourcing"><Store size={20} /><span>Source</span></Link> : null}
            {user?.role === "admin" ? <Link href="/admin/wallet-orders" className="admin-link" aria-label="Review wallet escrow orders"><ShieldCheck size={20} /><span>Escrow</span></Link> : null}
            {user ? <Link href="/rewards" className="admin-link" aria-label="Open Alpha Rewards"><Gift size={20} /><span>Rewards</span></Link> : null}
            {user ? <Link href="/wallet" className="admin-link" aria-label="Open Alpha Wallet"><WalletCards size={20} /><span>Wallet</span></Link> : null}
            <Link href="/cart" className="cart-link" aria-label={`Open cart with ${itemCount} items`}>
              <ShoppingCart size={23} />
              {itemCount > 0 ? <span className="cart-count">{itemCount}</span> : null}
            </Link>
          </div>
        </div>
        <nav aria-label="Shop categories" className="header-category-nav">
          {MARKETPLACE_CATEGORIES.map(category => <Link key={category} href={`/shop?category=${category}`} className="header-category-chip">{category}</Link>)}
          <Link href="/rewards" className="header-category-chip header-reward-chip"><Gift size={17} /> Rewards</Link>
        </nav>
      </header>
      <main>{children}</main>
      <DraggableSupportBubble />
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link href="/" className={location === "/" ? "active" : ""}><Home size={21} /><span>Home</span></Link>
        <Link href="/shop" className={location === "/shop" ? "active" : ""}><Grid2X2 size={21} /><span>Categories</span></Link>
        <Link href="/rewards" className={location === "/rewards" ? "active" : ""}><Gift size={21} /><span>Rewards</span></Link>
        <Link href="/sell" className={location === "/sell" ? "active" : ""}><Store size={21} /><span>Sell</span></Link>
        <Link href="/wallet" className={location === "/wallet" ? "active" : ""}><WalletCards size={21} /><span>Wallet</span></Link>
      </nav>
      <footer className="site-footer">
        <div>
          <AlphaMark />
          <p>Independent Nigerian commerce, shaped around local sellers and everyday discovery.</p>
        </div>
        <div className="footer-links">
          <Link href="/shop">Shop collections</Link>
          <Link href="/sell">Sell on Alpha Collective</Link>
          <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer">WhatsApp support</a>
        </div>
        <p className="footer-note">Pay on Delivery is available to KYC-verified buyers. Online payment options will be available once secure gateway processing is enabled.</p>
      </footer>
    </div>
  );
}
