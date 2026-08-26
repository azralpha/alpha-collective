# Project TODO

- [x] Audit the CJ product-details API, administrator official-product editor, and shared vendor/imported image paths
- [x] Add a protected CJ SKU import procedure that maps only product data and never creates a supplier order
- [x] Add an admin Auto-Import from CJ Dropshipping interface with loading state, image-gallery import, and manual retail-price requirement
- [x] Add a shared server-side product-image pipeline that applies an Alpha Collective watermark, outputs optimized WebP, and stores only processed images
- [x] Route vendor draft uploads and CJ-imported external images through the same watermark and WebP pipeline
- [x] Add a transparent Alpha Collective watermark logo asset and support it as the default image overlay
- [x] Add explicit importer authorization, description-sanitization, and manual-retail-price automated coverage
- [x] Revalidate the authenticated administrator importer and mobile public-shop rendering without creating a supplier order

- [x] Verify the referral-band “Bring your people” label renders white and save the requested visual-edit checkpoint

- [x] Audit product, order, and admin flows for secure dropship fulfilment integration points
- [x] Add admin-only hidden product sourcing fields: external SKU, supplier cost, and fulfilment-provider selection
- [x] Ensure supplier metadata is excluded from every public and vendor product response and rendered as Alpha Collective Official on buyer storefronts
- [x] Add an admin Dropship Integrations settings area with safe server-only credential activation controls
- [x] Add durable fulfilment-job records, per-item payload snapshots, retry safety, and manual-processing failure states
- [x] Trigger eligible supplier fulfilment after the currently implemented Wallet escrow checkout, without allowing a supplier failure to fail the customer order
- [x] Add administrator failure badges, fulfilment detail review, and manual retry controls
- [x] Add supplier-trigger access-control, payload, idempotency, and error-handling coverage
- [x] Implement the CJ Dropshipping server adapter and its official order request contract behind a server-only credential
- [x] Create the authenticated endpoint to run published-site CJ fulfilment retries
- [x] Add and validate the server-only CJ Dropshipping API key using a read-only access-token check with no supplier order
- [x] Configure CJ logistics defaults and run a controlled non-purchasing provider check before enabling automatic fulfilment
- [x] Defer CJ callback registration and scheduled retry activation until a published domain is available

- [x] Review the supplied update specification and implement all applicable internal Alpha Collective requirements that do not require unconfigured external providers
- [x] Assess current password, PIN, login, and wallet authorization safeguards against the supplied anti-fraud requirements
- [x] Add wallet PIN lockout-after-three-attempts and defer account-alert delivery until a configured email provider is available
- [x] Defer live withdrawal-OTP and account-lock email delivery until a verified email provider credential is available
- [x] Defer real user email delivery for account-lock alerts and withdrawal OTPs, plus OTP verification and final transfer initiation, until a provider validates successfully
- [x] Defer Smile ID asynchronous verification and signed callback handling, then use provider legal-name confirmation to approve KYC, until credentials and a public callback URL are available
- [x] Document the third-party chat boundary: no first-party chat text is persisted by Alpha Collective, while Tawk.to remains governed by its external embed and cannot be server-side sanitized by this app
- [x] Add a server-side six-digit, expiring withdrawal OTP challenge before any provider transfer is initiated
- [x] Build a privacy-minimizing KYC profile, legal-name, and locked verified-bank-account model
- [x] Add vendor KYC dashboard requirements and prevent unverified vendors from requesting withdrawals
- [x] Add conditional buyer KYC enforcement for Pay on Delivery while retaining prepaid and wallet checkout access
- [x] Defer Smile ID’s asynchronous identity-verification workflow and signed callback handling until credentials and a public callback URL are available
- [x] Add safe input-validation and output-encoding coverage for persisted marketplace and checkout data paths
- [x] Add focused automated coverage and validate the revised security and KYC journeys

