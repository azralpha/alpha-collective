import { useCart } from "@/contexts/CartContext";
import { ArrowUpRight, MessageCircle, ShoppingBag } from "lucide-react";
import { Link, useLocation } from "wouter";

export const WHATSAPP_SUPPORT_URL =
  "https://wa.me/2340000000000?text=Hello%20Alpha%20Collective%2C%20I%20need%20help%20with%20my%20order.";

const navItems = [
  { label: "Shop", href: "/shop" },
  { label: "Sell", href: "/sell" },
];

export function AlphaMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand-lockup" aria-label="Alpha Collective home">
      <span className="alpha-mark" aria-hidden="true">A</span>
      {!compact ? (
        <span className="brand-copy">
          <strong>ALPHA</strong>
          <small>collective</small>
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
        <span>Local finds, practical prices.</span>
        <span className="announcement-dot" aria-hidden="true" />
        <span><strong>Pay on Delivery</strong> available at checkout</span>
      </div>
      <header className="site-header">
        <AlphaMark />
        <nav aria-label="Primary navigation" className="desktop-nav">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={location === item.href ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer" className="header-support" aria-label="Open WhatsApp support">
            <MessageCircle size={17} /> <span>Help</span>
          </a>
          <Link href="/cart" className="cart-link" aria-label={`Open cart with ${itemCount} items`}>
            <ShoppingBag size={19} />
            {itemCount > 0 ? <span className="cart-count">{itemCount}</span> : null}
          </Link>
          <Link href="/sell" className="seller-header-cta">
            <span>Sell on Alpha Collective</span><ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <main>{children}</main>
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
