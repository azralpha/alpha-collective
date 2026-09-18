import GoogleSignInButton from "@/components/GoogleSignInButton";
import MarketplaceShell from "@/components/MarketplaceShell";

export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const requestedReturnTo = params.get("returnTo");
  const returnTo = requestedReturnTo && requestedReturnTo.startsWith("/") ? requestedReturnTo : "/";

  return <MarketplaceShell><main className="page-shell"><section className="sign-in-card google-login-card"><span className="eyebrow">Alpha Market account</span><h1>Sign in with Google.</h1><p>Use your Google account to access your wallet, orders, rewards, seller tools, and profile.</p><GoogleSignInButton returnTo={returnTo} /></section></main></MarketplaceShell>;
}
