import type { MarketplaceCategory } from "../shared/marketplace";

export type CjCategoryCandidate = {
  oneCategoryName?: string;
  twoCategoryName?: string;
  threeCategoryName?: string;
  categoryName?: string;
  category?: string;
};

export type CjCategoryDecision =
  | { kind: "approved"; marketplaceCategory: MarketplaceCategory; sourceText: string }
  | { kind: "blocked"; reason: string; sourceText: string }
  | { kind: "unmapped"; sourceText: string };

const APPROVED_CATEGORY_TERMS: Record<MarketplaceCategory, RegExp[]> = {
  Fashion: [
    /women'?s clothing|men'?s clothing|bags?\s*(?:&|and)\s*shoes|jewelry\s*(?:&|and)\s*watches/i,
    /clothing accessories|underwear|sleepwear|lingerie|costumes?|cosplay|special.?occasion|wedding/i,
    /apparel|footwear|handbags?|wallets?|belts?|hats?|scarves?|sunglasses?|watches?|jewelry|dresses?|shirts?|tops?|trousers?|pants?|skirts?|jackets?|coats?|hoodies?|sweaters?|socks?/i,
  ],
  Gadgets: [
    /consumer electronics|phones?\s*(?:&|and)\s*telecommunications|computer\s*(?:&|and)\s*office|office electronics/i,
    /cameras?\s*(?:&|and)\s*video|smart devices?|wearables?|audio|headphones?|earbuds?|speakers?|gaming|chargers?|cables?|usb|electronic accessories/i,
    /electronics?|smartphones?|mobile phones?|laptops?|tablets?|computers?|keyboards?|mice|printers?|projectors?|cameras?|microphones?|game controllers?|consoles?|power banks?|adapters?/i,
  ],
  Beauty: [
    /health,?\s*beauty\s*(?:&|and)\s*hair|makeup|cosmetics?|skin\s*care|skincare|hair\s*care|wigs?|nail\s*care|fragrances?|perfumes?|beauty tools?|personal care devices?/i,
    /shampoo|conditioner|lipstick|foundation|eyelashes?|hair extensions?|manicure|pedicure|facial|serum|moisturizer|cleanser|mascara|eyeliner|nail polish/i,
  ],
  "Home & Furniture": [
    /home,?\s*garden\s*(?:&|and)\s*furniture|home improvement|kitchen|dining|bar|furniture|home decor|storage|organization|bedding|bath|garden|household|lighting/i,
    /sofas?|chairs?|tables?|cabinets?|shelves?|rugs?|carpets?|curtains?|lamps?|cookware|cleaning|laundry|planters?|household tools?/i,
  ],
  Vehicles: [
    /automobiles?\s*(?:&|and)\s*motorcycles?|vehicle parts?|motorcycle accessories|car electronics|bicycle|cycling|electric scooters?|automotive tools?|maintenance accessories/i,
    /automotive|vehicles?|cars?|motorbikes?|motorcycles?|scooters?|bicycles?|trucks?|trailers?|tires?|tyres?|dash cameras?|seat covers?|car accessories?/i,
  ],
  "Animals & Pets": [
    /pet supplies|dog supplies|cat supplies|bird supplies|fish|aquarium|reptile|small animal|pet grooming|pet training|pet clothing|pet accessories/i,
    /pets?|dogs?|cats?|puppies?|kittens?|birds?|aquariums?|reptiles?|pet beds?|pet toys?|collars?|leashes?|harnesses?|feeders?|cages?/i,
  ],
};

const BLOCKED_CATEGORY_TERMS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /toys?|kids?|children|bab(?:y|ies)|mother\s*(?:&|and)\s*kids/i, reason: "Toys, Kids & Babies is reserved for a future Alpha Market category." },
  { pattern: /sports?|outdoors?|camping|hiking|fitness|exercise/i, reason: "Sports & Outdoors is reserved for a future Alpha Market category." },
  { pattern: /musical instruments?|guitars?|keyboards?\s*musical|drums?|pianos?/i, reason: "Musical Instruments is reserved for a future Alpha Market category." },
  { pattern: /supplements?|vitamins?|medical|medicine|pharmaceutical|pharmacy|drugs?|health\s*care|healthcare|diagnostic|veterinary|veterinary medicine/i, reason: "Health products and supplements are reserved for a future Alpha Market category." },
  { pattern: /food|beverages?|consumables?|industrial|commercial equipment|security\s*(?:&|and)\s*protection/i, reason: "This CJ category is not enabled in Alpha Market's current category structure." },
];

function normalizeCategoryText(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/[\s_-]+/g, " ").trim();
}

export function cjCategorySourceText(candidate: CjCategoryCandidate) {
  return [candidate.oneCategoryName, candidate.twoCategoryName, candidate.threeCategoryName, candidate.categoryName, candidate.category]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeCategoryText)
    .join(" > ");
}

export function classifyCjCategory(candidate: CjCategoryCandidate): CjCategoryDecision {
  const sourceText = cjCategorySourceText(candidate);
  if (!sourceText) return { kind: "unmapped", sourceText };

  for (const blocked of BLOCKED_CATEGORY_TERMS) {
    if (blocked.pattern.test(sourceText)) return { kind: "blocked", reason: blocked.reason, sourceText };
  }
  for (const [marketplaceCategory, patterns] of Object.entries(APPROVED_CATEGORY_TERMS) as Array<[MarketplaceCategory, RegExp[]]>) {
    if (patterns.some(pattern => pattern.test(sourceText))) return { kind: "approved", marketplaceCategory, sourceText };
  }
  return { kind: "unmapped", sourceText };
}

export function validateCjCategory(candidate: CjCategoryCandidate, requestedCategory: MarketplaceCategory) {
  const decision = classifyCjCategory(candidate);
  if (decision.kind === "blocked") throw new Error(`CJ product blocked: ${decision.reason}`);
  if (decision.kind === "unmapped") throw new Error("CJ product category is not mapped to an enabled Alpha Market category; it was not imported.");
  if (decision.marketplaceCategory !== requestedCategory) {
    throw new Error(`CJ product belongs to ${decision.marketplaceCategory}, not ${requestedCategory}; it was not imported.`);
  }
  return decision;
}

export function isBlockedCjCategory(candidate: CjCategoryCandidate) {
  return classifyCjCategory(candidate).kind === "blocked";
}
