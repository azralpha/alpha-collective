export function getPublicAppUrl() {
  const configured = process.env.PUBLIC_APP_URL;
  if (!configured) throw new Error("PUBLIC_APP_URL is not configured.");
  const url = new URL(configured);
  if (url.protocol !== "https:" || !url.hostname) throw new Error("PUBLIC_APP_URL must be a published HTTPS URL.");
  return url;
}

export function nowPaymentsIpnCallbackUrl() {
  return new URL("/api/webhooks/nowpayments", getPublicAppUrl()).toString();
}
