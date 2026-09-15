import { dismissSpinPopup, getSpinVisitorId, hasDismissedSpinPopup, saveSpinClaim } from "@/lib/spinPromotion";
import { trpc } from "@/lib/trpc";
import { Gift, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ClaimResponse = { enabled: boolean; claimed: boolean; claimToken?: string; rewardName?: string; rewardItemId?: string; minimumSpend?: number; expiresAt?: string; reason?: string };

function drawWheel(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 8;
  const prizes = ["FREE GIFT", "BONUS", "GIFT", "REWARD", "SURPRISE", "PRIZE"];
  const colours = ["#f74635", "#ffb521", "#006a47", "#e85f2c", "#0c8558", "#ffc849"];
  context.clearRect(0, 0, size, size);
  prizes.forEach((prize, index) => {
    const start = -Math.PI / 2 + index * Math.PI / 3;
    const end = start + Math.PI / 3;
    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius, start, end);
    context.closePath();
    context.fillStyle = colours[index];
    context.fill();
    context.save();
    context.translate(center, center);
    context.rotate(start + Math.PI / 6);
    context.fillStyle = index === 1 || index === 5 ? "#183427" : "#fffdf3";
    context.font = "800 12px DM Mono, monospace";
    context.textAlign = "right";
    context.fillText(prize, radius - 16, 4);
    context.restore();
  });
  context.beginPath();
  context.arc(center, center, 38, 0, Math.PI * 2);
  context.fillStyle = "#fffdf3";
  context.fill();
  context.strokeStyle = "#104b35";
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = "#104b35";
  context.font = "900 11px DM Mono, monospace";
  context.textAlign = "center";
  context.fillText("SPIN", center, center + 4);
}

export default function SpinToWinPromotion() {
  const settings = trpc.marketplace.spinPromotion.publicSettings.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: true });
  const canvas = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [claim, setClaim] = useState<ClaimResponse | null>(null);

  useEffect(() => { drawWheel(canvas.current); }, []);
  useEffect(() => {
    if (!settings.data?.enabled || hasDismissedSpinPopup()) return;
    const show = () => setOpen(true);
    const timeout = window.setTimeout(show, 5_000);
    const exitIntent = (event: MouseEvent) => { if (event.clientY <= 0) show(); };
    document.addEventListener("mouseleave", exitIntent);
    return () => { window.clearTimeout(timeout); document.removeEventListener("mouseleave", exitIntent); };
  }, [settings.data?.enabled]);

  const close = () => { dismissSpinPopup(); setOpen(false); };
  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      const response = await fetch("/api/rewards/spin-claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitorId: getSpinVisitorId() }) });
      const data = await response.json() as ClaimResponse;
      await new Promise(resolve => window.setTimeout(resolve, 3_000));
      if (!response.ok || !data.claimed || !data.claimToken || !data.rewardName || !data.rewardItemId || !data.minimumSpend || !data.expiresAt) {
        toast.error(data.reason === "no_eligible_gift" ? "No profit-qualified gift is available right now." : "This promotion is temporarily unavailable.");
        return;
      }
      saveSpinClaim({ claimToken: data.claimToken, rewardName: data.rewardName, rewardItemId: data.rewardItemId, minimumSpend: data.minimumSpend, expiresAt: data.expiresAt });
      setClaim(data);
      window.dispatchEvent(new Event("alpha-spin-claim"));
    } catch {
      toast.error("We could not prepare your prize. Please try again later.");
    } finally {
      setSpinning(false);
    }
  };

  if (!settings.data?.enabled || !open) return null;
  return <div className="spin-modal-backdrop" role="presentation"><section className="spin-modal" role="dialog" aria-modal="true" aria-labelledby="spin-title"><button type="button" className="spin-close" onClick={close} aria-label="Close Spin to Win promotion"><X size={18} /></button>{claim ? <div className="spin-result"><span className="eyebrow"><Sparkles size={14} /> Your offer</span><Gift size={38} aria-hidden="true" /><h2 id="spin-title">{claim.rewardName}</h2><p>Add qualifying items worth at least <strong>₦{claim.minimumSpend?.toLocaleString("en-NG")}</strong> before the countdown ends. The final gift is checked against current availability and protected profit at checkout.</p><button type="button" className="button button-primary" onClick={close}>Start shopping</button></div> : <><span className="eyebrow"><Sparkles size={14} /> Limited-time store offer</span><h2 id="spin-title">Spin to reveal your eligible gift.</h2><p>This promotion reveals one server-validated offer. It is not a game of chance: your prize, time limit, cart total, stock and profit checks are stated before checkout.</p><div className={`spin-wheel ${spinning ? "is-spinning" : ""}`}><span className="spin-pointer" aria-hidden="true" /><canvas ref={canvas} width="300" height="300" aria-label="Six-segment promotional prize wheel" /></div><button type="button" className="button button-primary spin-now-button" onClick={spin} disabled={spinning}>{spinning ? "Revealing your offer…" : "Spin now"}</button><small><ShieldCheck size={13} /> Offers are attached only after verified payment; no supplier order is created automatically.</small></>}</section></div>;
}
