function envValue(name: string) {
  return (process.env[name] ?? "").trim().replace(/^("|')|("|')$/g, "");
}

export const ENV = {
  cookieSecret: envValue("JWT_SECRET"),
  databaseUrl: envValue("DATABASE_URL"),
  googleClientId: envValue("GOOGLE_CLIENT_ID"),
  googleClientSecret: envValue("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: envValue("GOOGLE_REDIRECT_URI"),
  publicAppUrl: (envValue("PUBLIC_APP_URL") || "https://alphamarket.name.ng").replace(/\/+$/, ""),
  telegramBotToken: envValue("TELEGRAM_BOT_TOKEN"),
  telegramGroupChatId: envValue("TELEGRAM_GROUP_CHAT_ID") || "-1004418676694",
  telegramWebhookUrl: envValue("TELEGRAM_WEBHOOK_URL"),
  telegramWebhookSecret: envValue("TELEGRAM_WEBHOOK_SECRET"),
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
