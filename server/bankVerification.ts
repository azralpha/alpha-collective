export function normalizePersonName(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function hasUsableProfileName(value: string) {
  const parts = normalizePersonName(value).split(" ").filter(Boolean);
  return parts.length >= 2 && parts[0].length >= 2 && parts[parts.length - 1].length >= 2 && parts[0] !== parts[parts.length - 1];
}

export function bankAccountNameMatchesProfile(profileName: string, accountName: string) {
  const profileParts = normalizePersonName(profileName).split(" ").filter(Boolean);
  const normalizedAccountName = normalizePersonName(accountName);
  if (!hasUsableProfileName(profileName) || !normalizedAccountName) return false;
  const firstName = profileParts[0];
  const lastName = profileParts[profileParts.length - 1];
  return normalizedAccountName.includes(firstName) && normalizedAccountName.includes(lastName);
}

export function maskAccountNumber(accountNumber: string) {
  return `${"•".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}
