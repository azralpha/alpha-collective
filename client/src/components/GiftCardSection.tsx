import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { Gift, LockKeyhole, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const cards = [
  { amount: 1_000, tone: "from-emerald-950 to-emerald-700" },
  { amount: 10_000, tone: "from-amber-950 to-amber-700" },
  { amount: 50_000, tone: "from-emerald-900 to-lime-700" },
];

export default function GiftCardSection() {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedAmount, setSelectedAmount] = useState(10_000);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [code, setCode] = useState("");
  const [cartTotal, setCartTotal] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const purchase = trpc.giftCards.initiatePurchase.useMutation({ onSuccess: result => window.location.assign(result.authorizationUrl), onError: error => toast.error(error.message) });
  const redeem = trpc.giftCards.redeem.useMutation({ onSuccess: result => { setShowRedeem(false); setCode(""); setCaptchaToken(""); setFailedAttempts(0); toast.success(`${formatNaira(result.appliedAmount)} applied. ${result.remainingCartBalance ? `Pay ${formatNaira(result.remainingCartBalance)} with Flutterwave.` : "Your cart is fully covered."}`); }, onError: error => { setFailedAttempts(value => value + 1); toast.error(error.message); } });
  return <section className="mt-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><span className="eyebrow text-emerald-800">Digital gifting</span><h2 className="mt-1 text-lg font-extrabold text-emerald-950">Make a moment feel personal.</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Preview the Alpha Market gift-card range. Cards are issued after secure Flutterwave payment and delivered to the recipient by email.</p></div><Gift className="text-amber-700" size={24} /></div>
    <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Gift card amounts">
      {cards.map(card => <div key={card.amount} className={`min-w-[180px] snap-start rounded-2xl bg-gradient-to-br ${card.tone} p-4 text-left text-white shadow-md`}><span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">ALPHA MARKET</span><strong className="mt-8 block text-2xl">{formatNaira(card.amount)}</strong><span className="mt-1 block text-xs text-white/75">Digital preview · non-clickable value</span></div>)}
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><button className="button button-primary" type="button" onClick={() => setShowPurchase(true)}>Buy Gift Card</button><button className="button button-secondary" type="button" onClick={() => setShowRedeem(true)}>Redeem Code</button></div>
    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><LockKeyhole size={13} /> Store credit only. Gift-card balances are non-refundable for cash.</p>
    {showPurchase && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="gift-card-purchase-title"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><span className="eyebrow">Secure checkout</span><h3 id="gift-card-purchase-title" className="mt-1 text-lg font-extrabold">Buy a {formatNaira(selectedAmount)} gift card</h3></div><button className="icon-only-button" aria-label="Close purchase dialog" onClick={() => setShowPurchase(false)}><X size={18} /></button></div><label className="mt-5 block text-sm font-semibold text-slate-800">Recipient email<input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} placeholder="recipient@example.com" required /></label><p className="mt-3 text-xs leading-5 text-slate-500">You must be signed in to a verified account. Flutterwave may request 3D Secure bank authentication before payment completes.</p><button className="button button-primary mt-4 w-full" disabled={purchase.isPending || !recipientEmail} onClick={() => purchase.mutate({ amount: selectedAmount, recipientEmail })}>{purchase.isPending ? "Opening secure checkout…" : "Continue to Flutterwave"}</button></div></div>}
    {showRedeem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="gift-card-redeem-title"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><span className="eyebrow">Apply store credit</span><h3 id="gift-card-redeem-title" className="mt-1 text-lg font-extrabold">Redeem your code</h3></div><button className="icon-only-button" aria-label="Close redeem dialog" onClick={() => setShowRedeem(false)}><X size={18} /></button></div><label className="mt-5 block text-sm font-semibold text-slate-800">Gift-card code<input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 uppercase" value={code} onChange={event => setCode(event.target.value)} placeholder="ALPHA-9821-K89X-3300" required /></label><label className="mt-3 block text-sm font-semibold text-slate-800">Current cart total<input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" type="number" min="1" value={cartTotal} onChange={event => setCartTotal(event.target.value)} placeholder="e.g. 15000" required /></label>{failedAttempts >= 2 ? <label className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Security check<input className="mt-1 h-11 w-full rounded-xl border border-amber-200 bg-white px-3" value={captchaToken} onChange={event => setCaptchaToken(event.target.value)} placeholder="Complete CAPTCHA and paste its token" required /><small className="mt-1 block text-xs font-normal">A CAPTCHA is required after two failed code attempts.</small></label> : null}<button className="button button-primary mt-4 w-full" disabled={redeem.isPending || !code || !cartTotal || (failedAttempts >= 2 && !captchaToken)} onClick={() => redeem.mutate({ code, cartTotal: Number(cartTotal), captchaToken: captchaToken || undefined })}>{redeem.isPending ? "Checking code…" : "Apply gift card"}</button></div></div>}
  </section>;
}
