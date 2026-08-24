import { useCart } from "@/contexts/CartContext";
import { MARKETPLACE_CATEGORIES } from "@shared/marketplace";
import { Gift, Grid2X2, Home, Search, ShoppingCart, Store, X } from "lucide-react";
import { Link, useLocation } from "wouter";

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

  return (
    <div className="marketplace-app">
      <div className="announcement-bar">
        <span>Fresh finds for African products</span>
        <span className="announcement-dot" aria-hidden="true" />
        <span><strong>Pay on Delivery</strong> available at checkout</span>
      </div>
      <header className="site-header">
        <div className="header-main">
          <AlphaMark />
          <Link href="/shop" className="header-search" aria-label="Search Alpha Collective">
            <Search size={21} aria-hidden="true" />
            <span>Search gadgets, ankara, serum</span>
          </Link>
          <div className="header-actions">
            <Link href="/cart" className="cart-link" aria-label={`Open cart with ${itemCount} items`}>
              <ShoppingCart size={23} />
              {itemCount > 0 ? <span className="cart-count">{itemCount}</span> : null}
            </Link>
          </div>
        </div>
        <nav aria-label="Shop categories" className="header-category-nav">
          {MARKETPLACE_CATEGORIES.map(category => <Link key={category} href={`/shop?category=${category}`} className="header-category-chip">{category}</Link>)}
          <a href="/#rewards" className="header-category-chip header-reward-chip"><Gift size={17} /> ₦500 off</a>
        </nav>
      </header>
      <main>{children}</main>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link href="/" className={location === "/" ? "active" : ""}><Home size={21} /><span>Home</span></Link>
        <Link href="/shop" className={location === "/shop" ? "active" : ""}><Grid2X2 size={21} /><span>Categories</span></Link>
        <a href="/#rewards"><Gift size={21} /><span>Rewards</span></a>
        <Link href="/sell" className={location === "/sell" ? "active" : ""}><Store size={21} /><span>Sell</span></Link>
        <Link href="/cart" className={location === "/cart" ? "active" : ""}><ShoppingCart size={21} /><span>Cart</span></Link>
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
        <p className="footer-note">Pay on Delivery keeps checkout simple. Online payment options will be available once secure gateway processing is enabled.</p>
      </footer>
    </div>
  );
}
