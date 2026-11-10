import { describe, expect, it } from "vitest";
import { createAliExpressOAuthState, isValidAliExpressOAuthState } from "./aliexpressOAuthState";

const SERVER_SECRET = "unit-test-server-secret-not-used-in-production";

describe("AliExpress OAuth callback state", () => {
  it("accepts a matching HMAC-signed browser state within the ten-minute window", () => {
    const now = Date.now();
    const oauthState = createAliExpressOAuthState(SERVER_SECRET, now);
    expect(isValidAliExpressOAuthState(oauthState.cookieValue, oauthState.state, SERVER_SECRET, now + 1_000)).toBe(true);
  });

  it("rejects missing, mismatched, expired, future-issued, tampered, and cookie-tossed state", () => {
    const now = Date.now();
    const oauthState = createAliExpressOAuthState(SERVER_SECRET, now);
    const attackerState = createAliExpressOAuthState("attacker-controlled-secret", now);
    expect(isValidAliExpressOAuthState(undefined, oauthState.state, SERVER_SECRET, now)).toBe(false);
    expect(isValidAliExpressOAuthState(oauthState.cookieValue, `${now}.attacker-state`, SERVER_SECRET, now)).toBe(false);
    expect(isValidAliExpressOAuthState(oauthState.cookieValue, oauthState.state, SERVER_SECRET, now + 10 * 60 * 1000 + 1)).toBe(false);
    expect(isValidAliExpressOAuthState(`${now + 1_000}.${oauthState.state.split(".")[1]}.${oauthState.cookieValue.split(".")[2]}`, oauthState.state, SERVER_SECRET, now)).toBe(false);
    expect(isValidAliExpressOAuthState(attackerState.cookieValue, attackerState.state, SERVER_SECRET, now)).toBe(false);
  });
});
