# Security and KYC Implementation Status

## Implemented internal safeguards

| Control | Implemented behaviour |
| --- | --- |
| **Account login** | Alpha Collective uses Manus OAuth and does not collect, store, or verify local user passwords. OAuth state is protected by a one-time nonce cookie in the existing authentication callback. |
| **Wallet PIN** | Transaction PINs remain server-side salted `scrypt` hashes; no raw PIN is persisted or returned to the browser. |
| **Brute-force protection** | The third invalid transaction PIN attempt locks the wallet PIN flow for fifteen minutes. |
| **Withdrawal gate** | Withdrawals require a vendor account, verified KYC state, a KYC-locked Nigerian bank recipient, the transaction PIN, and an OTP-email provider. The provider transfer is blocked before money movement when any condition is missing. |
| **Buyer Pay on Delivery** | Pay on Delivery requires authentication plus a verified buyer KYC profile. Wallet checkout remains separate from this buyer KYC gate. |
| **KYC records** | Only the submitted legal name, provider-returned legal name, KYC state, and a private server-side ID-storage reference are retained. Raw NINs, selfie bytes, and unmasked bank-account numbers are not persisted. |
| **Input handling** | Server-side validation and plain-text normalization cover persisted product, seller, buyer, and delivery text. Drizzle parameterization and React’s default escaping remain in use. |

## Deferred activation

The following actions intentionally remain disabled until the necessary provider configuration is verified:

| Deferred feature | Requirement before activation |
| --- | --- |
| **Account-lock emails and withdrawal OTP emails** | A valid email-provider key, a verified sender, successful non-sending validation, and an explicit production activation flag. |
| **OTP verification and provider transfer** | The email provider above; only then may a verified OTP consume a challenge and trigger the existing Paystack transfer flow. |
| **Identity verification** | A configured, authorized identity-verification provider, secure server callback, and provider result that passes the platform’s identity-review checks. |
| **KYC bank-name approval** | A successful identity-review result and a matched Flutterwave Nigerian bank-account resolution result. |

> **Safety rule:** Alpha Collective never treats a document upload, a bank-recipient lookup, or a UI success message as KYC approval. No provider transfer is initiated while the required validation is unavailable.
