import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { formatNaira, getCheckoutTotals, MARKETPLACE_PRODUCTS, resolveCartLines, type MarketplaceProduct } from "@shared/marketplace";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";
import CartTierRewardWidget from "./CartTierRewardWidget";

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, setQuantity, removeItem } = useCart();
  const publicProducts = trpc.marketplace.publicProducts.useQuery(undefined, { staleTime: 20_000 });
  const catalog = useMemo<MarketplaceProduct[]>(() => [...MARKETPLACE_PRODUCTS, ...(publicProducts.data ?? [])], [publicProducts.data]);
  const lines = resolveCartLines(items, catalog);
  const total = getCheckoutTotals(items, false, catalog).total;
  if (!open) return null;
  return <div className="cart-drawer-layer" role="dialog" aria-modal="true" aria-label="Shopping cart"><button className="cart-drawer-backdrop" onClick={onClose} aria-label="Close cart" /><aside className="cart-drawer"><div className="cart-drawer-heading"><div><span className="eyebrow">Your cart</span><h2>{items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Your cart is empty"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close cart"><X size={20} /></button></div>{lines.length ? <><div className="cart-drawer-lines">{lines.map(line => <article key={line.productId}><img src={line.product.imageUrl} alt="" /><div><strong>{line.product.title}</strong><span>{formatNaira(line.lineTotal)}</span><div className="quantity-control"><button onClick={() => setQuantity(line.productId, line.quantity - 1)} aria-label={`Remove one ${line.product.title}`}><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => setQuantity(line.productId, line.quantity + 1)} aria-label={`Add one ${line.product.title}`}><Plus size={13} /></button></div></div><button className="remove-link" onClick={() => removeItem(line.productId)}>Remove</button></article>)}</div><CartTierRewardWidget items={items} /><div className="cart-drawer-total"><span>Items total</span><strong>{formatNaira(total)}</strong></div><Link href="/cart" className="button button-primary" onClick={onClose}>View cart</Link></> : <div className="empty-panel"><ShoppingBag size={26} /><p>Find something good to begin.</p><Link href="/shop" className="button button-secondary" onClick={onClose}>Explore shop</Link></div>}</aside></div>;
}
