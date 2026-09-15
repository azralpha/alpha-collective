import nigeriaLocationData from "nigeria-state-lga-data";

export const NIGERIA_COUNTRY = "Nigeria" as const;

export const NIGERIA_STATES = Array.from(new Set(nigeriaLocationData.getStates().map(state => state.trim())))
  .sort((left, right) => left.localeCompare(right, "en-NG"));

export function getNigerianLgas(state: string) {
  return Array.from(new Set(nigeriaLocationData.getLgas(state).map(lga => lga.trim())))
    .sort((left, right) => left.localeCompare(right, "en-NG"));
}

export function isNigerianState(state: string) {
  return NIGERIA_STATES.includes(state.trim());
}

export function isNigerianLga(state: string, lga: string) {
  return getNigerianLgas(state).includes(lga.trim());
}

export function formatNigerianDeliveryAddress(input: { state: string; lga: string; streetDetails: string }) {
  const streetDetails = input.streetDetails.trim().replace(/\s+/g, " ");
  return `NIGERIA, ${input.state.trim().toUpperCase()}, ${input.lga.trim().toUpperCase()}, ${streetDetails}`;
}
