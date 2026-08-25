export function isWithdrawalOtpEmailDeliveryConfigured() {
  return process.env.RESEND_OTP_EMAIL_ENABLED === "true" && Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}