- [x] Inspect the copied marketplace implementation, database schema, migrations, and task tracker before changing behavior
- [x] Reconcile marketplace persistence and tRPC procedures for orders, referrals, vendor applications, and vendor products
- [x] Replace advertised local-only marketplace workflows with persistent flows and explicit loading, error, empty, and confirmation states
- [x] Correct trust, payment, referral, ratings, and WordPress handoff claims to match implemented functionality
- [x] Add marketplace-focused automated coverage and validate critical desktop and mobile routes
- [x] Save the first independent checkpoint after all completed work is verified
- [x] Define typed marketplace fixtures, cart, Naira, commission, and order-reference utilities
- [x] Build responsive buyer routes for home, shop, product detail, cart, and checkout
- [x] Make Pay on Delivery prominent and retain Paystack and Flutterwave as integration-ready payment options without overstating live processing
- [x] Build the exact “Sell on Alpha Collective” seller acquisition route and persistent vendor product dashboard
- [x] Add referral attribution and the exact “Share and get ₦500 off” acquisition journey with truthful eligibility messaging
- [x] Publish an accurate WordPress, WooCommerce, Dokan, Astra, Elementor, LiteSpeed Cache, and Yoast SEO deployment handoff
- [x] Implement sharer attribution, self-referral prevention, and a distinct ₦500 reward code after a qualifying referred order
- [x] Audit referral and ratings wording across the storefront and launch handoff so it only describes the implemented behavior
- [x] Define a high-energy mobile deal-commerce visual system using the supplied reference as inspiration
- [x] Add a promo strip, compact search-led header, category chips, and persistent mobile bottom navigation
- [x] Redesign the homepage hero around bolder green/orange deal surfaces, action hierarchy, and delivery trust cues
- [x] Apply the refreshed theme consistently to shop, product, cart, checkout, and seller routes
- [x] Verify the refreshed experience on mobile and desktop
- [x] Save a visual-refresh checkpoint
- [x] Verify the top announcement copy uses “Fresh finds for African products”
- [x] Save a checkpoint containing the verified announcement-copy update

- [x] Audit existing wallet, referral, checkout, delivery, KYC, and status-transition data flows against the split-balance specification
- [x] Add safe withdrawable, shopping-bonus, pending-reward, fraud-evidence, and configurable-referral-threshold persistence with a non-destructive migration
- [x] Enforce withdrawable-only withdrawals and atomic bonus-first wallet checkout deductions
- [x] Require verified identity or verified bank matching before referral-link generation and enforce the configured first-order threshold
- [x] Record privacy-minimizing device and IP fraud signals to void suspicious referral bonuses without blocking valid checkout
- [x] Add verified cashback and review reward-hold creation alongside referral holds, then cancel all pending reward types on returns; defer schedule activation until publication
- [x] Update wallet and referral interfaces to show total, withdrawable, shopping bonus, and pending reward balances clearly
- [x] Revalidate signed-in wallet and administrator reward interfaces, then save a checkpoint after focused test coverage passes
- [x] Add a persistent on-device hide-and-reveal control for all wallet balance amounts and validate the privacy state

- [x] Audit current reward, delivery, KYC, vendor, checkout, and marketplace-navigation flows for a dedicated Rewards dashboard
- [x] Add idempotent persistence for KYC rewards, delivery vouchers, badge state, commission overrides, and dynamically calculated approved-vendor monthly reward metrics
- [x] Credit a 2% pending Shopping Bonus after eligible delivery and expose free-delivery progress and one-time voucher redemption without reducing withdrawable cash
- [x] Add one-time verified-KYC reward eligibility while deferring live Smile ID credit until its secure callback activation is available
- [x] Preserve the 0% Launch Promo in live vendor allocations while layering the monthly commission override, add regression coverage, and revalidate
- [x] Build the authenticated /rewards dashboard with Buyer Rewards and Vendor Rewards tabs and add clear navigation from the marketplace shell
- [x] Prepare project-owned schedule handlers for monthly vendor reward evaluation and deferred pending-reward release without creating jobs before publication
- [x] Re-run focused tests and save a checkpoint after public badge and live commission-override validation

- [x] Audit the current homepage hero structure and static artwork references for carousel replacement
- [x] Source and upload three to four high-quality African retail lifestyle images as durable web assets
- [x] Replace the static hero background with an infinite four-to-five-second auto-scrolling carousel that respects reduced-motion preferences
- [x] Maintain strong text contrast, mobile readability, and accessible carousel progress controls across all slides
- [x] Add focused carousel tests, validate desktop and mobile rendering, and save a checkpoint

