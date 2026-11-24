function envValue(name: string) {
  return (process.env[name] ?? "").trim().replace(/^("|')|("|')$/g, "");
}

const r2AccountId = envValue("R2_ACCOUNT_ID");
const r2S3Endpoint = envValue("R2_S3_ENDPOINT") || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : "");

export const ENV = {
  cookieSecret: envValue("JWT_SECRET"),
  databaseUrl: envValue("DATABASE_URL"),
  googleClientId: envValue("GOOGLE_CLIENT_ID"),
  googleClientSecret: envValue("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: envValue("GOOGLE_REDIRECT_URI"),
  turnstileSiteKey: envValue("TURNSTILE_SITE_KEY"),
  turnstileSecretKey: envValue("TURNSTILE_SECRET_KEY"),
  publicAppUrl: (envValue("PUBLIC_APP_URL") || "https://alphamarket.name.ng").replace(/\/+$/, ""),
  apiOrigin: (envValue("PUBLIC_API_URL") || envValue("VITE_API_ORIGIN") || (process.env.NODE_ENV === "production" ? envValue("PUBLIC_APP_URL") : "") || "http://localhost:3000").replace(/\/+$/, ""),
  uploadsDir: envValue("UPLOADS_DIR") || "/uploads",
  r2AccountId,
  r2S3Endpoint: r2S3Endpoint.replace(/\/+$/, ""),
  r2BucketName: envValue("R2_BUCKET_NAME") || "alpha-market-product-images",
  r2AccessKeyId: envValue("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: envValue("R2_SECRET_ACCESS_KEY"),
  r2PublicBaseUrl: (envValue("R2_PUBLIC_BASE_URL") || "https://images.alphamarket.name.ng").replace(/\/+$/, ""),
  telegramBotToken: envValue("TELEGRAM_BOT_TOKEN"),
  telegramGroupChatId: envValue("TELEGRAM_GROUP_CHAT_ID") || "-1004418676694",
  telegramWebhookUrl: envValue("TELEGRAM_WEBHOOK_URL"),
  telegramWebhookSecret: envValue("TELEGRAM_WEBHOOK_SECRET"),
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
