import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { DELIVERY_FEE, formatNaira, getCheckoutTotals, REFERRAL_DISCOUNT } from "@shared/marketplace";
import { ArrowRight, CheckCircle2, Copy, CreditCard, MessageCircle, Truck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type Confirmation = { reference: string; subtotal: number; discount: number; deliveryFee: number; total: number };

export default function Checkout() {
  const { isAuthenticated } = useAuth();
  const { items, clearCart } = useCart();
  const [referralCode, setReferralCode] = useState(() => window.localStorage.getItem("alpha-collective-referral-code") ?? "");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const totals = getCheckoutTotals(items);
  const submitOrder = trpc.marketplace.submitOrder.useMutation({
    onSuccess: data => {
      if (data.discount > 0) window.localStorage.removeItem("alpha-collective-referral-code");
      setConfirmation(data);
      clearCart();
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) return;
    if (referralCode.trim() && !isAuthenticated) {
      toast.info("Sign in to apply a referral or earned reward code.");
      startLogin();
      return;
    }
    const form = new FormData(event.currentTarget);
    submitOrder.mutate({
      buyerName: String(form.get("buyerName") ?? ""),
      buyerPhone: String(form.get("buyerPhone") ?? ""),
      deliveryAddress: String(form.get("deliveryAddress") ?? ""),
      items,
      referralCode: referralCode.trim() || undefined,
    });
  };

  if (confirmation) {
    return (
      <MarketplaceShell>
        <div className="page-shell"><section className="confirmation-panel" style={{ marginTop: 34 }}>
          <span className="eyebrow">Order saved</span><h1>We have your delivery order.</h1>
          <p>Your order is queued as <strong>Pay on Delivery</strong>. A seller or support coordinator can use your phone number and address to arrange the next step.</p>
          <div className="order-reference">Order reference: <strong>{confirmation.reference}</strong> <button onClick={() => { navigator.clipboard.writeText(confirmation.reference); toast.success("Order reference copied."); }} style={{ border: 0, background: "transparent", color: "var(--tomato)", marginLeft: 7 }} aria-label="Copy order reference"><Copy size={15} /></button></div>
          <div className="summary-row"><span>Saved order total</span><strong>{formatNaira(confirmation.total)}</strong></div>
          {confirmation.discount > 0 ? <div className="summary-row"><span>Referral discount included</span><strong>−{formatNaira(confirmation.discount)}</strong></div> : null}
          <div className="confirmation-actions"><Link href="/shop" className="button button-primary">Keep shopping <ArrowRight size={17} /></Link><a href="https://wa.me/2340000000000" target="_blank" rel="noreferrer" className="button button-secondary"><MessageCircle size={17} /> WhatsApp support</a></div>
        </section></div>
      </MarketplaceShell>
    );
  }

  if (items.length === 0) {
    return <MarketplaceShell><div className="page-shell"><div className="empty-panel" style={{ marginTop: 42 }}><h2>Checkout needs a find first.</h2><p>Your cart is currently empty.</p><Link href="/shop" className="button button-primary">Return to shop</Link></div></div></MarketplaceShell>;
  }

  return (
    <MarketplaceShell>
      <div className="page-shell"><div className="checkout-layout"><section>
        <span className="eyebrow">A few final details</span><h1 className="page-title">Where should it go?</h1>
        <form onSubmit={handleSubmit} className="checkout-form">
          <div className="form-grid">
            <div className="form-field"><label htmlFor="buyerName">Your name</label><input id="buyerName" name="buyerName" required placeholder="Full name" /></div>
            <div className="form-field"><label htmlFor="buyerPhone">WhatsApp or phone</label><input id="buyerPhone" name="buyerPhone" required placeholder="0800 000 0000" /></div>
            <div className="form-field full"><label htmlFor="deliveryAddress">Delivery address</label><textarea id="deliveryAddress" name="deliveryAddress" required placeholder="House number, street, area, city and delivery cues" /></div>
          </div>
          <div className="form-field" style={{ marginTop: 20 }}><label htmlFor="referralCode">Referral or earned reward code</label><input id="referralCode" value={referralCode} onChange={event => setReferralCode(event.target.value.toUpperCase())} placeholder="ALPHA-XXXXXXXX or THANKS-XXXXXXXX" /><p className="form-help">A shared code gives the referred buyer ₦500 off an eligible order from ₦5,000. The sharer’s separate reward is issued after qualification. Sign in is required to apply either code.</p></div>
          <div className="payment-options">
            <label className="payment-option selected"><input type="radio" name="payment" checked readOnly /><span><strong><Truck size={14} style={{ display: "inline", marginRight: 5 }} />Pay on Delivery</strong><span>Your order is stored now; payment is coordinated at delivery.</span></span></label>
            <label className="payment-option disabled"><input type="radio" name="payment" disabled /><span><strong><CreditCard size={14} style={{ display: "inline", marginRight: 5 }} />Paystack</strong><span>Online checkout will appear here when secure gateway processing is enabled.</span></span></label>
            <label className="payment-option disabled"><input type="radio" name="payment" disabled /><span><strong><CreditCard size={14} style={{ display: "inline", marginRight: 5 }} />Flutterwave</strong><span>Online checkout will appear here when secure gateway processing is enabled.</span></span></label>
          </div>
          {submitOrder.error ? <div className="form-error">{submitOrder.error.message}</div> : null}
          <button type="submit" className="button button-primary" style={{ width: "100%", marginTop: 20 }} disabled={submitOrder.isPending}>{submitOrder.isPending ? "Saving your order…" : "Save Pay on Delivery order"} <ArrowRight size={17} /></button>
        </form>
      </section><aside className="summary-card"><h2>Order note</h2><div className="summary-row"><span>Items</span><span>{formatNaira(totals.subtotal)}</span></div><div className="summary-row"><span>Delivery</span><span>{formatNaira(DELIVERY_FEE)}</span></div><div className="summary-row total"><span>Order total</span><span>{formatNaira(totals.total)}</span></div><div className="cod-chip"><i /> Pay on Delivery selected</div><p className="summary-note">If an eligible referral code validates, {formatNaira(REFERRAL_DISCOUNT)} is removed from the stored total shown in the confirmation.</p><p className="summary-note"><CheckCircle2 size={13} style={{ display: "inline", marginRight: 4, color: "var(--tomato)" }} />No online payment is taken for this order.</p></aside></div></div>
    </MarketplaceShell>
  );
}