- [x] Review existing hero carousel controls and slide inventory for the simplified presentation
- [x] Generate and upload six additional compatible African retail lifestyle hero slides
- [x] Remove all pause/play and progress-dot controls while expanding the continuous hero carousel to ten slides
- [x] Update carousel tests, validate desktop and mobile rendering, and save a checkpoint

- [x] Inspect the reported CJ SKU lookup failure, current response adapter, and importer error evidence
- [x] Harden valid CJ SKU/SPU matching and actionable administrator error handling without exposing supplier details
- [x] Add regression coverage for the reported CJ identifier shape and verify no supplier order path is called
- [x] Revalidate the protected administrator import workflow and save a checkpoint
- [x] Add a read-only CJ product-list fallback for identifiers the V2 catalogue search does not return, while retaining draft-only import and no-order safeguards
- [x] Cover the fallback with a regression test and verify the reported CJ identifier again
- [x] Run a final read-only diagnostic against CJ-supported identifier lookup routes for the reported code and record the outcome without creating an order

- [x] Inspect the reported CJ image rejection, including source headers, format support, and size-limit enforcement
- [x] Support safe valid CJ-hosted image formats and content-type variations without weakening host allowlists or resource limits
- [x] Add regression coverage for successful CJ image processing and revalidate the draft importer without creating a supplier order

- [x] Inspect the read-only CJ catalogue price representation for the matched parent product and retain only a valid supplier cost
- [x] Harden valid CJ price-format extraction without auto-filling the mandatory Naira retail price
- [x] Add price-format regression coverage and revalidate the protected CJ draft import without creating a supplier order

