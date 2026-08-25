type PaymentAlert = {
  reference: string;
  amountNaira: number;
  event: "wallet_funding_confirmed" | "wallet_escrow_created" | "local_vendor_escrow_released";
};

const eventLabel: Record<PaymentAlert["event"], string> = {
  wallet_funding_confirmed: "Wallet funding confirmed",
  wallet_escrow_created: "Wallet escrow created",
  local_vendor_escrow_released: "Local-vendor escrow released",
};

export async function notifyAdminPaymentEvent(alert: PaymentAlert) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return { delivered: false as const, reason: "not_configured" as const };
  const text = `Alpha Collective payment alert\n${eventLabel[alert.event]}\nReference: ${alert.reference}\nAmount: ₦${alert.amountNaira.toLocaleString("en-NG")}`;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) console.warn("[Payment alert] Telegram delivery was not accepted.");
    return { delivered: response.ok as boolean };
  } catch {
    console.warn("[Payment alert] Telegram delivery failed.");
    return { delivered: false as const, reason: "network_error" as const };
  }
}
