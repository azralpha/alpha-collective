import MarketplaceShell from "@/components/MarketplaceShell";
import "./CheckoutDelivery.css";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { DELIVERY_SERVICE_TIERS, type DeliveryServiceTier } from "@shared/delivery";
import { MARKETPLACE_PRODUCTS, REFERRAL_DISCOUNT, formatNaira, getCheckoutTotals, type MarketplaceProduct } from "@shared/marketplace";
import { NIGERIA_COUNTRY, NIGERIA_STATES, getNigerianLgas } from "@shared/nigeriaAddress";
import { ArrowRight, CheckCircle2, Copy, CreditCard, MessageCircle, Truck, WalletCards } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type Confirmation = { reference: string; subtotal: number; discount: number; deliveryFee: number; total: number };

export default function Checkout() {
  const { isAuthenticated } = useAuth();
  const { items, clearCart } = useCart();
  const [referralCode, setReferralCode] = useState(() => window.localStorage.getItem("alpha-collective-referral-code") ?? "");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [streetDetails, setStreetDetails] = useState("");
  const [weightKg, setWeightKg] = useState(2);
  const [deliveryTier, setDeliveryTier] = useState<DeliveryServiceTier>("standard");
  const [paymentMethod, setPaymentMethod] = useState<"delivery" | "wallet">("delivery");
  const [transactionPin, setTransactionPin] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const publicProducts = trpc.marketplace.publicProducts.useQuery();
  const catalog = useMemo<MarketplaceProduct[]>(() => [...MARKETPLACE_PRODUCTS, ...(publicProducts.data ?? [])], [publicProducts.data]);
  const walletEligible = useMemo(() => items.length > 0 && items.every(item => Boolean(catalog.find(product => product.id === item.productId)?.vendorUserId)), [catalog, items]);
  const lgas = useMemo(() => state ? getNigerianLgas(state) : [], [state]);
  const deliveryQuoteInput = useMemo(() => ({ destinationState: state, weightKg, serviceTier: deliveryTier }), [state, weightKg, deliveryTier]);
  const deliveryQuote = trpc.marketplace.deliveryQuote.useQuery(deliveryQuoteInput, { enabled: Boolean(state) && Number.isFinite(weightKg) && weightKg > 0 });
  const totals = useMemo(() => getCheckoutTotals(items, false, catalog, deliveryQuote.data?.deliveryFee ?? 0), [catalog, deliveryQuote.data?.deliveryFee, items]);
  const submitOrder = trpc.marketplace.submitOrder.useMutation({
    onSuccess: data => {
      if (data.discount > 0) window.localStorage.removeItem("alpha-collective-referral-code");
      setConfirmation(data);
      clearCart();
      toast.success("Your Pay on Delivery order has been saved.");
    },
  });
  const wallet = trpc.marketplace.wallet.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const kyc = trpc.marketplace.kyc.status.useQuery(undefined, { enabled: isAuthenticated });
  const payOnDeliveryEligible = isAuthenticated && kyc.data?.status === "verified";
  const walletCheckout = trpc.marketplace.wallet.checkout.useMutation({
    onSuccess: data => { setConfirmation({ ...data, discount: 0 }); clearCart(); toast.success("Your Alpha Wallet payment is held safely in escrow."); },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) return;
    if (!state || !lga || !streetDetails.trim()) {
      toast.error("Choose your state, local government area, and street details.");
      return;
    }
    if (!deliveryQuote.data) {
      toast.error("Choose a valid delivery state and package weight to calculate delivery.");
      return;
    }
    const form = new FormData(event.currentTarget);
    if (paymentMethod === "wallet") {
      if (!isAuthenticated) { toast.info("Sign in to pay with Alpha Wallet."); startLogin(); return; }
      walletCheckout.mutate({ buyerName: String(form.get("buyerName") ?? ""), buyerPhone: String(form.get("buyerPhone") ?? ""), deliveryAddress: { country: NIGERIA_COUNTRY, state, lga, streetDetails }, packageWeightKg: weightKg, deliveryTier, items, transactionPin });
      return;
    }
    if (!isAuthenticated) { toast.info("Sign in and complete KYC before saving a Pay on Delivery order."); startLogin(); return; }
    if (!payOnDeliveryEligible) { toast.error("Complete KYC Verification before confirming a Pay on Delivery order."); return; }
    if (referralCode.trim() && !isAuthenticated) {
      toast.info("Sign in to apply a referral or earned reward code.");
      startLogin();
      return;
    }
    submitOrder.mutate({
      buyerName: String(form.get("buyerName") ?? ""),
      buyerPhone: String(form.get("buyerPhone") ?? ""),
      deliveryAddress: { country: NIGERIA_COUNTRY, state, lga, streetDetails },
      packageWeightKg: weightKg,
      deliveryTier,
      items,
      referralCode: referralCode.trim() || undefined,
    });
  };

  if (confirmation) {
    return (
      <MarketplaceShell>
        <div className="page-shell"><section className="confirmation-panel" style={{ marginTop: 34 }}>
          <span className="eyebrow">Order saved</span><h1>We have your delivery order.</h1>
          <p>Your order is queued as <strong>Pay on Delivery</strong>. A seller or support coordinator can use your phone number and standardized address to arrange the next step.</p>
          <div className="order-reference">Order reference: <strong>{confirmation.reference}</strong> <button onClick={() => { navigator.clipboard.writeText(confirmation.reference); toast.success("Order reference copied."); }} style={{ border: 0, background: "transparent", color: "var(--tomato)", marginLeft: 7 }} aria-label="Copy order reference"><Copy size={15} /></button></div>
          <div className="summary-row"><span>Saved order total</span><strong>{formatNaira(confirmation.total)}</strong></div>
          <div className="summary-row"><span>Calculated delivery</span><strong>{formatNaira(confirmation.deliveryFee)}</strong></div>
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
            <div className="form-field"><label htmlFor="country">Country</label><select id="country" name="country" value={NIGERIA_COUNTRY} disabled aria-label="Country"><option>{NIGERIA_COUNTRY}</option></select></div>
            <div className="form-field"><label htmlFor="state">State or FCT</label><select id="state" name="state" value={state} required onChange={event => { setState(event.target.value); setLga(""); }}><option value="" disabled>Select your state</option>{NIGERIA_STATES.map(locationState => <option key={locationState} value={locationState}>{locationState}</option>)}</select></div>
            <div className="form-field full"><label htmlFor="lga">Local Government Area</label><select id="lga" name="lga" value={lga} required disabled={!state} onChange={event => setLga(event.target.value)}><option value="" disabled>{state ? "Select your LGA" : "Choose a state first"}</option>{lgas.map(locationLga => <option key={locationLga} value={locationLga}>{locationLga}</option>)}</select></div>
            <div className="form-field full"><label htmlFor="streetDetails">Street and delivery details</label><input id="streetDetails" name="streetDetails" value={streetDetails} required minLength={8} onChange={event => setStreetDetails(event.target.value)} placeholder="House number, street name, compound, and area (e.g., Oyan, Olomoba Compound)" /><p className="form-help">Your saved address is standardized as: NIGERIA, STATE, LGA, STREET DETAILS.</p></div>
          </div>
          <section className="delivery-options" aria-label="Delivery calculator">
            <div><span className="eyebrow">Delivery calculator</span><h2>Choose your delivery speed.</h2><p>Base delivery includes up to 2 kg. Each additional 1 kg adds ₦1,000 before the service-tier adjustment.</p></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="weightKg">Estimated parcel weight (kg)</label><input id="weightKg" name="weightKg" type="number" min="0.1" max="5000" step="0.1" value={weightKg} onChange={event => setWeightKg(Number(event.target.value))} /></div>
              <div className="form-field"><label htmlFor="deliveryTier">Delivery service</label><select id="deliveryTier" name="deliveryTier" value={deliveryTier} onChange={event => setDeliveryTier(event.target.value as DeliveryServiceTier)}>{DELIVERY_SERVICE_TIERS.map(tier => <option key={tier} value={tier}>{tier === "express" ? "Express Delivery (1–2 days)" : "Standard Delivery (3–5 days)"}</option>)}</select></div>
            </div>
            {deliveryQuote.isFetching ? <p className="form-help">Calculating delivery…</p> : deliveryQuote.data ? <div className="delivery-quote"><div><span>Zone</span><strong>{deliveryQuote.data.zoneLabel}</strong></div><div><span>Base rate</span><strong>{formatNaira(deliveryQuote.data.baseRate)}</strong></div><div><span>Weight surcharge</span><strong>{formatNaira(deliveryQuote.data.weightSurcharge)}</strong></div><div><span>{deliveryQuote.data.serviceLabel}</span><strong>{formatNaira(deliveryQuote.data.deliveryFee)}</strong></div></div> : <p className="form-help">Choose a Nigerian state to see the delivery quote.</p>}
          </section>
          <div className="form-field" style={{ marginTop: 20 }}><label htmlFor="referralCode">Referral or earned reward code</label><input id="referralCode" value={referralCode} onChange={event => setReferralCode(event.target.value.toUpperCase())} placeholder="ALPHA-XXXXXXXX or THANKS-XXXXXXXX" /><p className="form-help">A shared code gives the referred buyer ₦500 off an eligible order from ₦5,000. The sharer’s separate reward is issued after qualification. Sign in is required to apply either code.</p></div>
          <div className="payment-options">
            <label className={`payment-option ${paymentMethod === "delivery" ? "selected" : ""} ${!payOnDeliveryEligible ? "disabled" : ""}`}><input type="radio" name="payment" checked={paymentMethod === "delivery"} onChange={() => setPaymentMethod("delivery")} disabled={!payOnDeliveryEligible} /><span><strong><Truck size={14} style={{ display: "inline", marginRight: 5 }} />Pay on Delivery</strong><span>{!isAuthenticated ? "Sign in and complete KYC to prevent fraudulent delivery orders." : kyc.isLoading ? "Checking KYC eligibility…" : !payOnDeliveryEligible ? "Complete KYC Verification before confirming a Pay on Delivery order." : "Your order is stored now; payment is coordinated at delivery."}</span>{!payOnDeliveryEligible && isAuthenticated ? <Link href="/kyc" className="text-link" style={{ marginTop: 8 }}>Complete KYC Verification <ArrowRight size={14} /></Link> : null}</span></label>
            <label className={`payment-option ${paymentMethod === "wallet" ? "selected" : ""}`}><input type="radio" name="payment" checked={paymentMethod === "wallet"} onChange={() => setPaymentMethod("wallet")} disabled={!isAuthenticated || !wallet.data?.hasPin || !walletEligible} /><span><strong><WalletCards size={14} style={{ display: "inline", marginRight: 5 }} />Alpha Wallet</strong><span>{!walletEligible ? "Alpha Wallet currently supports approved vendor listings only." : !isAuthenticated ? "Sign in to use your wallet." : !wallet.data?.hasPin ? "Set a transaction PIN in Wallet first." : `Available: ${formatNaira(wallet.data.availableBalance)} · funds are held in escrow.`}</span></span></label>
            <label className="payment-option disabled"><input type="radio" name="payment" disabled /><span><strong><CreditCard size={14} style={{ display: "inline", marginRight: 5 }} />Paystack</strong><span>Online checkout will appear here when secure gateway processing is enabled.</span></span></label>
            <label className="payment-option disabled"><input type="radio" name="payment" disabled /><span><strong><CreditCard size={14} style={{ display: "inline", marginRight: 5 }} />Flutterwave</strong><span>Online checkout will appear here when secure gateway processing is enabled.</span></span></label>
          </div>
          {paymentMethod === "wallet" ? <div className="form-field" style={{ marginTop: 16 }}><label htmlFor="transactionPin">Authorize with your 4-digit transaction PIN</label><input id="transactionPin" inputMode="numeric" type="password" pattern="\d{4}" maxLength={4} value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, ""))} placeholder="••••" required /><p className="form-help">Your wallet funds are held in escrow until delivery is confirmed.</p></div> : null}
          {submitOrder.error || walletCheckout.error ? <div className="form-error">{walletCheckout.error?.message ?? submitOrder.error?.message}</div> : null}
          <button type="submit" className="button button-primary" style={{ width: "100%", marginTop: 20 }} disabled={submitOrder.isPending || walletCheckout.isPending || !deliveryQuote.data || (paymentMethod === "wallet" && (!isAuthenticated || !wallet.data?.hasPin || transactionPin.length !== 4)) || (paymentMethod === "delivery" && !payOnDeliveryEligible)}>{submitOrder.isPending || walletCheckout.isPending ? "Authorizing your order…" : paymentMethod === "wallet" ? "Pay securely with Alpha Wallet" : "Save Pay on Delivery order"} <ArrowRight size={17} /></button>
        </form>
      </section><aside className="summary-card"><h2>Order note</h2><div className="summary-row"><span>Items</span><span>{formatNaira(totals.subtotal)}</span></div><div className="summary-row"><span>Calculated delivery</span><span>{deliveryQuote.data ? formatNaira(totals.deliveryFee) : "Select a state"}</span></div><div className="summary-row total"><span>Order total</span><span>{formatNaira(totals.total)}</span></div><div className="cod-chip"><i /> Pay on Delivery selected</div><p className="summary-note">If an eligible referral code validates, {formatNaira(REFERRAL_DISCOUNT)} is removed from the stored total shown in the confirmation.</p><p className="summary-note"><CheckCircle2 size={13} style={{ display: "inline", marginRight: 4, color: "var(--tomato)" }} />No online payment is taken for this order.</p></aside></div><p className="checkout-seller-note">Need to confirm a product detail before checking out? Contact the seller using <strong>“Ask about this product”</strong> on the product page.</p></div>
    </MarketplaceShell>
  );
}
