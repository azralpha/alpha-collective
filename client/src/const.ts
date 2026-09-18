export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const defaultApiOrigin = import.meta.env.DEV ? "" : "https://alpha-giddy-main.onrender.com";
export const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN ?? defaultApiOrigin).replace(/\/+$/, "");

export const apiUrl = (path: string) => `${API_ORIGIN}${path}`;

export const startLogin = () => {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
};
