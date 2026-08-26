# Alpha Market managed-hosting deployment notes

## Published application

The managed Alpha Market deployment is available at `https://alphashop-3pdenj2y.manus.space`. It runs the existing **Express + tRPC + Drizzle + MySQL/TiDB** application. It is not a Next.js, Prisma, PostgreSQL, Supabase, or Vercel deployment; do not replace the existing database URL with a PostgreSQL connection string.

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

## Public verification completed

The published home page serves Alpha Market branding, the active cookie-consent banner, and direct Terms of Use and Privacy Policy links. The legal pages identify **Alpha Collective Corporation** as the legal entity. An unauthenticated visit to `/wallet` shows a sign-in boundary rather than a wallet balance or payment action.
