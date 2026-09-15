import { Mail, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { apiUrl } from "@/const";

export default function NewsletterSubscribe() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/marketing/subscribe"), { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json() as { subscribed?: boolean; error?: string };
      if (!response.ok || !payload.subscribed) throw new Error(payload.error || "Newsletter signup is unavailable right now.");
      setEmail("");
      toast.success("You are on the Alpha VIP list.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Newsletter signup is unavailable right now.");
    } finally { setIsSubmitting(false); }
  };
  return <section className="newsletter-footer-signup" aria-labelledby="newsletter-title"><span className="newsletter-footer-icon"><Mail size={17} /></span><h2 id="newsletter-title">Join the Alpha VIP list.</h2><p>Exclusive tech drops and practical discounts, sent only when there is something worth seeing.</p><form onSubmit={submit}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /><button type="submit" disabled={isSubmitting}>{isSubmitting ? "Joining…" : <><Send size={15} /> Join</>}</button></form><small>By joining, you agree to receive Alpha Market marketing email. Unsubscribe anytime. <a href="/privacy-policy">Privacy Policy</a></small></section>;
}
