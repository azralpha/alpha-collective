# Alpha Collective Cooperation: WordPress Marketplace Launch Handoff

**Prepared for:** Alpha Collective Cooperation  
**Scope:** React/tRPC marketplace MVP plus a WordPress implementation blueprint  
**Status:** This document is **not** evidence of a WordPress deployment, a live Dokan configuration, or live Paystack/Flutterwave payment processing. Those activities require access to the chosen host, WordPress administrator account, business verification details, and gateway credentials.

## Purpose and recommended foundation

The implemented web application establishes the intended Alpha Collective customer experience: a warm editorial storefront, Naira prices, deal-led discovery, a visible **Pay on Delivery** option, seller acquisition, and WhatsApp support. A low-overhead WordPress implementation can reproduce this operating model with WordPress, WooCommerce, Dokan, Astra, and Elementor. Dokan exposes marketplace controls for selling, withdrawals, seller products, review capability, and selected payment integrations, while WooCommerce remains the commerce engine.[1]

| Layer | Recommended component | Alpha Collective responsibility |
|---|---|---|
| Hosting and security | Managed WordPress host, HTTPS, daily backups, staging site | Confirm domain, SSL, backups, access roles, and recovery contact. |
| Store engine | WooCommerce | Set Naira, Nigeria delivery zones, taxes, order emails, and Cash on Delivery. |
| Multi-vendor operations | Dokan; select a plan that includes every required module before purchase | Vendor registration, approval, product moderation, commission, withdrawals, and verified vendor reviews. |
| Customer-facing design | Astra plus Elementor | Rebuild the cream/charcoal/tomato-red visual system, marketplace stamp motif, mobile hero, product cards, cart, and seller landing page. |
| Payments | Paystack and Flutterwave WooCommerce gateway plugins | Use merchant-owned keys, sandbox testing, callbacks/webhooks, and server-side verification. |
| Speed and SEO | LiteSpeed Cache and Yoast SEO | Configure carefully against the chosen host and test every checkout path after optimization. |

> **Launch principle:** The operational marketplace should be implemented only once the business has supplied its real WhatsApp number, payout policy, payment-gateway accounts, WordPress administrator access, hosting access, and vendor-review policy.

## Build sequence

Begin with a staging WordPress instance on the selected host. Install and update WordPress, activate HTTPS, then install Astra, WooCommerce, Dokan, Elementor, LiteSpeed Cache, and Yoast SEO. Run the WooCommerce and Dokan setup wizards before styling pages, because the marketplace pages, account flows, checkout behaviors, and vendor dashboard must exist before Elementor templates are assigned.

| Step | Configuration decision | Completion evidence |
|---|---|---|
| 1. Base WordPress | Create a staging site; apply site title, timezone, permalinks, HTTPS, least-privilege accounts, and backup/restore process. | Staging URL loads over HTTPS and an administrator other than the host owner can sign in. |
| 2. Astra and Elementor | Apply the Alpha typography hierarchy, cream paper base, charcoal panels, tomato-red action buttons, rounded product cards, and small market-stamp motif. | Home, shop, product, cart, checkout, and seller landing templates render correctly at 375px and desktop widths. |
| 3. WooCommerce | Set NGN currency, Nigeria customer address behavior, delivery zones/rates, transactional email sender, and Cash on Delivery. Keep COD instructions concise and visible at checkout. | A staging COD test order is created, the order email arrives, and the order state can be managed by staff. |
| 4. Dokan | Enable vendor registration and staff approval. Assign Fashion, Phones, Beauty, and Home. Require product approval during the launch period. | A test seller can register, save a draft product, and an administrator can approve/reject it. |
| 5. Commission and withdrawal | Set a clear default commission inside the promised **10–15%** range, such as 12%, then document any category-level variance. Configure a minimum withdrawal amount and a local bank-transfer procedure. Dokan documentation covers commission configuration and withdrawal management.[1] | A test order produces expected vendor/admin earnings, and a test withdrawal follows the written approval path. |
| 6. Trust features | Enable only the vendor rating/review capability covered by the selected Dokan plan. Require purchase-linked review eligibility and disclose moderation rules. | A real test customer can review only after a test purchase; no ratings are manufactured for launch. |
| 7. Referrals | Start with a documented WooCommerce coupon approach or commission an audited referral extension/custom implementation. Require attribution, qualifying-order logic, unique rewards, expiry, and redemption logging before advertising the benefit. | A test referral creates one ₦500 reward only after its stated conditions are met. |

## Payments, delivery, and WhatsApp

Cash on Delivery should be enabled as the earliest live method. It lets the operational team establish order confirmation and delivery coordination before expanding into online gateway settlement. This React MVP persists COD orders but does **not** initialize Paystack or Flutterwave transactions, handle webhooks, or verify a payment callback.

For Paystack and Flutterwave, install one maintained WooCommerce gateway plugin for each selected provider after reviewing the plugin vendor and current support policy. Store secret keys only in the WordPress/gateway settings; do not embed them in Elementor, page code, or client-side scripts. Use each gateway’s test mode first, set the allowed callback/webhook endpoint exactly as documented in the provider dashboard, and verify successful, cancelled, duplicated, and delayed callback cases before enabling live mode. Dokan’s own documentation includes marketplace payment-gateway material, including a Paystack section, but availability depends on the installed Dokan edition and plugin versions.[1]

