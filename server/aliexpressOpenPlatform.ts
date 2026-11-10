import { createHmac } from "node:crypto";

const ALIEXPRESS_API_ORIGIN = "https://api-sg.aliexpress.com";
const REQUEST_TIMEOUT_MS = 20_000;

type AliExpressParams = Record<string, string | number | boolean | null | undefined>;

export class AliExpressApiError extends Error {
  constructor(message: string, readonly retryable = false, readonly providerCode: string | null = null, readonly requestId: string | null = null) {
    super(message);
    this.name = "AliExpressApiError";
  }
}

function safeProviderDiagnostic(error: Record<string, unknown>) {
  const rawCode = error.code ?? error.sub_code;
  const providerCode = typeof rawCode === "string" || typeof rawCode === "number" ? String(rawCode).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) : "";
  const rawRequestId = error.request_id ?? error.requestId;
  const requestId = typeof rawRequestId === "string" ? rawRequestId.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 100) : "";
  return { providerCode: providerCode || null, requestId: requestId || null };
}

function requiredCredentials() {
  const appKey = process.env.ALIEXPRESS_APP_KEY?.trim() ?? "";
  const appSecret = process.env.ALIEXPRESS_APP_SECRET?.trim() ?? "";
  if (!appKey || !appSecret) throw new AliExpressApiError("AliExpress App Key and App Secret are not configured on the server.");
  return { appKey, appSecret };
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function normalizedParams(params: AliExpressParams) {
  return Object.fromEntries(Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null)
    .map(([key, value]) => [key, typeof value === "boolean" ? String(value) : String(value)]));
}

export function createAliExpressSignature(input: { secret: string; params: AliExpressParams; systemPath?: string }) {
  const params = normalizedParams(input.params);
  const canonicalParams = Object.keys(params)
    .filter(key => key !== "sign")
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
    .map(key => `${key}${params[key]}`)
    .join("");
  const canonical = input.systemPath ? `${input.systemPath}${canonicalParams}` : canonicalParams;
  return createHmac("sha256", input.secret).update(canonical, "utf8").digest("hex").toUpperCase();
}

function signedParameters(params: AliExpressParams, systemPath?: string) {
  const { appKey, appSecret } = requiredCredentials();
  const requestParams = normalizedParams({ app_key: appKey, timestamp: timestamp(), sign_method: "sha256", v: "2.0", format: "json", ...params });
  requestParams.sign = createAliExpressSignature({ secret: appSecret, params: requestParams, systemPath });
  return requestParams;
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok || !payload || typeof payload !== "object") {
    throw new AliExpressApiError(`AliExpress returned an HTTP ${response.status} response.`, response.status === 429 || response.status >= 500);
  }
  return payload as Record<string, unknown>;
}

export async function callAliExpressSystemApi<T extends Record<string, unknown>>(path: "/auth/token/create" | "/auth/token/refresh", params: AliExpressParams): Promise<T> {
  const requestParams = signedParameters(params, path);
  const url = new URL(`/rest${path}`, ALIEXPRESS_API_ORIGIN);
  for (const [key, value] of Object.entries(requestParams)) url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers: { accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new AliExpressApiError("AliExpress could not be reached. Retry the request.", true);
  }
  const payload = await readResponse(response);
  const error = payload.error_response as Record<string, unknown> | undefined;
  if (error) {
    const diagnostic = safeProviderDiagnostic(error);
    throw new AliExpressApiError(`AliExpress rejected the OAuth token request${diagnostic.providerCode ? ` (code ${diagnostic.providerCode})` : ""}.`, false, diagnostic.providerCode, diagnostic.requestId);
  }
  return payload as T;
}

export async function callAliExpressBusinessApi<T extends Record<string, unknown>>(method: string, params: AliExpressParams, accessToken: string): Promise<T> {
  const requestParams = signedParameters({ ...params, method, access_token: accessToken });
  const url = new URL("/sync", ALIEXPRESS_API_ORIGIN);
  for (const [key, value] of Object.entries(requestParams)) url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers: { accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new AliExpressApiError("AliExpress could not be reached. Retry the request.", true);
  }
  const payload = await readResponse(response);
  const error = payload.error_response as Record<string, unknown> | undefined;
  if (error) {
    const diagnostic = safeProviderDiagnostic(error);
    throw new AliExpressApiError(`AliExpress rejected the catalogue request${diagnostic.providerCode ? ` (code ${diagnostic.providerCode})` : ""}. Check the app's API permissions and connected account.`, false, diagnostic.providerCode, diagnostic.requestId);
  }
  const methodResponse = payload[`${method.replaceAll(".", "_")}_response`] as Record<string, unknown> | undefined;
  const responseBody = methodResponse ?? payload;
  const code = responseBody.code;
  if (code !== undefined && String(code) !== "0") {
    const message = typeof responseBody.msg === "string" ? responseBody.msg : "AliExpress reported an API error.";
    throw new AliExpressApiError(message.slice(0, 240), String(code) === "429" || String(code).startsWith("5"));
  }
  return responseBody as T;
}

export function aliExpressAppCredentialsConfigured() {
  return Boolean(process.env.ALIEXPRESS_APP_KEY?.trim() && process.env.ALIEXPRESS_APP_SECRET?.trim());
}
