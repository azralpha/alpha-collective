import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, FileKey2, Loader2, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

async function readKycFile(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Choose a non-empty ID image that is 5 MB or smaller.");
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error("Use a JPG, PNG, or WebP image for your government ID.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected ID image could not be read."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The selected ID image could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function KycVerification() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const status = trpc.marketplace.kyc.status.useQuery(undefined, { enabled: isAuthenticated });
  const submit = trpc.marketplace.kyc.submitGovernmentId.useMutation({
    onSuccess: async result => { await utils.marketplace.kyc.status.invalidate(); toast.success(result.message); },
  });
  const [legalName, setLegalName] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const submitKyc = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!idFile) return toast.error("Choose a clear government ID image first.");
    try { await submit.mutateAsync({ legalName, imageDataUrl: await readKycFile(idFile) }); setIdFile(null); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Your KYC submission could not be saved."); }
  };
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => setIdFile(event.target.files?.[0] ?? null);

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading KYC verification…</p></div></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 36 }}><ShieldCheck size={28} /><h2>Verify your account securely.</h2><p>Sign in to submit a KYC verification request for Alpha Collective.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to continue <ArrowRight size={17} /></button></div></div></MarketplaceShell>;
  const profile = status.data;
  const verified = profile?.status === "verified";

  return <MarketplaceShell><div className="page-shell"><section className="kyc-hero"><span className="eyebrow">Account security</span><h1 className="page-title">KYC Verification.</h1><p>Vendors need verified identity and a name-matched Nigerian bank account before requesting a withdrawal. Buyers need this verification only before Pay on Delivery orders.</p><div className="kyc-status"><ShieldCheck size={19} /><div><strong>{verified ? "KYC verified" : profile?.status === "identity_pending" ? "Identity verification pending" : "KYC not verified"}</strong><span>{verified ? "Your verified bank account is locked for wallet withdrawals." : "No bank transfer can be initiated from this page."}</span></div></div></section>
    <section className="kyc-grid"><article className="summary-card"><span className="eyebrow">Step 1 · identity</span><h2>Government ID submission.</h2><p className="summary-note">Submit the legal name printed on your government ID and one clear image. The ID is stored through private server-side storage and is never displayed publicly.</p>{profile?.hasGovernmentId ? <p className="kyc-note"><BadgeCheck size={16} /> ID document received. {profile.status === "identity_pending" ? "Provider verification is pending configuration." : "Identity review status is available above."}</p> : <form onSubmit={submitKyc} className="product-form" style={{ border: 0, padding: 0, marginTop: 20 }}><div className="form-field"><label htmlFor="kycLegalName">Full legal name</label><input id="kycLegalName" value={legalName} onChange={event => setLegalName(event.target.value)} minLength={3} maxLength={160} placeholder="Exactly as shown on your ID" required /></div><div className="form-field" style={{ marginTop: 14 }}><label htmlFor="kycGovernmentId">Government ID image</label><input id="kycGovernmentId" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} required /><p className="form-help">JPG, PNG, or WebP; maximum 5 MB. Do not submit another person’s document.</p></div><button className="button button-primary" style={{ marginTop: 18 }} disabled={submit.isPending}>{submit.isPending ? <><Loader2 size={16} className="animate-spin" /> Securing submission…</> : <><FileKey2 size={16} /> Submit government ID</>}</button>{submit.error ? <p className="form-error">{submit.error.message}</p> : null}</form>}</article>
      <article className="summary-card"><span className="eyebrow">Step 2 · bank binding</span><h2>Verified bank account.</h2><p className="summary-note">After Smile ID confirms the legal identity, Alpha Wallet will compare the verified legal name with the name returned by Nigerian bank-account resolution. Only a matched account can be locked as the payout destination.</p><div className="kyc-note"><LockKeyhole size={16} /> This second step is intentionally unavailable until the identity provider is connected and verifies Step 1.</div><Link href="/wallet" className="button button-secondary" style={{ marginTop: 20 }}>View Alpha Wallet <ArrowRight size={16} /></Link></article>
    </section><section className="published-edit-notice" style={{ marginTop: 24 }}><ShieldAlert size={21} /><div><strong>Verification is not a payment action.</strong><p>Identity verification, email OTP delivery, and live Smile ID checks are not activated until their respective secure providers and public callbacks are configured. Alpha Collective will not simulate a verified result or initiate a transfer.</p></div></section></div></MarketplaceShell>;
}