- [x] Audit CJ supplier-price field variations and current hidden sourcing contract assumptions
- [x] Parse valid numeric CJ price formats safely and allow a draft import with blank supplier cost when CJ provides no trustworthy single amount
- [x] Keep mandatory manual Naira retail-price validation and show an administrator-only review notice for unresolved CJ cost
- [x] Add comprehensive CJ price-format coverage, validate multiple draft imports, and save a checkpoint
- [x] Create a compact wolf-logo asset from the supplied Alpha identity for navigation and footer use
- [x] Rename Phones to Gadgets and add Vehicles, Home & Furniture, and Animals & Pets to marketplace categories
- [x] Update the brand lockup, homepage category discovery, shop filters, and seller categories for the expanded catalogue
- [x] Store the supplied Paystack live key in secure server configuration without exposing it in source or the browser
- [x] Confirm seller application and product forms use the shared expanded category list and display the updated marketplace shell
- [x] Validate the branding, category flows, and secret configuration
- [x] Save a checkpoint containing the wolf brand, category, and secure Paystack update
- [x] Verify the seller heading uses “Tell us what you are selling.”
- [x] Save a checkpoint containing the verified seller-heading update
- [x] Verify the vendor product-description label notes bulk products
- [x] Save a checkpoint containing the verified vendor form-label update
- [x] Add a stored primary-image field to vendor product drafts and safely migrate the database
- [x] Implement authenticated product-image uploads through server-side storage and persist the returned URL with each draft
- [x] Show persisted vendor product thumbnails in the seller catalogue and approved public product presentation
- [x] Add the WhatsApp “Request Admin Validation” action below saved products for pending seller applications
- [x] Apply a 0% Launch Promo commission rate and explanatory two-week note across dashboard metrics and saved-product estimates
- [x] Add automated coverage and verify the enhanced vendor dashboard flow
- [x] Save a checkpoint containing the verified vendor-dashboard enhancement
- [x] Add focused tests for vendor image upload validation, image persistence, and active public product mapping
- [x] Verify the signed-in dashboard, real server-side image upload, WhatsApp validation action, and public active-listing behavior
- [x] Confirm the authenticated dashboard’s saved-draft image and WhatsApp validation link against the live vendor data
- [x] Confirm a genuinely active vendor product with a persisted image is present on the public shop and product pages
- [x] Investigate why the vendor sign-in action is not completing in the project preview
- [x] Fix any application-side sign-in entry issue and verify vendors can reach the authenticated dashboard
- [x] Add persisted multiple-image gallery URLs to vendor products while retaining a lead thumbnail image
- [x] Implement secure multi-file image uploads with draft previews, removal controls, and server-side ownership validation
- [x] Display vendor product galleries in the seller catalogue and approved public product-detail view
- [x] Add automated coverage and verify multiple images survive draft save and public active-product display
- [x] Show multiple persisted draft images directly in the seller catalogue rather than only a lead-image count badge
- [x] Confirm an authenticated vendor saves a multi-image draft and sees its gallery in Saved products
- [x] Confirm an active vendor product with a persisted gallery appears on public shop and product pages
- [x] Diagnose the reported “product image could not be read” error during draft submission
- [x] Make multi-image reading resilient in the preview browser and verify a real image-backed draft save
- [x] Verify the Range Rover draft stores its complete persisted image gallery
- [x] Add protected administrator procedures to list drafts and approve or reject vendor products
- [x] Build an administrator review dashboard with vendor details, gallery inspection, and approval controls
- [x] Reliably confirm the Range Rover draft’s persisted image gallery and lead thumbnail data
- [x] Correct direct `/shop?category=…` routing so approved listings appear in the requested category view
- [x] Verify the approved Range Rover listing appears with its gallery on public shop and product pages
- [x] Save a checkpoint containing the verified vendor gallery and administrator approval workflow
- [x] Add protected vendor procedures that allow edits only to the seller’s own draft products
- [x] Prevent edits to published products and show a clear paid-change notice at the bottom of the vendor dashboard
- [x] Build a vendor draft editor with saved image-gallery retention and optional image replacement
- [x] Add the supplied asynchronous Tawk.to script once in the global application layout
- [x] Add focused tests and verify draft editing, published-product restrictions, and widget loading
- [x] Save a checkpoint containing the verified draft-editing and Tawk.to support update
- [x] Add coverage for replacement image galleries during a successful draft edit
- [x] Verify the signed-in vendor can save edited fields and a replacement gallery end to end
- [x] Confirm the Tawk.to launcher loads in a live preview browser session
- [x] Verify and update the product-page seller attribution from “Sold by” to “By” for Alpha real estate listings
- [x] Validate the seller-attribution change
- [x] Save a checkpoint containing the verified product-page seller-attribution update
- [x] Inspect the failed homepage call-to-action visual edit and confirm its current wording
- [x] Apply the approved catchier homepage call-to-action and validate it
- [x] Save a checkpoint containing the verified “Shop Naija’s Good Finds” homepage update
- [x] Inspect current cart, checkout, order persistence, and support-widget integration points
- [x] Add a draggable support control that supports mouse and touch movement without blocking checkout actions
- [x] Confirm the custom draggable Support control moves on mobile-sized checkout and product pages and opens Tawk chat
- [x] Replace the failed third-party launcher drag hook with a controlled draggable support bubble that opens Tawk chat
- [x] Change the vendor product-page secondary action to add the selected product to cart with confirmation
- [x] Implement server-side zone, weight, and delivery-tier shipping calculation with validated inputs
- [x] Replace the free-text address with locked Nigeria, state, LGA, and street-detail fields and persist a standardized address string
- [x] Add checkout delivery-service selection, pricing breakdown, seller-contact note, and full automated and visual validation
- [x] Save a checkpoint containing the verified cart, delivery, address, and movable support update
- [x] Review unexpected preview visitor signals and distinguish normal public-preview traffic from suspicious activity
- [x] Report preview privacy and access-control findings without changing visibility settings unless approved
- [x] Inspect current user creation, order delivery status, payment configuration, and role-specific navigation
- [x] Define wallet, transaction-ledger, PIN, escrow, payout, and reconciliation controls
- [x] Add wallet, transaction, escrow, PIN, and withdrawal data structures with non-destructive migrations
- [x] Provision a zero-balance wallet for every account and implement secure PIN setup and verification
- [x] Add wallet-funded checkout authorization, escrow holding, and vendor earning release on delivered orders
- [x] Build buyer and vendor wallet access, dashboard balance, ledger, funding, withdrawal, and PIN flows
- [x] Add an administrator wallet-order view that can mark held wallet orders delivered and release vendor escrow end to end
- [x] Restrict Alpha Wallet checkout to vendor-backed listings until all catalogue items have a complete escrow allocation path
- [x] Prevent Alpha Wallet selection in checkout when any cart item is not an approved vendor listing and explain why
- [x] Document the held-order release verification procedure; defer a balance-changing integration run until a controlled non-production wallet test is authorized
- [x] Superseded by the completed atomic escrow-release claim immediately below
- [x] Make wallet escrow order release claim the held order state atomically before any buyer escrow debit
- [x] Connect provider-backed funding and withdrawal only after valid credentials and payout requirements are supplied
- [x] Confirm Paystack or Flutterwave as the live provider and approve the bank-account, webhook, and payout controls required for funding and withdrawals
- [x] Securely update and validate the selected Paystack credential without exposing it
- [x] Implement webhook-verified Paystack wallet funding and verified Nigerian bank payout recipient workflows
- [x] Add direct Nigerian bank-account verification, recipient storage, and PIN-authorized withdrawal requests in Wallet
- [x] Defer authenticated balance-changing PIN, ledger, and escrow-release validation until a controlled non-production wallet test is authorized
- [x] Confirm the signed-in Wallet funding form, Nigerian-bank recipient form, and Alpha Wallet checkout option render without initiating a financial action
- [x] Add automated checks that block static and self-owned listings from the Alpha Wallet escrow path
- [x] Save a checkpoint containing the verified unified wallet implementation
- [x] Add durable Paystack funding-attempt and withdrawal transfer-reference records with a safe migration
- [x] Implement server-only Paystack banking, transaction, transfer, and webhook-signature helpers without exposing credentials
- [x] Add protected wallet procedures for bank listing, account resolution, recipient creation, funding initialization, and confirmed PIN-authorized withdrawals
- [x] Reconcile verified Paystack funding and transfer webhooks idempotently into the wallet ledger and balances
- [x] Replace Wallet funding and withdrawal placeholders with explicit Paystack, verified-bank, and confirmation flows
- [x] Add direct duplicate-reconciliation coverage for Paystack wallet credits and withdrawal reversals
- [x] Defer non-production PIN, recipient submission, wallet checkout, ledger, and administrator-release validation until controlled test funds are authorized
- [x] Defer published-domain webhook registration and controlled live-money verification until the user has a published domain
- [x] Defer Paystack dashboard webhook registration and all live-money verification until the user has a published domain

