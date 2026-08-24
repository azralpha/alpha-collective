import MarketplaceShell from "@/components/MarketplaceShell";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AdminWalletOrders() {
  const utils = trpc.useUtils();
  const orders = trpc.marketplace.admin.walletOrders.useQuery();
  const release = trpc.marketplace.admin.markWalletOrderDelivered.useMutation({ onSuccess: async data => { await utils.marketplace.admin.walletOrders.invalidate(); toast.success(`Escrow released to ${data.releasedVendors.length} vendor wallet(s).`); } });
  return <MarketplaceShell><div className="page-shell"><section style={{ marginTop: 32 }}><span className="eyebrow">Administrator</span><h1 className="page-title">Wallet escrow orders.</h1><p className="section-kicker">Confirm delivery only after the buyer receives the order. This action releases held earnings to the applicable vendor wallets.</p></section><section className="wallet-ledger" style={{ marginTop: 24 }}>{orders.isLoading ? <p className="loading-line">Loading held wallet orders…</p> : orders.error ? <div className="form-error">{orders.error.message}</div> : orders.data?.length ? <div className="wallet-ledger-list">{orders.data.map(order => <div className="wallet-ledger-row" key={order.reference}><div><strong>{order.reference} · {formatNaira(order.total)}</strong><span>{order.buyerName} · {order.deliveryAddress}</span></div><button className="button button-primary" onClick={() => release.mutate({ reference: order.reference })} disabled={release.isPending}><CheckCircle2 size={16} /> Mark delivered & release</button></div>)}</div> : <div className="empty-panel"><ShieldCheck size={24} /><h2>No held wallet orders.</h2><p>Wallet orders awaiting delivery confirmation will appear here.</p></div>}</section></div></MarketplaceShell>;
}
