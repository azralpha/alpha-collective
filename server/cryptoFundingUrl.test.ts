import { describe, expect, it } from "vitest";
import { getPublicAppUrl, nowPaymentsIpnCallbackUrl } from "./cryptoFundingUrl";

describe("published NOWPayments callback URL", () => {
  it("uses the configured public HTTPS domain to construct the server callback endpoint", () => {
    expect(getPublicAppUrl().protocol).toBe("https:");
    expect(nowPaymentsIpnCallbackUrl()).toBe("https://alphacorp.name.ng/api/webhooks/nowpayments");
  });
});
