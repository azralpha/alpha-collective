import MarketplaceShell from "@/components/MarketplaceShell";
import BankVerificationWidget from "@/components/BankVerificationWidget";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function KycVerification() {
  const { isAuthenticated, loading } = useAuth();
  const status = trpc.profile.diditStatus.useQuery(undefined, { enabled: isAuthenticated });
  const startDidit = trpc.profile.startDiditVerification.useMutation({
    onSuccess: result => window.location.assign(result.url),
    onError: error => toast.error(error.message),
  });

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading identity verification…</p></div></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 36 }}><ShieldCheck size={28} /><h2>Verify your account securely.</h2><p>Sign in to complete Alpha Market identity verification with Didit.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to continue <ArrowRight size={17} /></button></div></div></MarketplaceShell>;

  const current = status.data;
  const identityVerified = current?.status === "identity_verified" || current?.status === "verified";
  const pending = current?.status === "identity_pending";
  const rejected = current?.status === "rejected";

  return <MarketplaceShell><div className="page-shell"><section className="kyc-hero"><span className="eyebrow">Account security</span><h1 className="page-title">Identity verification.</h1><p>Alpha Market uses Didit’s secure hosted flow for buyer and vendor identity checks. You will leave Alpha Market briefly and return here when the flow is complete.</p><div className="kyc-status"><ShieldCheck size={19} /><div><strong>{identityVerified ? "Identity verified" : pending ? "Verification in progress" : rejected ? "Verification needs another attempt" : "Identity verification required"}</strong><span>{identityVerified ? "Your Didit identity result is recorded securely." : "Complete identity verification before protected account actions."}</span></div></div></section>
    <section className="kyc-grid"><article className="summary-card"><span className="eyebrow">Step 1 · Didit identity check</span><h2>Verify securely with Didit.</h2><p className="summary-note">Didit guides you through the required identity checks on a secure, mobile-friendly page. Alpha Market receives the verification result, not your raw identity documents.</p><div className="didit-urgency"><strong>Limited free verifications this month (500 total).</strong><span>Verify early to secure your spot.</span></div>{identityVerified ? <p className="kyc-note"><BadgeCheck size={16} /> Identity verification complete.</p> : <button className="button button-primary" style={{ marginTop: 20 }} disabled={startDidit.isPending} onClick={() => startDidit.mutate()}>{startDidit.isPending ? "Opening secure verification…" : pending ? "Continue Didit verification" : rejected ? "Try verification again" : "Start Didit verification"}<ExternalLink size={16} /></button>}</article>
      <article className="summary-card"><span className="eyebrow">Step 2 · bank binding</span><h2>Verified bank account.</h2><p className="summary-note">Flutterwave resolves the Nigerian account name and compares it with your Alpha Market profile. Only a matched account can be locked as the payout destination.</p><BankVerificationWidget /><Link href="/wallet" className="button button-secondary" style={{ marginTop: 20 }}>View Alpha Wallet <ArrowRight size={16} /></Link></article>
    </section><section className="published-edit-notice" style={{ marginTop: 24 }}><ShieldAlert size={21} /><div><strong>Verification is not a payment action.</strong><p>Didit identity review and bank-account name matching use separate secure controls. Alpha Market will not simulate a verified result or initiate a transfer.</p></div></section></div></MarketplaceShell>;
}
