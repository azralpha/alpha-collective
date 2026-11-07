import { useEffect, useRef, useState } from "react";

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
const SCRIPT_ID = "alpha-market-cloudflare-turnstile";
let loadPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const loaded = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not initialize."));
    const failed = () => reject(new Error("Turnstile could not be loaded."));

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch(error => {
    loadPromise = null;
    document.getElementById(SCRIPT_ID)?.remove();
    throw error;
  });

  return loadPromise;
}

export default function CloudflareTurnstile({
  action,
  onToken,
  resetKey = 0,
}: {
  action: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [message, setMessage] = useState("");

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let disposed = false;
    let widgetId: string | null = null;
    onTokenRef.current(null);
    setMessage("");

    if (!SITE_KEY) {
      setMessage("Security verification is not configured. Please try again later.");
      return () => { disposed = true; };
    }

    void loadTurnstile().then(api => {
      const container = containerRef.current;
      if (disposed || !container) return;
      widgetId = api.render(container, {
        sitekey: SITE_KEY,
        action,
        callback: token => {
          onTokenRef.current(token);
          setMessage("");
        },
        "error-callback": () => {
          onTokenRef.current(null);
          setMessage("Security verification could not load. Refresh the page and try again.");
        },
        "expired-callback": () => {
          onTokenRef.current(null);
          setMessage("Security verification expired. Please complete it again.");
        },
      });
    }).catch(() => {
      if (disposed) return;
      onTokenRef.current(null);
      setMessage("Security verification could not load. Check your connection and try again.");
    });

    return () => {
      disposed = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, resetKey]);

  return (
    <div className="turnstile-container">
      <div ref={containerRef} aria-label="Cloudflare security verification" />
      {message ? <p className="form-error" role="status">{message}</p> : null}
    </div>
  );
}