Use the business’s real WhatsApp number in international form with a direct link such as `https://wa.me/2348012345678?text=Hello%20Alpha%20Collective`. Replace the placeholder number currently used by the React MVP before launch. The support link should be visible in the header, product pages, order confirmation, and seller onboarding.

| Customer promise | WordPress implementation | Important guardrail |
|---|---|---|
| **Pay on Delivery** | WooCommerce Cash on Delivery enabled; delivery confirmation procedure documented. | Do not imply a payment is captured online. |
| Paystack / Flutterwave | Gateway plugin configured with merchant-owned credentials, callback and webhook verification. | Do not make the payment method selectable until a complete successful and failed-payment test is signed off. |
| **Share and get ₦500 off** | Coupon or referral system with attribution, eligibility, one-time issuance, expiry, and redemption tracking. | Do not issue arbitrary discount codes or call an untested share button a reward system. |
| Vendor ratings | Dokan review capability with authenticated/purchase-linked review rules. | Do not use placeholder ratings, testimonials, or reviews. |
| WhatsApp support | Real `wa.me` business URL, pre-filled order-help message, staff response owner. | The number must be supplied and tested by the business. |

## LiteSpeed Cache and Yoast SEO

LiteSpeed Cache supports general optimization on multiple server types, but its LiteSpeed-exclusive caching features require a LiteSpeed solution or QUIC.cloud. The plugin documentation also lists WooCommerce and Yoast SEO compatibility.[2] Enable it in stages: first cache and browser cache, then image optimization, then CSS/JavaScript optimization only after testing logged-out product, cart, checkout, account, and vendor-dashboard behavior. Exclude dynamic checkout, cart, account, and vendor-dashboard paths as needed by the final plugin/theme configuration. Purge caches after template, inventory, pricing, or styling changes.

Yoast WooCommerce SEO depends on WooCommerce and the Yoast SEO components specified in Yoast’s current installation guide.[3] Configure the site representation, XML sitemap, product title and meta templates, category templates, canonical settings, and social previews. Give every seller-product page a real title, unique description, accurate price/availability data, primary image, and appropriate category; do not use generated or repetitive keyword text. The Dokan documentation also lists a Yoast SEO integration path.[1]

## React MVP to WordPress mapping

| MVP route or capability | WordPress/Dokan implementation target |
|---|---|
| `/` | Elementor home template with deal-led hero, category blocks, flash collection, COD and WhatsApp confidence cues, referral CTA, and seller CTA. |
| `/shop` and `/product/:id` | WooCommerce archive and single-product templates styled with Astra/Elementor; Dokan vendor/store identity visible. |
| `/cart` and `/checkout` | WooCommerce cart and checkout with COD first; turn on Paystack/Flutterwave only after gateway validation. |
| `/sell` | Dokan vendor registration and onboarding page with transparent 10–15% commission/payout policy. |
| `/vendor/dashboard` | Dokan vendor dashboard with products, orders, earnings, payouts, and configured seller permissions. |
| Referral code tracking | Audited referral/coupon extension or custom WooCommerce integration, not a visual-only share control. |
| Ratings | Dokan vendor/product review capability selected in the licensed plan and constrained by the agreed verified-purchase policy. |

## Go-live checklist

Before launch, the business owner should confirm the WordPress stack on staging, test both buyer and seller journeys, and approve the configured policy documents. The initial public catalog should contain only real sellers, real product information, real prices, real delivery coverage, and real review status.

| Check | Pass condition |
|---|---|
| Mobile storefront | Home, category, product, cart, checkout, seller signup, and vendor dashboard tested on a 375px viewport. |
| Cash on Delivery | Order creation, notification, delivery workflow, cancellation/refund policy, and staff hand-off tested. |
| Payment gateway | Paystack/Flutterwave test-mode success, failure, cancellation, duplicate event, and webhook verification all documented before live enablement. |
| Sellers | Seller registration, approval, product moderation, commission calculation, payout request, and bank-transfer procedure tested. |
| Referrals and reviews | Qualification/reward and review-eligibility rules tested without fabricated customer content. |
| Performance | Caches purged; checkout/cart/account/vendor areas verified after LiteSpeed changes in a private/logged-out browser. |
| SEO | Indexing policy, sitemap, titles, canonical URLs, product descriptions, and social-preview images reviewed. |
| Support | Real WhatsApp number, ownership schedule, escalation path, and pre-filled help text tested. |

## Inputs required before a WordPress build can begin

The business must supply the WordPress host and administrator access, final domain, real support WhatsApp number, business/legal identity, privacy/returns/delivery policies, Paystack and/or Flutterwave merchant credentials, payout/withdrawal policy, intended Dokan license, seller approval rules, and initial verified product catalogue. Without this information, the present work should be represented only as a **React/tRPC marketplace MVP and WordPress deployment/configuration handoff**.

## References

[1] [Dokan documentation: selling options, withdrawals, commissions, integrations, and vendor dashboard](https://dokan.co/docs/wordpress/settings/selling-options/)  
[2] [WordPress.org: LiteSpeed Cache plugin documentation](https://wordpress.org/plugins/litespeed-cache/)  
[3] [Yoast: WooCommerce SEO installation guide](https://yoast.com/help/installation-guide-for-yoast-woocommerce-seo/)
