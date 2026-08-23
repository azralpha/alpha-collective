import MarketplaceShell from "@/components/MarketplaceShell";
import { useCart } from "@/contexts/CartContext";
import { formatNaira, getCheckoutTotals, resolveCartLines } from "@shared/marketplace";
import { ArrowRight, Minus, Plus, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

export default function Cart() {
  const { items, setQuantity, removeItem } = useCart();
  const lines = resolveCartLines(items);
  const totals = getCheckoutTotals(items);

  return (
    <MarketplaceShell>
      <div className="page-shell">
        {lines.length === 0 ? (
          <div className="empty-panel" style={{ marginTop: 42 }}><ShoppingBag size={30} style={{ margin: "0 auto 10px", color: "var(--tomato)" }} /><h2>Your collection is still open.</h2><p>Add something practical, beautiful, or both.</p><Link href="/shop" className="button button-primary">Explore the shop <ArrowRight size={17} /></Link></div>
        ) : (
          <div className="cart-layout">
            <section><span className="eyebrow">Your collection</span><h1 className="page-title">A few good things.</h1><div className="cart-list">{lines.map(line => <article className="cart-item" key={line.productId}><img src={line.product.imageUrl} alt={line.product.title} /><div><span className="eyebrow">{line.product.category}</span><h2>{line.product.title}</h2><p>{line.product.vendor}</p><div className="quantity-control"><button onClick={() => setQuantity(line.productId, line.quantity - 1)} aria-label={`Remove one ${line.product.title}`}><Minus size={14} /></button><span>{line.quantity}</span><button onClick={() => setQuantity(line.productId, line.quantity + 1)} aria-label={`Add one ${line.product.title}`}><Plus size={14} /></button></div></div><div className="cart-line-end"><strong>{formatNaira(line.lineTotal)}</strong><button className="remove-link" onClick={() => removeItem(line.productId)}>Remove</button></div></article>)}</div></section>
            <aside className="summary-card"><h2>Order note</h2><div className="summary-row"><span>Items</span><span>{formatNaira(totals.subtotal)}</span></div><div className="summary-row"><span>Delivery estimate</span><span>{formatNaira(totals.deliveryFee)}</span></div><div className="summary-row total"><span>Estimated total</span><span>{formatNaira(totals.total)}</span></div><Link href="/checkout" className="button button-primary">Continue to checkout <ArrowRight size={17} /></Link><div className="cod-chip"><i /> Pay on Delivery available</div><p className="summary-note">A referral code can be checked at checkout. It applies to eligible orders from ₦5,000.</p></aside>
          </div>
        )}
      </div>
    </MarketplaceShell>
  );
}
