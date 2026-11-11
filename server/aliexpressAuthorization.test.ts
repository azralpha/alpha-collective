import { describe, expect, it } from "vitest";
import { buildAliExpressAuthorizationUrl } from "./aliexpressAuthorization";

describe("AliExpress authorization URL", () => {
  it("includes the app key, exact callback, OAuth state, and API-SG redirect-auth flag", () => {
    const callbackUrl = "https://alphamarket.name.ng/api/admin/suppliers/aliexpress/callback";
    const authorizationUrl = new URL(buildAliExpressAuthorizationUrl({ appKey: "557004", callbackUrl, state: "12345.randomstate" }));

    expect(authorizationUrl.origin).toBe("https://api-sg.aliexpress.com");
    expect(authorizationUrl.pathname).toBe("/oauth/authorize");
    expect(authorizationUrl.searchParams.get("client_id")).toBe("557004");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(callbackUrl);
    expect(authorizationUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizationUrl.searchParams.get("state")).toBe("12345.randomstate");
    expect(authorizationUrl.searchParams.get("redirect_auth")).toBe("true");
    expect(authorizationUrl.searchParams.has("sp")).toBe(false);
    expect(authorizationUrl.searchParams.has("view")).toBe(false);
    expect(authorizationUrl.searchParams.get("force_auth")).toBe("true");
  });
});
