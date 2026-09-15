export const DELIVERY_SERVICE_TIERS = ["standard", "express"] as const;

export type DeliveryServiceTier = (typeof DELIVERY_SERVICE_TIERS)[number];
export type DeliveryZone = "intra_state" | "regional" | "far";

export type DeliveryQuoteInput = {
  destinationState: string;
  weightKg: number;
  serviceTier: DeliveryServiceTier;
};

const SOUTH_WEST_REGIONAL_STATES = new Set(["ekiti", "ogun", "ondo", "osun", "oyo"]);

const DELIVERY_ZONE_DETAILS: Record<DeliveryZone, { label: string; baseRate: number }> = {
  intra_state: { label: "Intra-state (Lagos)", baseRate: 9500 },
  regional: { label: "Inter-state regional (South West)", baseRate: 15000 },
  far: { label: "Inter-state far", baseRate: 24000 },
};

export function getDeliveryZone(destinationState: string): DeliveryZone {
  const normalizedState = destinationState.trim().toLowerCase();
  if (normalizedState === "lagos") return "intra_state";
  if (SOUTH_WEST_REGIONAL_STATES.has(normalizedState)) return "regional";
  return "far";
}

export function calculateDeliveryQuote(input: DeliveryQuoteInput) {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new Error("Package weight must be greater than 0 kg.");
  }

  const zone = getDeliveryZone(input.destinationState);
  const zoneDetails = DELIVERY_ZONE_DETAILS[zone];
  const additionalWeightUnits = Math.max(0, Math.ceil(input.weightKg - 2));
  const weightSurcharge = additionalWeightUnits * 1000;
  const serviceMultiplier = input.serviceTier === "express" ? 1.5 : 1;
  const deliveryFee = Math.round((zoneDetails.baseRate + weightSurcharge) * serviceMultiplier);

  return {
    zone,
    zoneLabel: zoneDetails.label,
    baseRate: zoneDetails.baseRate,
    includedWeightKg: 2,
    additionalWeightUnits,
    weightSurcharge,
    serviceTier: input.serviceTier,
    serviceLabel: input.serviceTier === "express" ? "Express Delivery (1–2 days)" : "Standard Delivery (3–5 days)",
    serviceMultiplier,
    deliveryFee,
  };
}
