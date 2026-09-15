import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { formatNaira, type CartLine } from "@shared/marketplace";
import { Gift, Plus, Sparkles, Truck } from "lucide-react";
import { useMemo } from "react";

export default function CartTierRewardWidget({ items }: { items: CartLine[] }) {
  const { addItem } = useCart();
  const queryInput = useMemo(() => ({ items }), [items]);
  const progress = trpc.marketplace.cartRewards.progress.useQuery(queryInput, { enabled: items.length > 0, staleTime: 10_000 });
  const upsells = trpc.marketplace.cartRewards.smartUpsell.useQuery(queryInput, { enabled: items.length > 0 && Boolean(progress.data?.nextTier && progress.data.amountRemaining > 0), staleTime: 20_000 });
  if (!items.length || progress.isLoading || !progress.data?.nextTier) return null;
  const reward = progress.data.nextTier.rewardType === "alpha_wallet_credit" ? `${formatNaira(progress.data.nextTier.rewardValue)} Shopping Bonus` : progress.data.nextTier.rewardType === "free_shipping" ? "a free delivery voucher" : "a complimentary gift";
  const unlocked = progress.data.unlockedTier;
  return <section className="cart-tier-widget" aria-live="polite">
    <div className="cart-tier-heading"><div><span className="eyebrow">Tiered Cart Rewards</span><h2>{unlocked ? `${unlocked.name} reward ready` : `Unlock ${progress.data.nextTier.name}`}</h2></div><Gift size={22} aria-hidden="true" /></div>
    {unlocked ? <p>Your cart meets the spend and profit safeguard. {reward} is issued only after a verified eligible payment.</p> : <p>Spend <strong>{formatNaira(progress.data.amountRemaining)}</strong> more to unlock <strong>{reward}</strong>.</p>}
    <div className="cart-tier-track" aria-label={`${progress.data.progressPercent}% toward the next tier`}><span style={{ width: `${progress.data.progressPercent}%` }} /></div>
    <div className="cart-tier-meta"><span>{formatNaira(progress.data.subtotal)} in cart</span><span>{formatNaira(progress.data.nextTier.minimumSpend)} target</span></div>
    {progress.data.hasUnknownProfit ? <small>Some cart items do not yet have a verified profit basis, so this reward cannot be issued automatically.</small> : null}
    {upsells.data?.eligible && upsells.data.recommendations.length ? <div className="tier-upsell-list"><div className="tier-upsell-title"><Sparkles size={16} /> <span>Smart picks to bridge the gap</span></div>{upsells.data.recommendations.map(item => <article key={item.productId} className="tier-upsell-item"><img src={item.imageUrl} alt="" /><div><strong>{item.title}</strong><span>{formatNaira(item.price)}</span></div><button type="button" className="button button-secondary" onClick={() => addItem(item.productId)}><Plus size={15} /> Add</button></article>)}</div> : null}
    {progress.data.nextTier.rewardType === "free_shipping" ? <small><Truck size={14} /> Free delivery rewards become an available voucher after verified payment.</small> : null}
  </section>;
}
