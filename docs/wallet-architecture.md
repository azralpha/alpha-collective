# Unified Wallet Architecture

## Scope

Every authenticated account receives a zero-balance wallet. Alpha Wallet is a **closed-loop marketplace ledger** for internal spending and seller earnings, with Paystack used only at the boundary where users add funds or receive a verified Nigerian-bank withdrawal. All money values in the marketplace database are stored as integer **Naira**; conversion to kobo occurs only immediately before a Paystack API request.

| Component | Control |
| --- | --- |
| Wallet | One wallet per user, with distinct available and escrow balances plus server-only PIN hash and lockout fields. |
| Ledger | Typed money-in and money-out entries for deposit, withdrawal, purchase escrow, refund, and sale earning. Each critical movement has a unique idempotency key. |
| Escrow allocation | One held allocation per vendor per wallet-paid order. Delivery release changes it once to released, credits the vendor’s available balance by the recorded net amount, and writes a sale-earning entry. |
| Wallet checkout | Requires an authenticated buyer, a verified four-digit PIN, sufficient available balance, an approved vendor listing, and an atomic transfer of the order total into buyer escrow. |
| PIN protection | PINs use random-salt scrypt hashes with constant-time verification. Raw PINs are never stored, logged, or returned; repeated failures temporarily lock authorization. |

## Paystack funding and direct Nigerian-bank withdrawals

Funding begins only when a user explicitly selects an amount and continues to Paystack’s hosted authorization page. The server creates a durable pending attempt with a unique reference. A wallet credit is applied only after a signed `charge.success` webhook and a server-side transaction verification agree with the stored reference and exact Naira-to-kobo amount. Replayed webhooks cannot create another credit because the funding attempt state and ledger key are transitioned atomically.

For withdrawals, a user first selects a Nigerian bank from the provider-sourced list and enters a 10-digit account number. The server resolves that account through Paystack, creates a Paystack NUBAN recipient, and retains only the bank name, account holder name, masked account number, and recipient code. The raw account number is neither persisted nor returned. A user must then enter their transaction PIN and affirm a clear transfer confirmation before a withdrawal is created and sent to Paystack. The available balance is debited atomically with the pending withdrawal record; only a final `transfer.success` marks the request as paid. A provider failure or reversal restores the balance and records a compensating refund ledger entry exactly once.

> Paystack recommends webhooks rather than client callbacks or polling for value delivery and transfer status. Its webhook documentation specifies a SHA-512 HMAC signature using the raw event payload and the secret key; transfer outcomes are asynchronous and require a configured public webhook URL.[1] [2]

The webhook endpoint is `POST /api/paystack/webhook`. It runs before JSON parsing to preserve the raw body, validates the `x-paystack-signature`, parses only valid events, and returns a non-success response when reconciliation cannot complete so Paystack can retry. The public production URL must be registered in the Paystack dashboard before live funding or withdrawal requests are used.[1]

## Operational safeguards

| Safeguard | Current behavior |
| --- | --- |
| Secret handling | The Paystack secret remains server-only and is not embedded in client code, tests, logs, documentation, or responses. |
| Funding verification | A successful-looking browser redirect cannot credit a wallet; exact-reference, exact-amount server verification is mandatory. |
| Withdrawal consent | Bank setup never sends money. Transfer initiation requires a user action, amount, PIN, and explicit confirmation in Wallet. |
| Ambiguous provider outcome | A network or 5xx response leaves the durable request pending for provider/webhook reconciliation instead of falsely crediting or restoring funds. |
| Error recovery | Definitive provider rejections reverse the local withdrawal hold; Paystack failure or reversal webhooks restore funds idempotently. |

## End-to-end held-order release verification

The automated suite verifies that the administrator route forwards one held escrow release and rejects a subsequent release once the held state has changed. A controlled live verification, performed only with consent and appropriate test balance, should follow this sequence: fund a buyer wallet through the verified Paystack flow; place one eligible vendor-backed wallet order; confirm it appears in the administrator escrow queue; mark it delivered once; then confirm the buyer escrow balance decreases, the vendor receives one sale-earning entry, and a second release is rejected. No such live-money verification is initiated during development.

## References

[1]: https://paystack.com/docs/payments/webhooks/ "Paystack – Webhooks"
[2]: https://paystack.com/docs/transfers/single-transfers/ "Paystack – Single Transfers"
[3]: https://paystack.com/docs/payments/verify-payments/ "Paystack – Verify Payments"
