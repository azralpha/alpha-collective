import { TRPCError } from "@trpc/server";
import { customAlphabet } from "nanoid";
import { parse as parseCookieHeader } from "cookie";
import { z } from "zod";
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_PRODUCTS,
  REFERRAL_DISCOUNT,
  REFERRAL_MINIMUM_SUBTOTAL,
  type MarketplaceProduct,
  getCartSubtotal,
  qualifiesForReferralDiscount,
  resolveCartLines,
} from "../../shared/marketplace";
import { DELIVERY_SERVICE_TIERS, calculateDeliveryQuote } from "../../shared/delivery";
import { formatNigerianDeliveryAddress, isNigerianLga, isNigerianState } from "../../shared/nigeriaAddress";
import {
  createOfficialProduct,
  createOrder,
  createReferralShare,
  confirmBuyerReceivedWalletOrder,
  assessReferralFraudBeforeCheckout,
  cancelPendingBonusRewardsForReturnedOrder,
  createWithdrawalOtpChallenge,
  createWalletEscrowOrder,
  createVendorApplication,
  createVendorProduct,
  ensureKycProfileForUser,
  createPendingWalletWithdrawal,
  createWalletFundingAttempt,
  ensureWalletForUser,
  failWalletWithdrawalBeforeTransfer,
  getReferralShareByCode,
  getReferralShareByRewardCode,
  getReferralRewardSettings,
  getKycProfileForUser,
  grantKycCompletionBonus,
  getFulfilmentIntegration,
  getBuyerRewardSummary,
  getVendorRewardSummary,
  getVendorApplicationForUser,
  getCurrentVendorCommissionRate,
  getVendorProductForApplication,
  getWalletBankRecipientForUser,
  getWalletForUser,
  isReferralEligibleUser,
  listAdminReviewProducts,
  listAdminFulfilmentJobs,
  listAdminOfficialProducts,
  listActiveFreeDeliveryVouchers,
  listActiveOfficialProducts,
  listActiveOfficialProductsWithSourcing,
  listApprovedVendorProducts,
  listBuyerWalletEscrowOrders,
  listWalletFundingAttemptsForUser,
  listPendingBonusRewardsForUser,
  listHeldWalletOrders,
  listOrdersAwaitingDelivery,
  listOrdersInRewardReturnWindow,
  listReferralSharesForUser,
  listVendorProducts,
  listWalletTransactionsForUser,
  listWithdrawalRequestsForUser,
  markWalletFundingAttemptFailed,
  markFulfilmentJobRetryQueued,
  markDeliveredOrderReturned,
  markNonWalletOrderDelivered,
  markWalletOrderDelivered,
  markWalletWithdrawalProcessing,
  qualifyReferralShare,
  issueFreeDeliveryVoucherIfQualified,
  queueReferralBonusAfterDeliveredOrder,
  queueCashbackAfterDeliveredOrder,
  queueVerifiedPostSaleBonus,
  recordUserRequestSecuritySignal,
  recordVerifiedVendorDispatch,
  recordWalletPinFailure,
  redeemReferralReward,
  releaseWalletEscrowOrder,
  resetWalletPinFailures,
  saveWalletBankRecipient,
  saveFulfilmentIntegration,
  saveCjInventorySyncScheduleTaskUid,
  submitKycGovernmentId,
  updateVendorProductStatus,
  updateOfficialProduct,
  updateOfficialProductStatus,
  updateReferralRewardSettings,
  updateVendorDraftProduct,
  updateWalletPin,
} from "../db";
import { extractClientIp, normalizeDeviceId } from "../referralFraud";
import { storagePut } from "../storage";
import { decodeProductImageDataUrl, importCjProductImage, ProductImageProcessingError, storeProcessedProductImage } from "../productImageProcessing";
import { CjDropshippingError, fetchCjProductForImport } from "../cjDropshipping";
import { createCjMassImportBatch, getCjMassImportBatch, processNextCjMassImportItem } from "../cjMassImport";
import { notifyAdminPaymentEvent } from "../paymentNotifications";
import { adminProcedure, protectedProcedure, publicProcedure, router, sensitiveProtectedProcedure } from "../_core/trpc";
import { hashTransactionPin, validateTransactionPin, verifyTransactionPin } from "../walletSecurity";
import { generateWithdrawalOtp, hashWithdrawalOtp } from "../withdrawalOtpSecurity";
import { sanitizePlainText } from "../securityText";
import { isWithdrawalOtpEmailDeliveryConfigured } from "../withdrawalOtpEmail";
import { processCjFulfilmentQueue } from "../fulfilmentQueue";
import { createHeartbeatJob } from "../_core/heartbeat";
import { COOKIE_NAME } from "@shared/const";
import {
  PaystackProviderError,
  createPaystackTransferRecipient,
  initializePaystackFunding,
  initiatePaystackTransfer,
  isDefinitivePaystackRequestFailure,
  listPaystackNigerianBanks,
  maskNigerianAccountNumber,
  resolvePaystackNigerianAccount,
} from "../paystack";

const cartLineSchema = z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10) });
const shareCodeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const orderReferenceAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const rewardCodeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const deliveryQuoteInputSchema = z.object({
  destinationState: z.string().trim().min(2).max(80),
  weightKg: z.number().positive().max(5000),
  serviceTier: z.enum(DELIVERY_SERVICE_TIERS),
});
const walletPinSchema = z.string().regex(/^\d{4}$/, "Enter your four-digit transaction PIN.");
const walletAmountSchema = z.number().int().min(100, "Enter at least ₦100.").max(5_000_000, "Enter an amount up to ₦5,000,000.");
const paystackFundingReferenceAlphabet = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 20);
const paystackWithdrawalReferenceAlphabet = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 20);
const walletCheckoutInputSchema = z.object({
  buyerName: z.string().trim().min(2).max(120).transform(sanitizePlainText).refine(value => value.length >= 2, "Enter a valid buyer name."),
  buyerPhone: z.string().trim().min(7).max(32),
  deliveryAddress: z.object({ country: z.literal("Nigeria"), state: z.string().trim().min(2).max(80).transform(sanitizePlainText), lga: z.string().trim().min(2).max(120).transform(sanitizePlainText), streetDetails: z.string().trim().min(8).max(350).transform(sanitizePlainText).refine(value => value.length >= 8, "Enter valid street details.") }),
  packageWeightKg: z.number().positive().max(5000),
  deliveryTier: z.enum(DELIVERY_SERVICE_TIERS),
  items: z.array(cartLineSchema).min(1).max(12),
  transactionPin: walletPinSchema,
  referralCode: z.string().trim().max(32).optional(),
  freeDeliveryVoucherId: z.number().int().positive().optional(),
});

