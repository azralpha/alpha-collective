import MarketplaceShell from "@/components/MarketplaceShell";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { MARKETPLACE_PRODUCTS, formatNaira, getCheckoutTotals, resolveCartLines, type MarketplaceProduct } from "@shared/marketplace";
import { ArrowRight, Minus, Plus, ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";
import CartTierRewardWidget from "@/components/CartTierRewardWidget";

export default function Cart() {
  const { items, setQuantity, removeItem } = useCart();
  const publicProducts = trpc.marketplace.publicProducts.useQuery();
  const catalog = useMemo<MarketplaceProduct[]>(() => [...MARKETPLACE_PRODUCTS, ...(publicProducts.data ?? [])], [publicProducts.data]);
  const lines = resolveCartLines(items, catalog);
  const totals = getCheckoutTotals(items, false, catalog);

  return (
    <MarketplaceShell>
      <div className="page-shell">
        {lines.length === 0 ? (
          <div className="empty-panel" style={{ marginTop: 42 }}><ShoppingBag size={30} style={{ margin: "0 auto 10px", color: "var(--tomato)" }} /><h2>Your collection is still open.</h2><p>Add something practical, beautiful, or both.</p><Link href="/shop" className="button button-primary">Explore the shop <ArrowRight size={17} /></Link></div>
        ) : (
          <div className="cart-layout">
            <section><span className="eyebrow">Your collection</span><h1 className="page-title">A few good things.</h1><div className="cart-list">{lines.map(line => <article className="cart-item" key={line.productId}><img src={line.product.imageUrl} alt={line.product.title} /><div><span className="eyebrow">{line.product.category}</span><h2>{line.product.title}</h2><p>{line.product.vendor}</p><div className="quantity-control"><button onClick={() => setQuantity(line.productId, line.quantity - 1)} aria-label={`Remove one ${line.product.title}`}><Minus size={14} /></button><span>{line.quantity}</span><button onClick={() => setQuantity(line.productId, line.quantity + 1)} aria-label={`Add one ${line.product.title}`}><Plus size={14} /></button></div></div><div className="cart-line-end"><strong>{formatNaira(line.lineTotal)}</strong><button className="remove-link" onClick={() => removeItem(line.productId)}>Remove</button></div></article>)}</div></section>
            <aside className="summary-card"><CartTierRewardWidget items={items} /><h2>Order note</h2><div className="summary-row"><span>Items</span><span>{formatNaira(totals.subtotal)}</span></div><div className="summary-row"><span>Delivery estimate</span><span>Calculated at checkout</span></div><div className="summary-row total"><span>Items total</span><span>{formatNaira(totals.total)}</span></div><Link href="/checkout" className="button button-primary">Continue to checkout <ArrowRight size={17} /></Link><div className="cod-chip"><i /> Pay on Delivery for KYC-verified buyers</div><p className="summary-note">Choose your Nigerian state, estimated parcel weight, and delivery speed at checkout for a live delivery quote.</p></aside>
          </div>
        )}
      </div>
    </MarketplaceShell>
  );
}
