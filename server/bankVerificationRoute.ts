import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getVendorApplicationForUser, ensureWalletForUser, getWalletBankRecipientForUser, saveWalletBankRecipient, markWalletBankRecipientVerified } from "./db";
import { listPaystackNigerianBanks, createPaystackTransferRecipient, maskNigerianAccountNumber, PaystackProviderError } from "./paystack";
import { FlutterwaveProviderError, resolveFlutterwaveNigerianAccount } from "./flutterwave";
import { bankAccountNameMatchesProfile, hasUsableProfileName } from "./bankVerification";
import { createExpressRateLimit } from "./requestRateLimit";
import { z } from "zod";

const inputSchema = z.object({
  account_number: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit Nigerian account number."),
  account_bank: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/, "Select a valid Nigerian bank."),
});

function providerStatus(error: unknown) {
  if (error instanceof FlutterwaveProviderError || error instanceof PaystackProviderError) {
    return error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502;
  }
  return 500;
}

export function registerBankVerificationRoute(app: Express) {
  app.post("/api/verify-bank-account", createExpressRateLimit({ scope: "bank-account-verification", limit: 5, windowMs: 10 * 60_000 }), async (req: Request, res: Response) => {
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter a valid Nigerian bank account." });
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Sign in before verifying a bank account." });
    }
    try {
      const [banks, vendor] = await Promise.all([listPaystackNigerianBanks(), getVendorApplicationForUser(user.id)]);
      const bank = banks.find(candidate => candidate.code === parsed.data.account_bank);
      if (!bank) return res.status(400).json({ error: "Select a Nigerian bank from the provided list." });
      const profileName = vendor?.name ?? user.name ?? "";
      if (!hasUsableProfileName(profileName)) return res.status(409).json({ error: "Add your full legal name to your Alpha Market profile before verifying a bank account." });
      const resolved = await resolveFlutterwaveNigerianAccount({ accountNumber: parsed.data.account_number, bankCode: parsed.data.account_bank });
      if (!bankAccountNameMatchesProfile(profileName, resolved.accountName)) return res.status(409).json({ error: "The bank-account name does not match your Alpha Market profile name. Check the account details and try again." });
      const existing = await getWalletBankRecipientForUser(user.id);
      if (existing?.kycBindingStatus === "locked") return res.status(409).json({ error: "Your verified payout account is locked. Contact Alpha Market support to request a controlled change." });
      const recipientCode = await createPaystackTransferRecipient({ accountName: resolved.accountName, accountNumber: resolved.accountNumber, bankCode: bank.code });
      await ensureWalletForUser(user.id);
      await saveWalletBankRecipient({ userId: user.id, bankCode: bank.code, bankName: bank.name, accountNumberMasked: maskNigerianAccountNumber(resolved.accountNumber), accountName: resolved.accountName, paystackRecipientCode: recipientCode });
      await markWalletBankRecipientVerified({ userId: user.id, bankCode: bank.code, bankName: bank.name, accountNumberMasked: maskNigerianAccountNumber(resolved.accountNumber), accountName: resolved.accountName, paystackRecipientCode: recipientCode });
      return res.json({ bankName: bank.name, accountNumberMasked: maskNigerianAccountNumber(resolved.accountNumber), accountName: resolved.accountName, verification: "bank_name_matched" });
    } catch (error) {
      console.warn("[Bank Verification] Provider request failed:", error instanceof Error ? error.message : error);
      const status = providerStatus(error);
      return res.status(status).json({ error: status === 502 ? "Bank verification is temporarily unavailable. Please try again shortly." : "The bank account could not be verified." });
    }
  });
}
