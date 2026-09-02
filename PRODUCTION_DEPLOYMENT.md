# Alpha Market managed-hosting deployment notes

## Published application

The managed Alpha Market deployment is available at `https://alphacorp.name.ng` once the custom domain binding and DNS verification are complete. The fallback managed URL is `https://alphashop-3pdenj2y.manus.space`. It runs the existing **Express + tRPC + Drizzle + MySQL/TiDB** application. It is not a Next.js, Prisma, PostgreSQL, Supabase, or Vercel deployment; do not replace the existing database URL with a PostgreSQL connection string.

## Supported managed environment values

| Purpose | Supported server-side value | Deployment rule |
| --- | --- | --- |
| Marketplace database | `DATABASE_URL` | Keep the managed MySQL/TiDB connection string configured by the platform. |
| Database pooling | `DATABASE_POOL_LIMIT` | Optional. Defaults to `5` and is clamped to `1–20` per application instance. |
| Telegram notices | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | Keep server-only. Alerts remain conditional on the trusted business events already implemented. |
| NOWPayments verification groundwork | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | Keep server-only. These names intentionally differ from a generic `IPN_SECRET`. |
| CJ catalogue integration | `CJ_DROPSHIPPING_API_KEY` | Keep server-only. A generic `CJ_API_KEY` is not read by the current server adapter. |

`NEXT_PUBLIC_SITE_URL` is not consumed by the current Vite application. The published domain is discovered by the browser at runtime. `BYPASS_KYC_TEST_MODE` is also not supported and must not be introduced into the public deployment: wallet and protected financial flows retain their server-side KYC controls.

## Published safety boundary

Publishing the site does **not** enable a NOWPayments payment-creation endpoint, an IPN wallet-credit callback, a live crypto address generator, supplier ordering, or money-moving schedules. The current code has only server-side credential validation and signed-IPN groundwork. Before any future crypto funding launch, the team must implement the provider-verified quoted-payment flow, configure and verify the merchant settlement account, register a reviewed HTTPS callback route, test idempotent reconciliation in a controlled environment, and obtain explicit release approval.

The CJ mass importer remains administrator-only and draft-only. It cannot publish products automatically, create supplier orders, or transmit buyer delivery data.

## Fiat gateway registration

Paystack and Flutterwave wallet funding and checkout redirects are available to KYC-eligible users. A redirect is not proof of payment: each provider payment is stored as pending, then its signed webhook is independently re-verified against the provider API before a wallet credit or a gateway-held checkout escrow can be created.

| Provider | Register this webhook URL | Required dashboard setting |
| --- | --- | --- |
| Paystack | `https://alphacorp.name.ng/api/paystack/webhook` | Enable charge-success events. |
| Flutterwave | `https://alphacorp.name.ng/api/flutterwave/webhook` | Set the same Secret Hash stored in `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, enable `charge.completed`, and enable retry delivery. |

Do not treat a provider success redirect as a settlement callback. Only the signed webhook and independent transaction check can change a wallet balance or turn a pending checkout order into gateway-held escrow.

## OAuth custom-domain configuration

The frontend login trigger intentionally derives its redirect URI from the active browser origin: `https://alphacorp.name.ng/api/oauth/callback` on the canonical domain. In the Manus Developer Portal, open the Alpha Market OAuth application identified by `VITE_APP_ID`, find the **Allowed Redirect URIs**, **Authorized redirect URLs**, or equivalent application security section, and add the exact callback URI `https://alphacorp.name.ng/api/oauth/callback`. If `www.alphacorp.name.ng` is also connected and users may sign in there, add `https://www.alphacorp.name.ng/api/oauth/callback` as a second exact entry. Do not add a wildcard, a trailing slash, an HTTP URL, or a callback path from an unrelated deployment. The server callback route is already registered at `/api/oauth/callback`; the frontend supplies the origin and the existing state/nonce protection remains active.

## Public verification completed

The published home page serves Alpha Market branding, the active cookie-consent banner, and direct Terms of Use and Privacy Policy links. The legal pages identify **Alpha Collective Corporation** as the legal entity. An unauthenticated visit to `/wallet` shows a sign-in boundary rather than a wallet balance or payment action.