- [x] Extend official-product and private sourcing persistence for stock snapshots, landed supplier cost, mass-import batch status, and inventory-sync task ownership
- [x] Safely query documented CJ catalogue inventory and shipping quotes for Nigeria without supplier orders, customer data, or public supplier exposure
- [x] Add an administrator-only mass SKU importer that parses bounded comma/newline input, applies a validated markup, processes images, and creates unpublished official drafts
- [x] Calculate suggested Naira draft prices from verified landed USD cost using a configurable documented exchange-rate policy, never auto-publish products
- [x] Add durable batch progress, per-SKU success/failure records, idempotency protection, and real-time administrator progress polling
- [x] Expose Alpha Collective warehouse stock only to buyers, block out-of-stock official products from cart/checkout, and display restrained low-stock messaging
- [x] Implement an idempotent 12-hour CJ inventory-sync handler with safe failure behavior; prepare but do not activate its schedule until the site is published
- [x] Add focused unit coverage, database migration validation, desktop/mobile visual checks, and a final checkpoint for mass import and inventory sync

- [x] Assess official provider contracts, deployment requirements, and required server secrets for Telegram alerts, NOWPayments, and transaction verification
- [x] Add a server-only, non-blocking administrator payment-notification service with Telegram delivery only after valid configuration is supplied
- [x] Enforce verified KYC before wallet dashboard access, wallet funding, wallet balance use, and all wallet deposit procedures
- [x] Add buyer-side delivery confirmation for eligible local-vendor escrow orders with idempotent commission-aware release controls
- [x] Prepare a publication-gated, idempotent seven-day escrow auto-release handler without activating a schedule before publication
- [x] Design a provider-verified crypto-deposit model with 15-minute locked quotes, unique payment references, confirmation checks, and permanently non-withdrawable crypto-origin credits
- [x] Add crypto funding UI only for verified, configured provider rails and ensure no client-side success can credit a wallet
- [x] Add security-focused tests, responsive validation, a safe migration, and a checkpoint for the staged payments and escrow work

