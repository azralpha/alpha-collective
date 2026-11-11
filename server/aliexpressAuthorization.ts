const ALIEXPRESS_AUTHORIZE_ENDPOINT = "https://api-sg.aliexpress.com/oauth/authorize";

export function buildAliExpressAuthorizationUrl(input: { appKey: string; callbackUrl: string; state: string }) {
  const authorizationUrl = new URL(ALIEXPRESS_AUTHORIZE_ENDPOINT);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("force_auth", "true");
  authorizationUrl.searchParams.set("redirect_uri", input.callbackUrl);
  authorizationUrl.searchParams.set("client_id", input.appKey);
  authorizationUrl.searchParams.set("state", input.state);
  authorizationUrl.searchParams.set("redirect_auth", "true");
  return authorizationUrl.toString();
}
