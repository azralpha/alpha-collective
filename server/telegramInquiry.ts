import type { Express, Request, Response } from "express";
import * as db from "./db";
import { ENV } from "./_core/env";

const TELEGRAM_GROUP_CHAT_ID = "-1004418676694";
const TELEGRAM_BOT_USERNAME = "Alpha_real_bot";
const WEBHOOK_PATH = "/api/telegram/webhook";

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };
type TelegramMessage = { message_id: number; chat: { id: number | string; type?: string }; from?: { id: number; first_name?: string; username?: string }; text?: string; reply_to_message?: { message_id: number } };
type TelegramUpdate = { message?: TelegramMessage; callback_query?: { id: string; data?: string; from?: { id: number }; message?: TelegramMessage } };

type InquiryProduct = { id: number; title: string; price: number; vendorUserId: number; vendorApplicationId: number; vendorChatId: string | null; vendorName: string };

const TELEGRAM_COMMAND_MESSAGES = {
  help: [
    "Welcome to Alpha Market Bot.",
    "",
    "Available commands:",
    "/start - Start the bot or link your vendor account",
    "/link - How to link your Telegram as a vendor",
    "/inquiries - How product inquiries work",
    "/support - Contact Alpha Market support",
    "/rules - Platform rules",
    "",
    "Need more help? Message us in the Support group.",
  ].join("\n"),
  start: [
    "Welcome to the official <b>Alpha Market Bot</b>! 🛒",
    "",
    "This bot connects your Alpha Market store directly to Telegram for instant buyer inquiry notifications, vendor updates, and store security.",
    "",
    "If you are a vendor, you can link your store account using the deep-link from your <b>Vendor Dashboard</b> or type /link for instructions.",
  ].join("\n"),
  link: [
    "<b>How to link your Telegram Account as a Vendor:</b>",
    "",
    "1️⃣ Sign in to your store account on <b>Alpha Market</b>.",
    "2️⃣ Navigate to your <b>Vendor Dashboard</b>.",
    "3️⃣ Click <b>\"Connect Telegram\"</b> to get your personal deep-link.",
    "4️⃣ Click <b>Start</b> in Telegram to finalize linking!",
    "",
    "Once linked, all product inquiries will be forwarded straight to your private chat.",
  ].join("\n"),
  inquiries: [
    "<b>How Product Inquiries Work:</b>",
    "",
    "1. Buyers click <b>\"Ask about product\"</b> on your product page.",
    "2. The question is sent directly to your private Telegram chat AND the Vendors Group.",
    "3. Click <b>💬 Reply to Buyer</b> directly under the message in Telegram to send your answer back instantly.",
  ].join("\n"),
  support: [
    "<b>Alpha Market Customer &amp; Vendor Support</b>",
    "",
    "If you need assistance with escrow payments, disputes, KYC verification, or store configuration:",
    "",
    "📧 <b>Super-Admin Email:</b> Contact Super-Admin directly via account support.",
    "💬 <b>Support Group:</b> Ask in our main Vendors Telegram Group (<code>-1004418676694</code>).",
  ].join("\n"),
  rules: [
    "<b>Alpha Market Community Rules:</b>",
    "",
    "1️⃣ <b>Escrow Policy:</b> All payments must go through Alpha Market Escrow. Direct offline transactions are strictly prohibited and will result in a permanent ban.",
    "2️⃣ <b>Approved Products:</b> Only legal and verified goods/services may be listed.",
    "3️⃣ <b>KYC Requirement:</b> All vendors must complete Dojah KYC before payouts are processed.",
    "4️⃣ <b>Respect:</b> No spamming or unauthorized advertising in the Vendors Group.",
    "5️⃣ Any other communication line with the buyers is strictly prohibited and leads to straight up ban.",
  ].join("\n"),
} as const;

export function getTelegramCommandResponse(command: keyof typeof TELEGRAM_COMMAND_MESSAGES) {
  return TELEGRAM_COMMAND_MESSAGES[command];
}

