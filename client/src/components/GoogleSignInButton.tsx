import { apiUrl } from "@/const";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: { theme: string; size: string; width: number; text: string }): void;
    };
  };
};

let googleScriptPromise: Promise<void> | null = null;
function loadGoogleIdentityScript() {
  if ((window.google as unknown as GoogleIdentity | undefined)?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Sign-In could not load.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Sign-In could not load."));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export default function GoogleSignInButton({ returnTo }: { returnTo: string }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        const configResponse = await fetch(apiUrl("/api/auth/google/config"));
        const config = await configResponse.json() as { clientId?: string };
        if (!config.clientId) throw new Error("Google Sign-In is not configured on the server.");
        await loadGoogleIdentityScript();
        const googleIdentity = window.google as unknown as GoogleIdentity | undefined;
        if (cancelled || !buttonRef.current || !googleIdentity) return;
        googleIdentity.accounts.id.initialize({
          client_id: config.clientId,
          callback: async response => {
            setLoading(true);
            try {
              const loginResponse = await fetch(apiUrl("/api/auth/google"), {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ credential: response.credential }),
              });
              if (!loginResponse.ok) throw new Error("Google sign-in could not be completed.");
              window.location.assign(returnTo);
            } catch (loginError) {
              setLoading(false);
              toast.error(loginError instanceof Error ? loginError.message : "Google sign-in failed.");
            }
          },
        });
        buttonRef.current.replaceChildren();
        googleIdentity.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 320, text: "continue_with" });
        setLoading(false);
      } catch (setupError) {
        if (!cancelled) {
          setLoading(false);
          setError(setupError instanceof Error ? setupError.message : "Google Sign-In is unavailable.");
        }
      }
    };
    void setup();
    return () => { cancelled = true; };
  }, [returnTo]);

  return <div className="google-signin-control"><div ref={buttonRef} />{loading ? <p className="loading-line">Loading Google Sign-In…</p> : null}{error ? <p className="form-error">{error}</p> : null}</div>;
}
