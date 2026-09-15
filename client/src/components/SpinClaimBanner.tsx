import { useCart } from "@/contexts/CartContext";
import { clearSpinClaim, getStoredSpinClaim, type StoredSpinClaim } from "@/lib/spinPromotion";
import { trpc } from "@/lib/trpc";
import { formatNaira, getCartSubtotal, MARKETPLACE_PRODUCTS, type MarketplaceProduct } from "@shared/marketplace";
import { Gift, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function SpinClaimBanner() {
  const { items } = useCart();
  const [claim, setClaim] = useState<StoredSpinClaim | null>(() => getStoredSpinClaim());
  const [now, setNow] = useState(Date.now());
  const catalogue = trpc.marketplace.publicProducts.useQuery(undefined, { staleTime: 0, refetchOnWindowFocus: true });
  const catalog = useMemo<MarketplaceProduct[]>(() => [...MARKETPLACE_PRODUCTS, ...(catalogue.data ?? [])], [catalogue.data]);
  const subtotal = useMemo(() => getCartSubtotal(items, catalog), [catalog, items]);
  useEffect(() => {
    const sync = () => setClaim(getStoredSpinClaim());
    window.addEventListener("alpha-spin-claim", sync);
    const timer = window.setInterval(() => { setNow(Date.now()); sync(); }, 1_000);
    return () => { window.removeEventListener("alpha-spin-claim", sync); window.clearInterval(timer); };
  }, []);
  if (!claim) return null;
  const expiresIn = new Date(claim.expiresAt).getTime() - now;
  if (expiresIn <= 0) { clearSpinClaim(); return null; }
  const remaining = Math.max(0, claim.minimumSpend - subtotal);
  const minutes = Math.floor(expiresIn / 60_000);
  const seconds = Math.floor((expiresIn % 60_000) / 1_000);
  return <aside className="spin-claim-banner" aria-live="polite"><Gift size={18} aria-hidden="true" /><div><strong>Prize claimed: {claim.rewardName}</strong><span>{remaining > 0 ? `Add ${formatNaira(remaining)} more to unlock your gift.` : "Your cart meets the spend target; choose a verified online payment method at checkout."} {minutes}:{String(seconds).padStart(2, "0")} remaining.</span></div><button type="button" onClick={() => setClaim(null)} aria-label="Hide prize countdown"><X size={17} /></button></aside>;
}