const cjMassImportInputSchema = z.object({
  skuText: z.string().trim().min(3).max(8_000),
  markupPercent: z.number().min(0).max(500),
  exchangeRateNgnPerUsd: z.number().min(100).max(10_000),
  category: z.enum(MARKETPLACE_CATEGORIES),
});
const savedProductListInputSchema = z.object({
  status: z.enum(["draft", "active", "rejected"]).optional(),
  category: z.enum(MARKETPLACE_CATEGORIES).optional(),
  search: z.string().trim().max(120).transform(sanitizePlainText).optional(),
  page: z.number().int().min(1).max(100_000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

function newShareCode() { return `ALPHA-${shareCodeAlphabet()}`; }
function newOrderReference() { return `AC-${orderReferenceAlphabet()}`; }
function newRewardCode() { return `THANKS-${rewardCodeAlphabet()}`; }
function newPaystackFundingReference() { return `acwfund_${paystackFundingReferenceAlphabet()}`; }
function newPaystackWithdrawalReference() { return `acwwith_${paystackWithdrawalReferenceAlphabet()}`; }

const walletKycProcedure = sensitiveProtectedProcedure.use(async ({ ctx, next }) => {
  const profile = await ensureKycProfileForUser(ctx.user.id);
  if (profile.status !== "verified") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete KYC Verification before accessing or using Alpha Wallet." });
  return next({ ctx });
});

function paystackErrorToTrpc(error: unknown, fallback: string) {
  if (error instanceof PaystackProviderError) {
    const code = error.statusCode === 503 ? "PRECONDITION_FAILED" : "BAD_REQUEST";
    return new TRPCError({ code, message: error.statusCode >= 500 ? fallback : error.message });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

function validateNigerianState(state: string) {
  if (!isNigerianState(state)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid Nigerian state or the FCT." });
  }
}

async function authorizeWalletPin(userId: number, pin: string) {
  const wallet = await getWalletForUser(userId);
  if (!wallet?.pinHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Set your four-digit transaction PIN before using Alpha Wallet." });
  if (wallet.pinLockedUntil && wallet.pinLockedUntil > new Date()) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Wallet PIN is temporarily locked. Please try again later." });
  if (await verifyTransactionPin(pin, wallet.pinHash)) {
    await resetWalletPinFailures(userId);
    return wallet;
  }
  const failedAttempts = wallet.pinFailedAttempts + 1;
  const lockedUntil = failedAttempts >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : null;
  await recordWalletPinFailure(userId, failedAttempts, lockedUntil);
  throw new TRPCError({ code: lockedUntil ? "TOO_MANY_REQUESTS" : "UNAUTHORIZED", message: lockedUntil ? "Wallet PIN is locked for 15 minutes after three failed attempts." : "Incorrect transaction PIN." });
}

function createVendorCatalog(products: Awaited<ReturnType<typeof listApprovedVendorProducts>>): MarketplaceProduct[] {
  return products.flatMap(product => {
    const imageUrls = (product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []).filter(Boolean);
    if (!imageUrls.length) return [];
    return [{
      id: `vendor-${product.id}`,
      title: product.title,
      vendor: product.vendor,
      vendorUserId: product.vendorUserId,
      vendorCommissionRate: product.commissionRate,
      category: product.category,
      price: product.price,
      formerPrice: undefined,
      badge: product.lightningSeller ? "Lightning Seller • Verified" : "Verified seller find",
      imageUrl: imageUrls[0],
      imageUrls,
      description: product.description,
      detail: product.description,
    }];
  });
}

function createOfficialCatalog(products: Awaited<ReturnType<typeof listActiveOfficialProducts>>): MarketplaceProduct[] {
  return products.flatMap(product => {
    const imageUrls = (product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []).filter(Boolean);
    if (!imageUrls.length) return [];
    return [{
      id: `official-${product.id}`,
      title: product.title,
      vendor: "Alpha Collective Official",
      category: product.category,
      price: product.price,
      formerPrice: product.formerPrice ?? undefined,
      badge: product.badge ?? "Alpha Collective pick",
      imageUrl: imageUrls[0],
      imageUrls,
      description: product.description,
      detail: product.detail,
      stockQuantity: product.stockQuantity ?? undefined,
    }];
  });
}

const productImageDataUrlSchema = z.string().max(7_000_000);
const vendorProductInputSchema = z.object({ title: z.string().trim().min(2).max(180).transform(sanitizePlainText).refine(value => value.length >= 2, "Enter a valid product title."), category: z.enum(MARKETPLACE_CATEGORIES), price: z.number().int().min(500).max(5000000), description: z.string().trim().min(12).max(1200).transform(sanitizePlainText).refine(value => value.length >= 12, "Enter a valid product description."), imageUrls: z.array(z.string().startsWith("/manus-storage/").max(500)).min(1).max(5) });
const officialProductInputSchema = z.object({
  title: z.string().trim().min(2).max(180).transform(sanitizePlainText).refine(value => value.length >= 2, "Enter a valid product title."),
  category: z.enum(MARKETPLACE_CATEGORIES),
  price: z.number().int().min(500).max(5_000_000),
  formerPrice: z.number().int().min(500).max(5_000_000).nullable().optional(),
  badge: z.string().trim().max(80).transform(sanitizePlainText).nullable().optional(),
  description: z.string().trim().min(12).max(1200).transform(sanitizePlainText).refine(value => value.length >= 12, "Enter a valid product description."),
  detail: z.string().trim().min(12).max(1600).transform(sanitizePlainText).refine(value => value.length >= 12, "Enter valid product details."),
  imageUrls: z.array(z.string().startsWith("/manus-storage/official-products/").max(500)).min(1).max(5),
  status: z.enum(["draft", "active", "rejected"]),
  fulfillmentProvider: z.enum(["local_vendor", "auto_fulfill_api", "manual_admin"]),
  externalSkuId: z.string().trim().max(120).transform(sanitizePlainText).nullable().optional(),
  supplierCost: z.number().min(0).max(100_000_000).nullable().optional(),
  supplierCurrency: z.enum(["NGN", "USD"]),
}).superRefine((value, ctx) => {
  if (value.fulfillmentProvider === "auto_fulfill_api" && !value.externalSkuId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalSkuId"], message: "An External SKU ID is required for Auto-Fulfill API products." });
});

function toOfficialProductInput(input: z.infer<typeof officialProductInputSchema>) {
  return {
    title: input.title,
    category: input.category,
    price: input.price,
    formerPrice: input.formerPrice ?? null,
    badge: input.badge ?? null,
    description: input.description,
    detail: input.detail,
    imageUrls: input.imageUrls,
    status: input.status,
    sourcing: { fulfillmentProvider: input.fulfillmentProvider, externalSkuId: input.externalSkuId ?? null, supplierCost: input.supplierCost === null || input.supplierCost === undefined ? null : input.supplierCost.toFixed(2), supplierCurrency: input.supplierCurrency },
  };
}

function decodeProductImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a JPG, PNG, or WebP image." });
  const [, contentType, base64] = match;
  const data = Buffer.from(base64, "base64");
  if (data.length === 0 || data.length > 5 * 1024 * 1024) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Product images must be 5 MB or smaller." });
  }
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  return { contentType, data, extension };
}

function decodeKycGovernmentId(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a JPG, PNG, or WebP government ID image." });
  const [, contentType, base64] = match;
  const data = Buffer.from(base64, "base64");
  if (data.length === 0 || data.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Government ID images must be 5 MB or smaller." });
  return { contentType, data, extension: contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1] };
}

export const marketplaceRouter = router({
  rewards: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const [buyer, vendor] = await Promise.all([getBuyerRewardSummary(ctx.user.id), getVendorRewardSummary(ctx.user.id)]);
      return { buyer, vendor };
    }),
  }),
  publicProducts: publicProcedure.query(async () => {
    const [products, officialProducts] = await Promise.all([listApprovedVendorProducts(), listActiveOfficialProducts()]);
    return [...createOfficialCatalog(officialProducts), ...createVendorCatalog(products)];
  }),
  deliveryQuote: publicProcedure
    .input(deliveryQuoteInputSchema)
    .query(({ input }) => {
      validateNigerianState(input.destinationState);
      return calculateDeliveryQuote(input);
    }),
  wallet: router({
    dashboard: walletKycProcedure.query(async ({ ctx }) => {
      const wallet = await getWalletForUser(ctx.user.id);
      if (!wallet) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Wallet is being provisioned. Refresh and try again." });
      const [transactions, recipient, withdrawals, fundingAttempts, pendingRewards, escrowOrders] = await Promise.all([
        listWalletTransactionsForUser(ctx.user.id),
        getWalletBankRecipientForUser(ctx.user.id),
        listWithdrawalRequestsForUser(ctx.user.id),
        listWalletFundingAttemptsForUser(ctx.user.id),
        listPendingBonusRewardsForUser(ctx.user.id),
        listBuyerWalletEscrowOrders(ctx.user.id),
      ]);
      return {
        totalBalance: wallet.withdrawableBalance + wallet.bonusBalance,
        withdrawableBalance: wallet.withdrawableBalance,
        bonusBalance: wallet.bonusBalance,
        escrowBalance: wallet.escrowBalance,
        pendingBonusBalance: pendingRewards.reduce((total, reward) => total + reward.amount, 0),
        pendingRewards: pendingRewards.map(reward => ({ id: reward.id, amount: reward.amount, type: reward.type, releaseAt: reward.releaseAt, orderReference: reward.orderReference })),
        hasPin: Boolean(wallet.pinHash),
        recipient: recipient ? { bankName: recipient.bankName, accountNumberMasked: recipient.accountNumberMasked, accountName: recipient.accountName, kycBindingStatus: recipient.kycBindingStatus, verifiedAt: recipient.verifiedAt } : null,
        withdrawals: withdrawals.map(request => ({ id: request.id, amount: request.amount, status: request.status, createdAt: request.createdAt })),
        fundingAttempts: fundingAttempts.map(attempt => ({ reference: attempt.reference, amount: attempt.amount, status: attempt.status, createdAt: attempt.createdAt })),
        escrowOrders: escrowOrders.map(order => ({ reference: order.reference, total: order.total, fulfillmentStatus: order.fulfillmentStatus, deliveredAt: order.deliveredAt, buyerConfirmedAt: order.buyerConfirmedAt, localVendorOrder: order.orderLines.some(line => Boolean(line.vendorUserId)) })),
        transactions,
      };
    }),
    setPin: walletKycProcedure
      .input(z.object({ pin: walletPinSchema, confirmation: walletPinSchema }))
      .mutation(async ({ ctx, input }) => {
        if (input.pin !== input.confirmation) throw new TRPCError({ code: "BAD_REQUEST", message: "Your PIN confirmation does not match." });
        try { validateTransactionPin(input.pin); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid transaction PIN." }); }
        await updateWalletPin(ctx.user.id, await hashTransactionPin(input.pin));
        return { hasPin: true };
      }),
    listBanks: walletKycProcedure.query(async () => {
      try {
        return await listPaystackNigerianBanks();
      } catch (error) {
        throw paystackErrorToTrpc(error, "Nigerian banks are temporarily unavailable. Please try again.");
      }
    }),
    verifyBankAccount: walletKycProcedure
      .input(z.object({ bankCode: z.string().trim().min(2).max(24), accountNumber: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit Nigerian account number.") }))
      .mutation(async ({ ctx, input }) => {
        try {
          const banks = await listPaystackNigerianBanks();
          const bank = banks.find(candidate => candidate.code === input.bankCode);
          if (!bank) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a Nigerian bank from the provided list." });
          const resolved = await resolvePaystackNigerianAccount(input.accountNumber, input.bankCode);
          if (resolved.accountNumber !== input.accountNumber) throw new TRPCError({ code: "BAD_REQUEST", message: "The resolved bank account did not match the account number entered." });
          const recipientCode = await createPaystackTransferRecipient({ accountName: resolved.accountName, accountNumber: input.accountNumber, bankCode: input.bankCode });
          await ensureWalletForUser(ctx.user.id);
          await saveWalletBankRecipient({
            userId: ctx.user.id,
            bankCode: bank.code,
            bankName: bank.name,
            accountNumberMasked: maskNigerianAccountNumber(input.accountNumber),
            accountName: resolved.accountName,
            paystackRecipientCode: recipientCode,
          });
          return { bankName: bank.name, accountNumberMasked: maskNigerianAccountNumber(input.accountNumber), accountName: resolved.accountName };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw paystackErrorToTrpc(error, "Your bank account could not be verified right now. Please try again.");
        }
      }),
    initializeFunding: walletKycProcedure
      .input(z.object({ amount: walletAmountSchema, email: z.string().trim().email("Enter the email address you use for payment receipts.").max(320) }))
      .mutation(async ({ ctx, input }) => {
        const wallet = await ensureWalletForUser(ctx.user.id);
        const reference = newPaystackFundingReference();
        await createWalletFundingAttempt({ walletId: wallet.id, userId: ctx.user.id, reference, amount: input.amount });
        try {
          const payment = await initializePaystackFunding({ email: input.email.toLowerCase(), reference, amountNaira: input.amount });
          return { reference: payment.reference, authorizationUrl: payment.authorizationUrl };
        } catch (error) {
          if (isDefinitivePaystackRequestFailure(error)) await markWalletFundingAttemptFailed(reference);
          throw paystackErrorToTrpc(error, "Funding could not be initialized. Please try again.");
        }
      }),
    requestWithdrawal: walletKycProcedure
      .input(z.object({ amount: walletAmountSchema, transactionPin: walletPinSchema, confirmed: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const wallet = await authorizeWalletPin(ctx.user.id, input.transactionPin);
        const vendor = await getVendorApplicationForUser(ctx.user.id);
        if (!vendor) throw new TRPCError({ code: "FORBIDDEN", message: "Wallet withdrawals are available to KYC-verified vendors only." });
        const kyc = await getKycProfileForUser(ctx.user.id);
        if (kyc?.status !== "verified") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Please complete KYC Verification in your dashboard to enable withdrawals." });
        const recipient = await getWalletBankRecipientForUser(ctx.user.id);
        if (!recipient) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Verify your Nigerian bank account before requesting a withdrawal." });
        if (recipient.kycBindingStatus !== "locked") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete KYC bank-name matching before requesting a withdrawal." });
        if (wallet.withdrawableBalance < input.amount) throw new TRPCError({ code: "BAD_REQUEST", message: "Only your withdrawable balance can be sent to your bank, and it is not enough for this withdrawal." });
        if (!isWithdrawalOtpEmailDeliveryConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Withdrawal OTP email delivery is not configured yet. No bank transfer has been started." });
        const otp = generateWithdrawalOtp();
        const challengeId = await createWithdrawalOtpChallenge({ userId: ctx.user.id, recipientId: recipient.id, amount: input.amount, otpHash: await hashWithdrawalOtp(otp), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
        return { challengeId, otpDelivery: "unavailable" as const };
      }),
    checkout: walletKycProcedure
      .input(walletCheckoutInputSchema)
      .mutation(async ({ ctx, input }) => {
        await authorizeWalletPin(ctx.user.id, input.transactionPin);
        validateNigerianState(input.deliveryAddress.state);
        if (!isNigerianLga(input.deliveryAddress.state, input.deliveryAddress.lga)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid local government area for the selected state." });
        const baseDeliveryQuote = calculateDeliveryQuote({ destinationState: input.deliveryAddress.state, weightKg: input.packageWeightKg, serviceTier: input.deliveryTier });
        const activeVouchers = input.freeDeliveryVoucherId ? await listActiveFreeDeliveryVouchers(ctx.user.id) : [];
        const freeDeliveryVoucher = activeVouchers.find(voucher => voucher.id === input.freeDeliveryVoucherId);
        if (input.freeDeliveryVoucherId && !freeDeliveryVoucher) throw new TRPCError({ code: "BAD_REQUEST", message: "That free-delivery voucher is no longer available." });
        const deliveryQuote = freeDeliveryVoucher ? { ...baseDeliveryQuote, deliveryFee: 0 } : baseDeliveryQuote;
        const [vendorProducts, officialProducts] = await Promise.all([listApprovedVendorProducts(), listActiveOfficialProductsWithSourcing()]);
        const officialCatalog = createOfficialCatalog(officialProducts);
        const catalog = [...MARKETPLACE_PRODUCTS, ...officialCatalog, ...createVendorCatalog(vendorProducts)];
        const resolvedLines = resolveCartLines(input.items, catalog);
        if (resolvedLines.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart does not contain a valid product." });
        const officialByProductId = new Map(officialProducts.map(product => [`official-${product.id}`, product]));
        if (resolvedLines.some(line => !line.product.vendorUserId && !officialByProductId.has(line.product.id))) throw new TRPCError({ code: "BAD_REQUEST", message: "Alpha Wallet currently supports approved vendor listings and Alpha Collective Official products only." });
        if (resolvedLines.some(line => line.product.vendorUserId === ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Use Alpha Wallet to purchase from other vendors, not your own listing." });
        const unavailableOfficial = resolvedLines.find(line => {
          const official = officialByProductId.get(line.product.id);
          return official?.stockQuantity !== null && official?.stockQuantity !== undefined && line.quantity > official.stockQuantity;
        });
        if (unavailableOfficial) throw new TRPCError({ code: "BAD_REQUEST", message: `${unavailableOfficial.product.title} is currently unavailable in the requested quantity.` });
        const subtotal = getCartSubtotal(input.items, catalog);
        let appliedCode: string | undefined;
        let discount = 0;
        if (input.referralCode) {
          const candidate = input.referralCode.toUpperCase();
          if (!candidate.startsWith("ALPHA-")) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid referral code beginning ALPHA-." });
          const share = await getReferralShareByCode(candidate);
          if (!share || share.status !== "shared") throw new TRPCError({ code: "BAD_REQUEST", message: "That referral code is unavailable or has already been used." });
          if (share.sharerUserId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot use your own referral code." });
          if (subtotal < share.minimumOrderSubtotal) throw new TRPCError({ code: "BAD_REQUEST", message: `This referral code applies to orders from ₦${share.minimumOrderSubtotal.toLocaleString("en-NG")}.` });
          const fraud = await assessReferralFraudBeforeCheckout({ referralShareId: share.id, sharerUserId: share.sharerUserId, referredUserId: ctx.user.id });
          if (!fraud.flagged) {
            appliedCode = candidate;
            discount = share.rewardValue;
          }
        }
        const reference = newOrderReference();
        const total = subtotal - discount + deliveryQuote.deliveryFee;
        const allocations = (await Promise.all(resolvedLines.map(async line => {
          if (!line.product.vendorUserId) return [];
          const commissionRate = await getCurrentVendorCommissionRate(line.product.vendorUserId, 0);
          const commissionAmount = Math.round(line.lineTotal * commissionRate / 100);
          return [{ vendorUserId: line.product.vendorUserId, grossAmount: line.lineTotal, commissionAmount, netAmount: line.lineTotal - commissionAmount }];
        }))).flat();
        const deliveryAddress = formatNigerianDeliveryAddress(input.deliveryAddress);
        const fulfilmentJobInputs = resolvedLines.flatMap(line => {
          const official = officialByProductId.get(line.product.id);
          if (!official || official.fulfillmentProvider !== "auto_fulfill_api" || !official.externalSkuId) return [];
          return [{
            orderReference: reference,
            officialProductId: official.id,
            provider: "cj_dropshipping" as const,
            externalSkuSnapshot: official.externalSkuId,
            quantity: line.quantity,
            deliverySnapshot: { buyerName: input.buyerName, buyerPhone: input.buyerPhone, deliveryAddress, countryCode: "NG" as const, state: input.deliveryAddress.state, lga: input.deliveryAddress.lga, streetDetails: input.deliveryAddress.streetDetails },
            idempotencyKey: `cj-wallet-${reference}-${official.id}`,
          }];
        });
        try {
          await createWalletEscrowOrder({
            buyerUserId: ctx.user.id,
            order: {
              reference, buyerUserId: ctx.user.id, buyerName: input.buyerName, buyerPhone: input.buyerPhone,
              deliveryAddress, paymentMethod: "wallet", paymentStatus: "wallet_escrow", fulfillmentStatus: "pending",
              subtotal, referralDiscount: discount, deliveryFee: deliveryQuote.deliveryFee, total, referralCode: appliedCode, discountType: appliedCode ? "referral" : "none",
              orderLines: resolvedLines.map(line => ({ productId: line.product.id, title: line.product.title, quantity: line.quantity, unitPrice: line.product.price, lineTotal: line.lineTotal, vendorUserId: line.product.vendorUserId })),
            },
            allocations,
            fulfilmentJobInputs,
            freeDeliveryVoucherId: freeDeliveryVoucher?.id,
          });
          if (fulfilmentJobInputs.length) void processCjFulfilmentQueue(5).catch(() => undefined);
          void notifyAdminPaymentEvent({ event: "wallet_escrow_created", reference, amountNaira: total });
        } catch (error) {
          if (error instanceof Error && error.message === "INSUFFICIENT_WALLET_BALANCE") throw new TRPCError({ code: "BAD_REQUEST", message: "Your available Alpha Wallet balance is not enough for this order." });
          throw error;
        }
        return { reference, paymentStatus: "wallet_escrow" as const, subtotal, discount, deliveryFee: deliveryQuote.deliveryFee, total, deliveryQuote };
      }),
    confirmDelivery: walletKycProcedure
      .input(z.object({ reference: z.string().trim().min(8).max(40) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await confirmBuyerReceivedWalletOrder(ctx.user.id, input.reference);
          const bonusReward = await queueReferralBonusAfterDeliveredOrder(input.reference);
          const [cashback, freeDeliveryVoucher] = await Promise.all([queueCashbackAfterDeliveredOrder(input.reference), issueFreeDeliveryVoucherIfQualified(input.reference)]);
          void notifyAdminPaymentEvent({ event: "local_vendor_escrow_released", reference: input.reference, amountNaira: result.order.total });
          return { reference: input.reference, releasedVendors: result.releasedVendors, bonusReward, cashback, freeDeliveryVoucher };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not confirm delivery." });
        }
      }),
  }),
  kyc: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const [profile, vendor] = await Promise.all([ensureKycProfileForUser(ctx.user.id), getVendorApplicationForUser(ctx.user.id)]);
      if (profile.status === "verified") await grantKycCompletionBonus(ctx.user.id);
      return {
        status: profile.status,
        submittedLegalName: profile.submittedLegalName,
        verifiedLegalName: profile.verifiedLegalName,
        hasGovernmentId: Boolean(profile.governmentIdImageUrl),
        vendorKycRequired: Boolean(vendor),
        failureReason: profile.failureReason,
      };
    }),
    submitGovernmentId: protectedProcedure
      .input(z.object({ legalName: z.string().trim().min(3).max(160), imageDataUrl: z.string().max(7_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const { contentType, data, extension } = decodeKycGovernmentId(input.imageDataUrl);
        const uploaded = await storagePut(`kyc-private/${ctx.user.id}/${Date.now()}.${extension}`, data, contentType);
        const profile = await submitKycGovernmentId({ userId: ctx.user.id, submittedLegalName: input.legalName, governmentIdImageUrl: uploaded.url });
        return { status: profile?.status ?? "identity_pending", message: "Your ID was securely submitted. Smile ID verification will begin only after the provider is configured." };
      }),
  }),
  admin: router({
    reviewProducts: adminProcedure.query(() => listAdminReviewProducts()),
    walletOrders: adminProcedure.query(() => listHeldWalletOrders()),
    setProductStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "rejected"]) }))
      .mutation(async ({ input }) => {
        await updateVendorProductStatus(input.id, input.status);
        return { id: input.id, status: input.status };
      }),
    officialProducts: adminProcedure.input(savedProductListInputSchema.optional()).query(({ input }) => listAdminOfficialProducts(input ?? {})),
    uploadOfficialProductImage: adminProcedure
      .input(z.object({ dataUrl: productImageDataUrlSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          const data = decodeProductImageDataUrl(input.dataUrl);
          const result = await storeProcessedProductImage({ source: data, storagePrefix: `official-products/${ctx.user.id}/${Date.now()}` });
          return { imageUrl: result.url };
        } catch (error) {
          if (error instanceof ProductImageProcessingError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          throw error;
        }
      }),
    importCjProduct: adminProcedure
      .input(z.object({ sku: z.string().trim().min(3).max(120).regex(/^[A-Za-z0-9_-]+$/, "Enter a valid CJ product SKU.") }))
      .mutation(async ({ ctx, input }) => {
        try {
          const product = await fetchCjProductForImport(input.sku);
          const imageUrls = await Promise.all(product.imageUrls.map((imageUrl, index) => importCjProductImage({ imageUrl, storagePrefix: `official-products/${ctx.user.id}/cj-import/${Date.now()}-${index}` }).then(result => result.url)));
          return { ...product, imageUrls, fulfillmentProvider: "auto_fulfill_api" as const, status: "draft" as const };
        } catch (error) {
          const message = error instanceof CjDropshippingError || error instanceof ProductImageProcessingError ? error.message : "CJ product import could not be completed.";
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
      }),
    startCjMassImport: adminProcedure
      .input(cjMassImportInputSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const batchId = await createCjMassImportBatch({ requestedByUserId: ctx.user.id, ...input });
          return await getCjMassImportBatch(batchId, ctx.user.id);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof CjDropshippingError ? error.message : "The CJ mass import could not be started." });
        }
      }),
    cjMassImportProgress: adminProcedure
      .input(z.object({ batchId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const batch = await getCjMassImportBatch(input.batchId, ctx.user.id);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "That CJ import batch was not found." });
        return batch;
      }),
    processNextCjMassImportItem: adminProcedure
      .input(z.object({ batchId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const batch = await processNextCjMassImportItem(input.batchId, ctx.user.id);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "That CJ import batch was not found." });
        return batch;
      }),
    createOfficialProduct: adminProcedure
      .input(officialProductInputSchema)
      .mutation(async ({ input }) => {
        const id = await createOfficialProduct(toOfficialProductInput(input));
        return { id };
      }),
    updateOfficialProduct: adminProcedure
      .input(officialProductInputSchema.safeExtend({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await updateOfficialProduct(input.id, toOfficialProductInput(input));
        return { id: input.id };
      }),
    setOfficialProductStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["draft", "active", "rejected"]) }))
      .mutation(async ({ input }) => {
        await updateOfficialProductStatus(input.id, input.status);
        return input;
      }),
    fulfilmentIntegration: adminProcedure.query(async () => {
      const integration = await getFulfilmentIntegration("cj_dropshipping");
      return integration
        ? { enabled: Boolean(integration.enabled), callbackUrl: integration.callbackUrl, defaultLogisticsName: integration.defaultLogisticsName, defaultFromCountryCode: integration.defaultFromCountryCode, orderMode: integration.orderMode, hasServerCredential: Boolean(process.env.CJ_DROPSHIPPING_API_KEY), inventorySyncScheduled: Boolean(integration.inventorySyncScheduleTaskUid), inventorySyncLastCompletedAt: integration.inventorySyncLastCompletedAt, inventorySyncLastError: integration.inventorySyncLastError }
        : { enabled: false, callbackUrl: null, defaultLogisticsName: null, defaultFromCountryCode: null, orderMode: "create_only" as const, hasServerCredential: Boolean(process.env.CJ_DROPSHIPPING_API_KEY), inventorySyncScheduled: false, inventorySyncLastCompletedAt: null, inventorySyncLastError: null };
    }),
    activateCjInventorySync: adminProcedure.mutation(async ({ ctx }) => {
      if (process.env.NODE_ENV !== "production") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Publish this site before activating the 12-hour CJ inventory sync." });
      const integration = await getFulfilmentIntegration("cj_dropshipping");
      if (integration?.inventorySyncScheduleTaskUid) return { scheduled: true, alreadyScheduled: true, nextExecutionAt: null };
      const sessionToken = parseCookieHeader(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await createHeartbeatJob({ name: "alpha-collective-cj-inventory-sync", cron: "0 0 */12 * * *", path: "/api/scheduled/cj-inventory-sync", description: "Refreshes stock snapshots for stock-managed Alpha Collective Official CJ drafts every 12 hours." }, sessionToken);
      await saveCjInventorySyncScheduleTaskUid(job.taskUid);
      return { scheduled: true, alreadyScheduled: false, nextExecutionAt: job.nextExecutionAt ?? null };
    }),
    saveFulfilmentIntegration: adminProcedure
      .input(z.object({ enabled: z.boolean(), callbackUrl: z.string().trim().url().max(500).nullable().optional(), defaultLogisticsName: z.string().trim().max(80).transform(sanitizePlainText).nullable().optional(), defaultFromCountryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).transform(value => value.toUpperCase()).nullable().optional(), orderMode: z.enum(["create_only", "balance_payment"]) }))
      .mutation(async ({ input }) => {
        const credentialAvailable = Boolean(process.env.CJ_DROPSHIPPING_API_KEY);
        if (input.enabled && !credentialAvailable) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add the CJ Dropshipping server credential before enabling automatic fulfilment." });
        const integration = await saveFulfilmentIntegration({ provider: "cj_dropshipping", enabled: input.enabled, apiBaseUrl: "https://developers.cjdropshipping.com", callbackUrl: input.callbackUrl ?? null, defaultLogisticsName: input.defaultLogisticsName ?? null, defaultFromCountryCode: input.defaultFromCountryCode ?? null, orderMode: input.orderMode });
        return { enabled: Boolean(integration?.enabled), hasServerCredential: credentialAvailable };
      }),
    fulfilmentJobs: adminProcedure.query(() => listAdminFulfilmentJobs()),
    retryFulfilmentJob: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await markFulfilmentJobRetryQueued(input.id);
        return { id: input.id, status: "queued" as const };
      }),
    markWalletOrderDelivered: adminProcedure
      .input(z.object({ reference: z.string().trim().min(8).max(40) }))
      .mutation(async ({ input }) => {
        try {
          await markWalletOrderDelivered(input.reference);
          return { reference: input.reference, awaitingBuyerConfirmation: true };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not mark this wallet order as delivered." });
        }
      }),
    ordersAwaitingDelivery: adminProcedure.query(() => listOrdersAwaitingDelivery()),
    ordersInRewardReturnWindow: adminProcedure.query(() => listOrdersInRewardReturnWindow()),
    markOrderDelivered: adminProcedure
      .input(z.object({ reference: z.string().trim().min(8).max(40) }))
      .mutation(async ({ input }) => {
        try {
          await markNonWalletOrderDelivered(input.reference);
          const bonusReward = await queueReferralBonusAfterDeliveredOrder(input.reference);
          const [cashback, freeDeliveryVoucher] = await Promise.all([queueCashbackAfterDeliveredOrder(input.reference), issueFreeDeliveryVoucherIfQualified(input.reference)]);
          return { reference: input.reference, bonusReward, cashback, freeDeliveryVoucher };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not confirm order delivery." });
        }
      }),
    markOrderReturned: adminProcedure
      .input(z.object({ reference: z.string().trim().min(8).max(40) }))
      .mutation(async ({ input }) => {
        try {
          await markDeliveredOrderReturned(input.reference);
          const rewards = await cancelPendingBonusRewardsForReturnedOrder(input.reference);
          return { reference: input.reference, cancelledRewards: rewards.cancelled };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not record the returned order." });
        }
      }),
    createPostSaleBonus: adminProcedure
      .input(z.object({ reference: z.string().trim().min(8).max(40), type: z.enum(["cashback", "review"]), amount: z.number().int().min(50).max(500_000) }))
      .mutation(async ({ input }) => {
        try {
          return await queueVerifiedPostSaleBonus(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not create the post-sale Shopping Bonus." });
        }
      }),
    recordVendorDispatch: adminProcedure
      .input(z.object({ reference: z.string().trim().min(8).max(40), vendorUserId: z.number().int().positive(), dispatchedAt: z.coerce.date() }))
      .mutation(async ({ input }) => {
        try {
          return await recordVerifiedVendorDispatch(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not record the verified logistics hand-over." });
        }
      }),
    referralRewardSettings: adminProcedure.query(() => getReferralRewardSettings()),
    saveReferralRewardSettings: adminProcedure
      .input(z.object({ minimumFirstOrderSubtotal: z.number().int().min(500).max(5_000_000), referralBonusAmount: z.number().int().min(50).max(500_000) }))
      .mutation(({ input }) => updateReferralRewardSettings(input)),
  }),
  createReferralShare: protectedProcedure
    .input(z.object({ channel: z.enum(["whatsapp", "tiktok", "instagram", "other"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!await isReferralEligibleUser(ctx.user.id)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Verify your identity or complete bank-name matching before creating a referral link." });
      const settings = await getReferralRewardSettings();
      const shareCode = newShareCode();
      await createReferralShare({ shareCode, channel: input.channel, sharerUserId: ctx.user.id, rewardValue: settings.referralBonusAmount, minimumOrderSubtotal: settings.minimumFirstOrderSubtotal });
      return { shareCode, rewardValue: settings.referralBonusAmount, minimumOrderSubtotal: settings.minimumFirstOrderSubtotal };
    }),

  myReferralStatus: protectedProcedure.query(async ({ ctx }) => {
    const shares = await listReferralSharesForUser(ctx.user.id);
    return shares.map(share => ({
      shareCode: share.shareCode,
      status: share.status,
      rewardStatus: share.rewardStatus,
      rewardValue: share.rewardValue,
      minimumOrderSubtotal: share.minimumOrderSubtotal,
      fraudStatus: share.fraudStatus,
    }));
  }),

  submitOrder: sensitiveProtectedProcedure
    .input(z.object({
      buyerName: z.string().trim().min(2).max(120).transform(sanitizePlainText).refine(value => value.length >= 2, "Enter a valid buyer name."),
      buyerPhone: z.string().trim().min(7).max(32),
      deliveryAddress: z.object({
        country: z.literal("Nigeria"),
        state: z.string().trim().min(2).max(80).transform(sanitizePlainText),
        lga: z.string().trim().min(2).max(120).transform(sanitizePlainText),
        streetDetails: z.string().trim().min(8).max(350).transform(sanitizePlainText).refine(value => value.length >= 8, "Enter valid street details."),
      }),
      packageWeightKg: z.number().positive().max(5000),
      deliveryTier: z.enum(DELIVERY_SERVICE_TIERS),
      items: z.array(cartLineSchema).min(1).max(12),
      referralCode: z.string().trim().max(32).optional(),
      freeDeliveryVoucherId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      validateNigerianState(input.deliveryAddress.state);
      if (!isNigerianLga(input.deliveryAddress.state, input.deliveryAddress.lga)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid local government area for the selected state." });
      }

      const baseDeliveryQuote = calculateDeliveryQuote({
        destinationState: input.deliveryAddress.state,
        weightKg: input.packageWeightKg,
        serviceTier: input.deliveryTier,
      });
      const activeVouchers = input.freeDeliveryVoucherId ? await listActiveFreeDeliveryVouchers(ctx.user.id) : [];
      const freeDeliveryVoucher = activeVouchers.find(voucher => voucher.id === input.freeDeliveryVoucherId);
      if (input.freeDeliveryVoucherId && !freeDeliveryVoucher) throw new TRPCError({ code: "BAD_REQUEST", message: "That free-delivery voucher is no longer available." });
      const deliveryQuote = freeDeliveryVoucher ? { ...baseDeliveryQuote, deliveryFee: 0 } : baseDeliveryQuote;
      const catalog = [...MARKETPLACE_PRODUCTS, ...createVendorCatalog(await listApprovedVendorProducts())];
      const resolvedLines = resolveCartLines(input.items, catalog);
      if (resolvedLines.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart does not contain a valid product." });

      const subtotal = getCartSubtotal(input.items, catalog);
      let appliedCode: string | undefined;
      let discountType: "none" | "referral" | "reward" = "none";
      let discount = 0;

      const kyc = await getKycProfileForUser(ctx.user.id);
      if (kyc?.status !== "verified") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete KYC Verification before confirming a Pay on Delivery order." });
      }

      if (input.referralCode) {
        const candidate = input.referralCode.toUpperCase();
        if (candidate.startsWith("ALPHA-")) {
          const referralShare = await getReferralShareByCode(candidate);
          if (!referralShare || referralShare.status !== "shared") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "That referral code is unavailable or has already been used." });
          }
          if (referralShare.sharerUserId === ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You cannot use your own referral code." });
          }
          if (subtotal < referralShare.minimumOrderSubtotal) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `This referral code applies to orders from ₦${referralShare.minimumOrderSubtotal.toLocaleString("en-NG")}.` });
          }
          const fraud = await assessReferralFraudBeforeCheckout({ referralShareId: referralShare.id, sharerUserId: referralShare.sharerUserId, referredUserId: ctx.user.id });
          if (!fraud.flagged) {
            appliedCode = candidate;
            discountType = "referral";
            discount = referralShare.rewardValue;
          }
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid referral code beginning ALPHA-." });
        }
      }

      const reference = newOrderReference();
      const total = subtotal - discount + deliveryQuote.deliveryFee;
      await createOrder({
        reference,
        buyerUserId: ctx.user.id,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        deliveryAddress: formatNigerianDeliveryAddress(input.deliveryAddress),
        paymentMethod: "delivery",
        paymentStatus: "cod_pending",
        subtotal,
        referralDiscount: discount,
        deliveryFee: deliveryQuote.deliveryFee,
        total,
        referralCode: appliedCode,
        discountType,
        orderLines: resolvedLines.map(line => ({ productId: line.product.id, title: line.product.title, quantity: line.quantity, unitPrice: line.product.price, lineTotal: line.lineTotal })),
      }, freeDeliveryVoucher?.id);

      return { reference, paymentStatus: "cod_pending" as const, subtotal, discount, deliveryFee: deliveryQuote.deliveryFee, total, deliveryQuote };
    }),

  vendor: router({
    dashboard: protectedProcedure.input(savedProductListInputSchema.optional()).query(async ({ ctx, input }) => {
      const [application, kyc] = await Promise.all([getVendorApplicationForUser(ctx.user.id), ensureKycProfileForUser(ctx.user.id)]);
      if (!application) return { application: null, products: [], productPage: { items: [], total: 0, page: 1, pageSize: input?.pageSize ?? 25, totalPages: 1 } };
      const productPage = await listVendorProducts(application.id, input ?? {});
      return { application, products: productPage.items, productPage, kyc: { status: kyc.status, hasGovernmentId: Boolean(kyc.governmentIdImageUrl) } };
    }),
    submitApplication: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120).transform(sanitizePlainText).refine(value => value.length >= 2, "Enter a valid name."), storeName: z.string().trim().min(2).max(160).transform(sanitizePlainText).refine(value => value.length >= 2, "Enter a valid store name."), whatsapp: z.string().trim().min(7).max(32), category: z.enum(MARKETPLACE_CATEGORIES) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getVendorApplicationForUser(ctx.user.id);
        if (existing) return { application: existing, alreadySubmitted: true };
        const id = await createVendorApplication({ userId: ctx.user.id, name: input.name, storeName: input.storeName, whatsapp: input.whatsapp, category: input.category, commissionRate: 12, status: "pending" });
        const application = await getVendorApplicationForUser(ctx.user.id);
        if (!application) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Application ${id} could not be loaded.` });
        return { application, alreadySubmitted: false };
      }),
    uploadProductImage: protectedProcedure
      .input(z.object({ dataUrl: productImageDataUrlSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          const data = decodeProductImageDataUrl(input.dataUrl);
          const result = await storeProcessedProductImage({ source: data, storagePrefix: `vendor-products/${ctx.user.id}/${Date.now()}` });
          return { imageUrl: result.url };
        } catch (error) {
          if (error instanceof ProductImageProcessingError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          throw error;
        }
      }),
    createProduct: protectedProcedure
      .input(vendorProductInputSchema)
      .mutation(async ({ ctx, input }) => {
        const application = await getVendorApplicationForUser(ctx.user.id);
        if (!application) throw new TRPCError({ code: "BAD_REQUEST", message: "Submit your seller application before adding a product." });
        if (input.imageUrls.some(imageUrl => !imageUrl.startsWith(`/manus-storage/vendor-products/${ctx.user.id}/`))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Upload all product images from your seller account first." });
        }
        const id = await createVendorProduct({ vendorApplicationId: application.id, title: input.title, category: input.category, price: input.price, description: input.description, imageUrl: input.imageUrls[0], imageUrls: input.imageUrls, status: "draft" });
        return { id, status: "draft" as const };
      }),
    updateDraftProduct: protectedProcedure
      .input(vendorProductInputSchema.extend({ id: z.number().int().positive(), imageUrls: z.array(z.string().startsWith("/manus-storage/").max(500)).min(1).max(5).optional() }))
      .mutation(async ({ ctx, input }) => {
        const application = await getVendorApplicationForUser(ctx.user.id);
        if (!application) throw new TRPCError({ code: "BAD_REQUEST", message: "Submit your seller application before editing a product." });
        const product = await getVendorProductForApplication(input.id, application.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "This product draft was not found in your seller catalogue." });
        if (product.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Published products cannot be edited here. A paid change request is required." });
        const imageUrls = input.imageUrls ?? product.imageUrls ?? (product.imageUrl ? [product.imageUrl] : []);
        if (!imageUrls.length || imageUrls.some(imageUrl => !imageUrl.startsWith(`/manus-storage/vendor-products/${ctx.user.id}/`))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Use only product images uploaded from your seller account." });
        }
        await updateVendorDraftProduct(product.id, { title: input.title, category: input.category, price: input.price, description: input.description, imageUrl: imageUrls[0], imageUrls });
        return { id: product.id, status: "draft" as const };
      }),
  }),
});
