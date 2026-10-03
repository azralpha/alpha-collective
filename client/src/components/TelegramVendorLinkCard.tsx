import { trpc } from "@/lib/trpc";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

export default function TelegramVendorLinkCard() {
  const link = trpc.telegramInquiries.vendorLink.useQuery();
  if (link.isLoading || link.error || !link.data) return null;
  return (
    <section className="telegram-vendor-card" aria-labelledby="telegram-vendor-title">
      <div>
        <span className="eyebrow"><Link2 size={13} /> Telegram buyer questions</span>
        <h2 id="telegram-vendor-title">Connect your seller chat.</h2>
        <p>{link.data.linked ? "Telegram is connected. Buyer questions will arrive in your private chat." : "Open this link with the Telegram account that should receive buyer questions."}</p>
      </div>
      <div className="telegram-vendor-actions">
        <a className="button button-primary" href={link.data.link} target="_blank" rel="noreferrer">{link.data.linked ? "Open Telegram" : "Link Telegram"}</a>
        <button className="button button-secondary" type="button" onClick={() => { void navigator.clipboard?.writeText(link.data.link); toast.success("Telegram vendor link copied."); }}><Copy size={15} /> Copy link</button>
      </div>
    </section>
  );
}