- [x] Configure NOWPayments as the approved managed crypto gateway with server-only API and IPN verification using administrator-supplied server secrets
- [x] Remove all Pi credentials, validation tests, documentation, and future payment-path references from the project
- [x] Re-verify an active NOWPayments merchant API key and configured settlement account before enabling any crypto quote, callback, or wallet-credit path
- [x] Keep all NOWPayments payment creation, IPN callback crediting, and seven-day escrow schedule activation disabled until the administrator supplies a published HTTPS domain

- [x] Audit and replace public Alpha Collective branding across the storefront, navigation, product views, buttons, and SEO metadata while retaining legal and administrative parent-company references
- [x] Add a persistent, accessible Alpha Market cookie-consent banner with Terms of Use and Privacy Policy links
- [x] Create responsive Terms of Use and Privacy Policy routes that name Alpha Collective Corporation as the legal entity and disclose KYC, dropshipping, local-vendor escrow, crypto address, and non-withdrawable crypto-credit practices
- [x] Add route, cookie-consent, and branding regression tests; complete desktop/mobile checks and save a checkpoint

- [x] Review the supplied legal Terms and Privacy text, removing inactive Pi, invented infrastructure, and unsupported live-payment assertions while preserving approved legal clauses
- [x] Replace the standard legal-page copy with the supplied Alpha Market terms and privacy structure, remove draft language, and retain accurate KYC, escrow, dropshipping, NOWPayments, and crypto-credit disclosures
- [x] Revalidate legal-route content and responsive presentation, then save a standardized legal-page checkpoint

- [x] Compare reported CJ batch SKU stock results against the successful single-SKU importer without creating a supplier order
- [x] Correct the mass-import stock-resolution logic so unambiguously available CJ products create unpublished drafts and genuinely unavailable products remain blocked
- [x] Add reported-SKU-shaped regression coverage, validate batch progress messaging, and save a checkpoint

- [x] Diagnose why newly created mass-import drafts do not appear in the administrator saved-products list
- [x] Add bounded server-side saved-product queries that support up to 100 administrator official products and 100 vendor drafts with safe filtering
- [x] Add responsive status/category toggles, item counts, and page-switching controls to administrator and vendor saved-product views
- [x] Add regression coverage and visual validation for visible new drafts, filters, 100-item browsing, and pagination before checkpointing

- [x] Audit existing NOWPayments quote, IPN, private-attempt, and domain-gating code against the deferred crypto funding requirements
- [x] Confirm no safe crypto readiness or test gap remains without enabling payment creation, callback crediting, schedules, or other money movement
- [x] Validate the fail-closed published-domain guard and update deferred crypto tracker items accurately

- [x] Audit the current site-wide toast provider and alert presentation behavior
- [x] Reposition alerts to accessible top-center floating cards with Alpha Market error styling, close controls, and timed dismissal
- [x] Add notification regression coverage, visual checks, and a checkpoint for the updated alert experience

- [x] Audit Drizzle/MySQL connection behavior, public catalogue read paths, image processing, and sensitive write routes for high-traffic readiness
- [x] Add compatible connection-pool configuration guidance, cache-control for safe public read endpoints, and optimized responsive product-image delivery
- [x] Add lightweight in-process rate limits to sensitive write endpoints without exposing or enabling crypto funding
- [x] Add performance-safeguard tests, validate behavior, and save a checkpoint

- [x] Assess Alpha Market’s Express/Drizzle deployment compatibility with the requested Vercel-style target and managed hosting alternative
- [x] Verify public branding, cookie consent, and legal routes for production readiness without changing live payment or KYC safeguards
- [x] Document required production environment values and callback prerequisites without exposing secrets or enabling live crypto crediting

- [x] Verify the published Alpha Market domain and public storefront route availability
- [x] Validate published branding, cookie consent, Terms/Privacy links, and protected payment/dropshipping boundaries

- [x] Audit crypto funding persistence, wallet credit controls, NOWPayments provider contract, and callback routing for the authorized test flow
- [x] Add a server-created short-lived NOWPayments test quote and verified callback reconciliation that cannot credit a wallet before confirmation
- [x] Add controlled wallet test-flow presentation and explicit non-withdrawable status without weakening KYC or triggering supplier orders
- [x] Add security, signature, idempotency, and no-credit-before-confirmation tests; validate and checkpoint the test crypto flow

