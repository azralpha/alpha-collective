import { useState } from "react";
import { Link } from "wouter";

const CONSENT_KEY = "alpha-market-cookie-consent-v1";

export default function CookieConsent() {
  const [accepted, setAccepted] = useState(() => window.localStorage.getItem(CONSENT_KEY) === "accepted");
  if (accepted) return null;
  const accept = () => { window.localStorage.setItem(CONSENT_KEY, "accepted"); setAccepted(true); };
  return <aside className="cookie-consent" aria-label="Cookie notice"><p>We use cookies to ensure you get the best shopping experience on Alpha Market. By continuing to use our platform, you agree to our <Link href="/terms-of-use">Terms of Use</Link> and <Link href="/privacy-policy">Privacy Policy</Link>.</p><button className="button button-primary" onClick={accept}>Accept</button></aside>;
}
