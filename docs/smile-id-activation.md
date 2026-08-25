# Smile ID Activation Requirements

Smile ID’s current documentation describes biometric onboarding as asynchronous: the application submits a verification request, receives a `202 Accepted` acknowledgement with a job identifier, and then receives the final verification result through the configured callback URL. The final result includes a status, a human-readable message, and a machine-readable reason; all three must be evaluated before marking a KYC profile verified.[1] [2]

| Requirement | Alpha Collective activation rule |
| --- | --- |
| **Server API key** | Obtain a Smile ID server-side API key and store it only as a protected environment secret. Never expose it in browser code, source control, or client-side configuration.[1] |
| **Public callback URL** | Register a published HTTPS callback URL in Smile ID’s callback allowlist. The current temporary preview URL must not be used.[1] |
| **Biometric request** | Use Smile ID’s onboarding-with-biometrics flow for NIN identity and liveness/selfie verification. A government-ID image alone is not treated as identity approval.[2] |
| **KYC approval** | Save the legal name returned by a successful provider result, then compare it with Paystack’s resolved Nigerian bank-account name before locking the bank recipient. |
| **Failure handling** | Keep the KYC profile unverified and show a clear error. Never simulate a successful identity result or transfer money while provider delivery is unavailable. |

## References

[1]: https://docs.usesmileid.com/developer-resources "Smile ID – Developer Resources and Security"
[2]: https://docs.usesmileid.com/products/onboarding-with-biometrics "Smile ID – Onboarding with Biometrics"