function botApiUrl(method: string) {
  if (!ENV.telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  return `https://api.telegram.org/bot${ENV.telegramBotToken}/${method}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

async function telegramCall<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(botApiUrl(method), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as TelegramResponse<T>;
  if (!response.ok || !payload.ok || !payload.result) throw new Error(payload.description || `Telegram ${method} failed.`);
  return payload.result;
}

export function telegramIsConfigured() {
  return Boolean(ENV.telegramBotToken);
}

export function getTelegramVendorLink(vendorId: string) {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(vendorId)}`;
}

function inquiryText(inquiry: { inquiryId: string; productTitle: string; productPrice: number; vendorName: string; buyerQuestion: string }) {
  return [
    "<b>Alpha Market product inquiry</b>",
    `<b>Inquiry:</b> ${escapeHtml(inquiry.inquiryId)}`,
    `<b>Vendor:</b> ${escapeHtml(inquiry.vendorName)}`,
    `<b>Product:</b> ${escapeHtml(inquiry.productTitle)}`,
    `<b>Price:</b> ₦${inquiry.productPrice.toLocaleString("en-NG")}`,
    `<b>Buyer question:</b> ${escapeHtml(inquiry.buyerQuestion)}`,
    "",
    "Tap Reply to Buyer, then reply to the prompt Telegram sends you.",
  ].join("\n");
}

async function sendInquiryMessage(chatId: string, inquiry: Parameters<typeof inquiryText>[0]) {
  return telegramCall<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text: inquiryText(inquiry),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "💬 Reply to Buyer", callback_data: `reply:${inquiry.inquiryId}` }]] },
  });
}

