export type FundingAttemptStatus = "pending" | "succeeded" | "failed";
export type WithdrawalStatus = "pending" | "processing" | "paid" | "rejected" | "failed" | "reversed" | "cancelled";

export function fundingCreditDisposition(status: FundingAttemptStatus) {
  if (status === "pending") return "credit" as const;
  if (status === "succeeded") return "ignore_duplicate" as const;
  return "reject" as const;
}

export function withdrawalPaidDisposition(status: WithdrawalStatus) {
  return status === "pending" || status === "processing" ? "mark_paid" as const : "ignore_duplicate" as const;
}

export function withdrawalRestoreDisposition(status: WithdrawalStatus) {
  return status === "pending" || status === "processing" ? "restore" as const : "ignore_duplicate" as const;
}
