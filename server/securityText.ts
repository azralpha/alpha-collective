const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_LIKE_TAG = /<\/?[a-z][^>]*>/gi;

export function sanitizePlainText(value: string) {
  return value.replace(CONTROL_CHARACTERS, "").replace(HTML_LIKE_TAG, "").replace(/\s+/g, " ").trim();
}

export function normalizeLegalName(value: string) {
  return sanitizePlainText(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-NG").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function namesMatch(verifiedLegalName: string, bankAccountName: string) {
  const left = normalizeLegalName(verifiedLegalName);
  const right = normalizeLegalName(bankAccountName);
  return Boolean(left) && left === right;
}
