import { useState } from "react";
import { apiUrl } from "@/const";
import CloudflareTurnstile from "@/components/CloudflareTurnstile";

type GoogleStartResponse = {
  authorizationUrl?: unknown;
  error?: unknown;
};

export default function GoogleSignInButton({ returnTo }: { returnTo: string }) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [challengeVersion, setChallengeVersion] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const startGoogleLogin = async () => {
    if (!turnstileToken || isStarting) return;
    const destination = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/profile";
    setIsStarting(true);
    setError("");

    try {
      const response = await fetch(apiUrl("/api/auth/google/start"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo: destination, turnstileToken }),
      });
      const payload = await response.json() as GoogleStartResponse;
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Google sign-in could not be started.");
      }
      if (typeof payload.authorizationUrl !== "string") throw new Error("Google sign-in could not be started.");

      const authorizationUrl = new URL(payload.authorizationUrl);
      if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "accounts.google.com") {
        throw new Error("Google sign-in returned an invalid destination.");
      }
      window.location.assign(authorizationUrl.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started. Please try again.");
    } finally {
      setTurnstileToken(null);
      setChallengeVersion(version => version + 1);
      setIsStarting(false);
    }
  };

  return (
    <div className="google-signin-challenge">
      <CloudflareTurnstile action="google_signin" onToken={setTurnstileToken} resetKey={challengeVersion} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button
        className="button button-primary google-login-button"
        type="button"
        onClick={() => void startGoogleLogin()}
        disabled={isStarting || !turnstileToken}
      >
        {isStarting ? "Starting sign-in…" : "Continue with Google"}
      </button>
    </div>
  );
}
