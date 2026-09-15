import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Building2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { apiUrl } from "@/const";

type VerifiedBank = { bankName: string; accountNumberMasked: string; accountName: string };

export default function BankVerificationWidget({ existing }: { existing?: VerifiedBank | null }) {
  const current = trpc.marketplace.bankVerification.status.useQuery();
  const banks = trpc.marketplace.bankVerification.listBanks.useQuery();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [verified, setVerified] = useState<VerifiedBank | null>(existing ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!verified && current.data?.locked) setVerified({ bankName: current.data.bankName, accountNumberMasked: current.data.accountNumberMasked, accountName: current.data.accountName });
  }, [current.data, verified]);

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/verify-bank-account"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; bankName?: string; accountNumberMasked?: string; accountName?: string };
      if (!response.ok || !payload.bankName || !payload.accountNumberMasked || !payload.accountName) throw new Error(payload.error ?? "The bank account could not be verified.");
      const result = { bankName: payload.bankName, accountNumberMasked: payload.accountNumberMasked, accountName: payload.accountName };
      setVerified(result);
      setAccountNumber("");
      toast.success("Bank account verified and locked for payout protection.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The bank account could not be verified.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verified) return <div className="bank-verification-card bank-verification-success" role="status"><div className="bank-verification-heading"><BadgeCheck size={20} /><div><strong>Bank account verified</strong><span>{verified.bankName} · {verified.accountNumberMasked}</span></div></div><p>Account name returned by Flutterwave: <strong>{verified.accountName}</strong></p><small>This payout account is locked after name matching. Contact Alpha Market support if it needs a controlled change.</small></div>;

  return <div className="bank-verification-card"><div className="bank-verification-heading"><ShieldCheck size={20} /><div><strong>Verify your Nigerian bank account</strong><span>Flutterwave will confirm the account name. Alpha Market stores only the masked account number and payout reference.</span></div></div><form onSubmit={verify} className="bank-verification-form"><label>Bank<select value={bankCode} onChange={event => setBankCode(event.target.value)} required disabled={banks.isLoading || isSubmitting}><option value="">Select your bank</option>{banks.data?.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label><label>10-digit account number<input inputMode="numeric" autoComplete="off" value={accountNumber} onChange={event => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="0123456789" pattern="\d{10}" maxLength={10} required disabled={isSubmitting} /></label><button className="button button-primary" type="submit" disabled={isSubmitting || banks.isLoading || accountNumber.length !== 10 || !bankCode}>{isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Checking account…</> : <><Building2 size={16} /> Verify account</>}</button></form><p className="bank-verification-help">Your raw account number is sent only over HTTPS to the verification service and is not retained in Alpha Market’s database.</p>{banks.error ? <p className="form-error">{banks.error.message}</p> : null}</div>;
}
