import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { Clock3, Copy, Gift, Gamepad2, Loader2, Search, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const tabs = [
  { id: "games", label: "App & Game Milestones", icon: Gamepad2, provider: "Torox / PubScale" },
  { id: "surveys", label: "Surveys & Research", icon: Search, provider: "BitLabs / CPX Research" },
  { id: "microtasks", label: "Quick Microtasks", icon: Sparkles, provider: "TimeWall / Lootably" },
  { id: "referrals", label: "Invite & Earn", icon: Share2, provider: "Referral rewards" },
] as const;

function HoldCountdown({ holdUntil }: { holdUntil: Date | string | null }) {
  const [remaining, setRemaining] = useState(() => holdUntil ? Math.max(0, new Date(holdUntil).getTime() - Date.now()) : 0);
  useEffect(() => { if (!holdUntil) return; const timer = window.setInterval(() => setRemaining(Math.max(0, new Date(holdUntil).getTime() - Date.now())), 1000); return () => window.clearInterval(timer); }, [holdUntil]);
  if (!holdUntil || remaining <= 0) return <span className="task-status completed">Releasing soon</span>;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return <span className="task-hold"><Clock3 size={13} /> {hours}h {minutes}m hold</span>;
}

export default function Task2Earn() {
  const { isAuthenticated, loading, user } = useAuth();
  const dashboard = trpc.taskRewards.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const referral = trpc.marketplace.createReferralShare.useMutation({ onSuccess: result => { const link = `${window.location.origin}/?ref=${result.shareCode}`; void navigator.clipboard?.writeText(link); toast.success("Referral link copied to your clipboard."); }, onError: error => toast.error(error.message) });
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("games");
  const active = tabs.find(tab => tab.id === activeTab) ?? tabs[0];
  const taskActivity = useMemo(() => dashboard.data?.tasks.slice(0, 4) ?? [], [dashboard.data]);
  if (loading) return <MarketplaceShell><main className="page-shell"><p className="loading-line">Loading Task 2 Earn…</p></main></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><main className="page-shell"><section className="sign-in-card"><ShieldCheck size={34} /><span className="eyebrow">Task 2 Earn</span><h1>Turn time into store credit.</h1><p>Sign in to access verified tasks, referral rewards, and your protected earnings history.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to continue</button></section></main></MarketplaceShell>;
  const data = dashboard.data;
  return <MarketplaceShell><main className="page-shell task-earn-page">
    <section className="task-earn-hero"><div><span className="eyebrow eyebrow-dark">Alpha Market · Task 2 Earn</span><h1>Earn your next checkout.</h1><p>Complete useful tasks, answer research surveys, or invite trusted friends. Rewards become Alpha store credit after provider verification.</p></div><Gift size={42} /></section>
    <section className="task-credit-summary" aria-label="Task credit summary"><div><span>Available store credit</span><strong>{formatNaira(data?.availableCredit ?? 0)}</strong><small>Ready to use at checkout</small></div><div><span>Pending credit</span><strong>{formatNaira(data?.pendingCredit ?? 0)}</strong><small>Held for provider verification</small></div><div><span>Signed in as</span><strong>{user?.name || user?.email || "Verified member"}</strong><small>Secure user-bound tracking</small></div></section>
    <section className="task-earn-layout"><div className="task-offer-panel"><div className="panel-heading"><div><span className="eyebrow">Offerwall hub</span><h2>Choose a way to earn.</h2></div><ShieldCheck size={22} /></div><div className="task-tabs" role="tablist">{tabs.map(tab => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "task-tab active" : "task-tab"} onClick={() => setActiveTab(tab.id)}><tab.icon size={17} /><span>{tab.label}</span></button>)}</div><div className="task-offer-container"><div className="task-offer-title"><div><span className="eyebrow">{active.provider}</span><h3>{active.label}</h3></div><span className="task-user-token">subId: {user?.id}</span></div>{activeTab === "referrals" ? <div className="task-referral-box"><Share2 size={25} /><h3>Invite trusted shoppers.</h3><p>Your referral link connects into the same protected reward ledger. Bonuses are held until the referred shopper completes an eligible order.</p><button className="button button-primary" disabled={referral.isPending} onClick={() => referral.mutate({ channel: "other" })}>{referral.isPending ? "Creating secure link…" : "Create referral link"}</button></div> : <div className="task-provider-placeholder"><Loader2 size={25} /><h3>Provider container ready</h3><p>Connect the {active.provider} SDK or embed here. Provider callbacks must include the signed user ID and transaction ID before any credit is issued.</p><span>Available after provider configuration</span></div>}</div></div><aside className="task-activity-panel"><div className="panel-heading"><div><span className="eyebrow">Live activity</span><h2>Recent earnings</h2></div><Clock3 size={21} /></div>{taskActivity.length ? <div className="task-activity-list">{taskActivity.map(task => <div className="task-activity-row" key={task.externalTxId}><div><strong>{task.taskName || "Provider task"}</strong><small>{task.provider} · {new Date(task.createdAt).toLocaleDateString()}</small></div><span>{formatNaira(task.payoutAmount)}</span></div>)}</div> : <div className="task-empty"><Sparkles size={25} /><h3>Your activity will appear here.</h3><p>Start a verified task to see pending and completed rewards.</p></div>}</aside></section>
    <section className="task-history-panel"><div className="panel-heading"><div><span className="eyebrow">Earnings ledger</span><h2>Task history</h2></div><span className="task-ledger-note">Rewards are store credit only</span></div>{data?.tasks.length ? <div className="task-table-wrap"><table className="task-table"><thead><tr><th>Date</th><th>Provider</th><th>Task</th><th>Earned</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.tasks.map(task => <tr key={task.externalTxId}><td>{new Date(task.createdAt).toLocaleDateString()}</td><td>{task.provider}</td><td>{task.taskName || "Provider task"}</td><td>{formatNaira(task.payoutAmount)}</td><td>{task.status === "PENDING" ? <HoldCountdown holdUntil={task.holdUntil} /> : <span className={`task-status ${task.status.toLowerCase()}`}>{task.status}</span>}</td><td><a href="mailto:support@alphamarket.ng?subject=Task reward support" className="task-support-link">Support</a></td></tr>)}</tbody></table></div> : <div className="task-empty"><Gamepad2 size={28} /><h3>No task transactions yet.</h3><p>Provider completions and referral rewards will be logged here with their verification status.</p></div>}</section>
  </main></MarketplaceShell>;
}
