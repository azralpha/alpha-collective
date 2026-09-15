# Payment Integration Findings

## Telegram notifications

Telegram’s Bot API is HTTPS-based. A server can call `sendMessage` using the bot token and a `chat_id`; responses contain an `ok` flag and optional error details. Tokens must remain server-only. Payment alerts should contain only the order reference, amount, and fulfilment class—never a buyer phone number, address, wallet balance, or payment token.

Source: [Telegram Bot API](https://core.telegram.org/bots/api).

## Multi-asset payments

NOWPayments documents an API with sandbox support and Instant Payment Notifications. A production integration requires a merchant API key, a configured settlement wallet, and an IPN secret for callback verification. The project should permit only the approved asset/network pairs, persist every quote and provider reference, and credit no wallet from a browser callback or an unverified IPN.

Source: [NOWPayments API](https://nowpayments.io/api).

## Staged implementation decision

The existing Autoscale site can handle authenticated payment webhooks and daily escrow fallback callbacks after publication. It must not use in-process timers for the 15-minute quote or seven-day release rules. Until the user supplies working NOWPayments credentials and the site is published, no real crypto payment, wallet credit, transfer, Telegram message, or scheduled release will be initiated.
