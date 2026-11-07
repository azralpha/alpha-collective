export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Use the current origin by default. In production this keeps auth cookies first-party
// when the app is served through its custom domain and proxies API routes to Render.
export const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/+$/, "");

export const apiUrl = (path: string) => `${API_ORIGIN}${path}`;

export const startLogin = () => {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
};