export async function sendTelegramInquiry(input: { buyerUserId: number; product: InquiryProduct; question: string }) {
  if (!ENV.telegramBotToken) throw new Error("Telegram inquiries are not configured yet.");
  if (!input.product.vendorChatId) throw new Error("This vendor has not linked a private Telegram chat yet.");

  const inquiryId = `ACQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const saved = await db.createTelegramInquiry({
    inquiryId,
    buyerUserId: input.buyerUserId,
    vendorUserId: input.product.vendorUserId,
    vendorApplicationId: input.product.vendorApplicationId,
    productId: input.product.id,
    productTitle: input.product.title,
    productPrice: input.product.price,
    buyerQuestion: input.question,
  });
  if (!saved) throw new Error("The inquiry could not be saved.");

  const messageInput = { inquiryId, productTitle: input.product.title, productPrice: input.product.price, vendorName: input.product.vendorName, buyerQuestion: input.question };
  try {
    const vendorMessage = await sendInquiryMessage(input.product.vendorChatId, messageInput);
    const groupMessage = await sendInquiryMessage(ENV.telegramGroupChatId || TELEGRAM_GROUP_CHAT_ID, messageInput);
    await db.updateTelegramInquiryMessages(inquiryId, { vendorMessageId: String(vendorMessage.message_id), groupMessageId: String(groupMessage.message_id) });
    return { inquiryId };
  } catch (error) {
    await db.updateTelegramInquiryMessages(inquiryId, { status: "failed" });
    throw error;
  }
}

async function sendVendorLinkConfirmation(chatId: string, vendorId: string) {
  await telegramCall<TelegramMessage>("sendMessage", { chat_id: chatId, text: `✅ Your Alpha Market vendor Telegram is linked to ${vendorId}. You will receive buyer product questions here.` });
}

async function sendCommandResponse(chatId: string, command: keyof typeof TELEGRAM_COMMAND_MESSAGES) {
  await telegramCall<TelegramMessage>("sendMessage", { chat_id: chatId, text: getTelegramCommandResponse(command), parse_mode: "HTML" });
}

async function handleStart(message: TelegramMessage, payload: string) {
  if (message.chat.type !== "private" || !message.from) return;
  const application = await db.findVendorApplicationByTelegramVendorId(payload);
  if (!application) {
    await telegramCall("sendMessage", { chat_id: message.chat.id, text: "That vendor link is not valid or the vendor application is not approved. Ask Alpha Market for a fresh vendor Telegram link." });
    return;
  }
  await db.linkVendorTelegram(application.id, payload, String(message.chat.id), String(message.from.id));
  await sendVendorLinkConfirmation(String(message.chat.id), payload);
}

async function handleReplyButton(callbackQuery: NonNullable<TelegramUpdate["callback_query"]>) {
  const data = callbackQuery.data ?? "";
  const inquiryId = data.startsWith("reply:") ? data.slice("reply:".length) : "";
  if (!inquiryId || !callbackQuery.message || !callbackQuery.from) return;
  const vendor = await db.findVendorApplicationByTelegramUserId(String(callbackQuery.from.id));
  if (!vendor) return;
  const inquiry = await db.getTelegramInquiry(inquiryId);
  if (!inquiry || inquiry.vendorUserId !== vendor.userId) return;

  await telegramCall("answerCallbackQuery", { callback_query_id: callbackQuery.id, text: "Reply to the prompt Telegram is sending you." });
  const prompt = await telegramCall<TelegramMessage>("sendMessage", {
    chat_id: callbackQuery.message.chat.id,
    text: `💬 Reply to buyer for inquiry ${inquiry.inquiryId} by replying directly to this message.`,
    reply_markup: { force_reply: true, input_field_placeholder: "Type the buyer reply" },
  });
  await db.updateTelegramInquiryMessages(inquiryId, { replyPromptMessageId: String(prompt.message_id) });
}

async function handleReplyMessage(message: TelegramMessage) {
  if (!message.text || !message.reply_to_message?.message_id || !message.from) return;
  const vendor = await db.findVendorApplicationByTelegramUserId(String(message.from.id));
  if (!vendor) return;
  const inquiry = await db.getTelegramInquiryByReplyPrompt(String(message.reply_to_message.message_id), vendor.userId);
  if (!inquiry) return;
  await db.saveTelegramInquiryReply(inquiry.inquiryId, vendor.userId, message.text.trim().slice(0, 4000));
  await telegramCall("sendMessage", { chat_id: message.chat.id, text: `✅ Reply saved for ${inquiry.inquiryId}. The buyer will see it on Alpha Market.` });
}

async function processTelegramUpdate(update: TelegramUpdate) {
  if (update.callback_query?.data?.startsWith("reply:")) {
    await handleReplyButton(update.callback_query);
    return;
  }
  const message = update.message;
  if (!message) return;
  const commandMatch = message.text?.trim().match(/^\/(start|help|link|inquiries|support|rules)(?:@[^\s]+)?(?:\s+(.*))?$/i);
  if (commandMatch) {
    const command = commandMatch[1].toLowerCase() as keyof typeof TELEGRAM_COMMAND_MESSAGES;
    const payload = commandMatch[2]?.trim() ?? "";
    if (command === "start" && payload) {
      await handleStart(message, payload);
    } else {
      await sendCommandResponse(String(message.chat.id), command);
    }
    return;
  }
  await handleReplyMessage(message);
}

export function registerTelegramWebhook(app: Express) {
  app.post(WEBHOOK_PATH, async (req: Request, res: Response) => {
    if (ENV.telegramWebhookSecret && req.headers["x-telegram-bot-api-secret-token"] !== ENV.telegramWebhookSecret) {
      res.status(401).send("Unauthorized");
      return;
    }
    res.sendStatus(200);
    try {
      await processTelegramUpdate(req.body as TelegramUpdate);
    } catch (error) {
      console.error("[Telegram webhook] Update failed", error);
    }
  });

  if (ENV.telegramBotToken && ENV.isProduction) {
    const webhookUrl = ENV.telegramWebhookUrl || "https://alpha-giddy-main.onrender.com/api/telegram/webhook";
    void telegramCall("setWebhook", { url: webhookUrl, ...(ENV.telegramWebhookSecret ? { secret_token: ENV.telegramWebhookSecret } : {}) }).catch(error => console.error("[Telegram webhook] Could not set webhook", error));
  }
}

export async function getTelegramProductForInquiry(productId: number): Promise<InquiryProduct | undefined> {
  const result = await db.getActiveVendorProductForInquiry(productId);
  if (!result) return undefined;
  return {
    id: result.product.id,
    title: result.product.title,
    price: result.product.price,
    vendorUserId: result.application.userId,
    vendorApplicationId: result.application.id,
    vendorChatId: result.application.telegramChatId,
    vendorName: result.application.storeName,
  };
}
