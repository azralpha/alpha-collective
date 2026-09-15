import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const defaultApiOrigin = import.meta.env.DEV ? "" : "https://alpha-giddy-main.onrender.com";
export const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN ?? defaultApiOrigin).replace(/\/+$/, "");

export const apiUrl = (path: string) => `${API_ORIGIN}${path}`;

// Start OAuth on the API host. The backend creates the nonce cookie and later
// the session cookie on the same Render origin, avoiding a split-origin OAuth
// handshake between Cloudflare Pages and Render.
export const startLogin = () => {
  const currentOrigin = window.location.origin;
  const returnTo = `${currentOrigin}${window.location.pathname}${window.location.search}`;
  const url = new URL(apiUrl("/api/oauth/start"), window.location.origin);
  url.searchParams.set("returnTo", returnTo);
  window.location.href = url.toString();
};

// Kept as a named export for compatibility with code that imports OAuth state
// helpers from this module. OAuth state is now created server-side.
export { OAUTH_STATE_COOKIE, encodeOAuthState };