- [x] Switch the authorized NOWPayments flow from sandbox configuration to the official production endpoint with a ₦500 live-test ceiling
- [x] Verify the production quote and callback logic credits only independently confirmed finished payments into the non-withdrawable balance

- [x] Audit checkout payment selection, KYC guards, and administrator role enforcement for a safe end-to-end testing path
- [x] Add a controlled NOWPayments crypto checkout quote option without creating an order or credit before independent provider confirmation
- [x] Add narrowly scoped administrator-only test access while keeping all non-administrator KYC protections and customer warnings intact
- [x] Add regression coverage for checkout crypto selection, KYC boundaries, and administrator test access before checkpointing

- [x] Enforce the user-authorized ₦50,000 maximum only for administrator-controlled NOWPayments checkout quotes
- [x] Complete a pending NOWPayments checkout order only after an independently verified finished provider callback

- [x] Audit the Paystack wallet implementation, checkout settlement controls, and requirements for adding Flutterwave safely
- [x] Request server-only Paystack and Flutterwave credentials and configure provider verification without exposing secrets
- [x] Add selectable Paystack and Flutterwave checkout and wallet funding options with provider-verified completion only
- [x] Add signed webhook, idempotency, wallet-credit, and escrow-settlement regression coverage before checkpointing

- [x] Store the supplied Flutterwave webhook secret hash through managed secrets and validate signature verification before settlement use

- [x] Audit the current CJ importer, existing durable batch workflow, and approved supplier-data boundaries for a 50-item bulk workflow
- [x] Assess whether an authorized AliExpress supplier API or connector is available before accepting direct URLs or keyword searches
- [x] Design draft-only bulk import progress tracking that preserves manual pricing, image processing, source privacy, and no-order safeguards

- [x] Audit the current CJ administrator mass-import UI and durable batch state for progress and review-handoff gaps
- [x] Improve the CJ 50-item draft-only import controls, progress feedback, and completed-draft review handoff
- [x] Add focused progress and draft-review regression coverage, validate the UI, and checkpoint the CJ-only update

- [x] Audit public Alpha Market routes, product data contracts, and current search-engine head delivery
- [x] Add crawler-visible dynamic metadata and Product JSON-LD for public catalogue routes
- [x] Add dynamic sitemap.xml and robots.txt endpoints for published products and category pages only
- [x] Add technical SEO regression coverage, validate public route output, and checkpoint the release

- [x] Audit product fields, CJ import flow, admin editor controls, Gemini API integration options, and safety boundaries
- [x] Add persisted AI enhancement fields with a reviewed non-destructive migration and private/admin-only update path
- [x] Configure a server-only GEMINI_API_KEY and validate it without creating or changing any product
- [x] Add an administrator-triggered Gemini enhancement control with structured JSON validation and draft-only safeguards
- [x] Add regression coverage, verify the admin flow, and checkpoint the Gemini enhancement capability

- [x] Audit and remove every Tawk.to script, embed, launcher, and third-party support dependency
- [x] Design authenticated order-support and published-catalogue recommendation boundaries for Alpha AI Support
- [x] Add a server-only Gemini support service and protected support endpoint with safe order and product tools
- [x] Build the responsive floating Alpha AI Support chat UI with prompts, typing feedback, and message history
- [x] Add privacy, tool-scope, Gemini-response, and responsive-chat regression coverage before checkpointing

- [x] Audit the existing wallet, NOWPayments, Paystack withdrawal, exchange-rate, and crypto-network capabilities against the requested 2x SOL fee model
- [x] Define provider-compatible fee estimates and safe balance treatment without introducing unverified on-chain deposits or withdrawals
- [x] Audit Paystack withdrawal request, balance, fee-policy source, and recovery behavior for a fee-aware implementation
- [x] Add a deterministic Paystack transfer-fee estimate plus 20% platform markup and persist the associated wallet debit safely
- [x] Show requested amount, processing/bank fee, total balance debit, and insufficient-balance blocking in the withdrawal UI
- [x] Add fee calculation, transfer amount, insufficient-balance, recovery, and responsive UI regression coverage before checkpointing
