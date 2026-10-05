export const MARKETPLACE_CATEGORIES = ["Fashion", "Gadgets", "Beauty", "Home & Furniture", "Vehicles", "Animals & Pets"] as const;

export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];

export const MARKETPLACE_CATEGORY_METADATA: Record<MarketplaceCategory, { id: string; slug: string }> = {
  Fashion: { id: "fashion", slug: "fashion" },
  Gadgets: { id: "gadgets", slug: "gadgets" },
  Beauty: { id: "beauty", slug: "beauty" },
  "Home & Furniture": { id: "home-furniture", slug: "home-furniture" },
  Vehicles: { id: "vehicles", slug: "vehicles" },
  "Animals & Pets": { id: "animals-pets", slug: "animals-pets" },
};

export function getMarketplaceCategoryMetadata(category: MarketplaceCategory) {
  return MARKETPLACE_CATEGORY_METADATA[category];
}

export type VendorTrust = {
  verification: "verified" | "unverified";
  lightningSeller: boolean;
  topRated: boolean;
};

export type MarketplaceProduct = {
  id: string;
  title: string;
  vendor: string;
  vendorUserId?: number;
  vendorCommissionRate?: number;
  category: MarketplaceCategory;
  /** Canonical public identifiers derived from the vetted marketplace category list. */
  categoryId?: string;
  categorySlug?: string;
  /** Store-level signals only; private KYC, contact, supplier, and financial data are never exposed. */
  vendorTrust?: VendorTrust;
  price: number;
  formerPrice?: number;
  badge?: string;
  imageUrl: string;
  imageUrls?: string[];
  description: string;
  detail: string;
  /** Only Alpha Collective availability is exposed; supplier origin and logistics remain private. */
  stockQuantity?: number;
};

export const MARKETPLACE_PRODUCTS = [
  {
    id: "soft-structure-tote",
    title: "Soft Structure Tote",
    vendor: "Milo Studio, Lagos",
    category: "Fashion",
    price: 18500,
    formerPrice: 24000,
    badge: "Flash find",
    imageUrl: "/category/fashion.jpg",
    description: "An easy, patterned carry-all made for weekday movement.",
    detail:
      "A tactile everyday tote with room for the essentials. The pictured colour and pattern are confirmed by the seller before delivery.",
  },
  {
    id: "pulse-buds-mini",
    title: "Pulse Buds Mini",
    vendor: "Current Devices, Abuja",
    category: "Gadgets",
    price: 21900,
    formerPrice: 28500,
    badge: "Price drop",
    imageUrl: "/category/gadgets.jpg",
    description: "Pocket-size wireless listening for the daily commute.",
    detail:
      "A compact pair of wireless earbuds with a charging case. Product specifications and fulfilment details are confirmed by the seller before delivery.",
  },
  {
    id: "glow-ritual-set",
    title: "Glow Ritual Set",
    vendor: "Rara Skin, Ibadan",
    category: "Beauty",
    price: 12400,
    formerPrice: 15800,
    badge: "Collective pick",
    imageUrl: "/category/beauty.jpg",
    description: "A small daily care edit with a warm, uncomplicated ritual.",
    detail:
      "A clean three-piece skin-care set. Please review ingredients with the seller before ordering if you have specific sensitivities.",
  },
  {
    id: "clay-table-bowl",
    title: "Clay Table Bowl",
    vendor: "Nook & Form, Ilorin",
    category: "Home & Furniture",
    price: 9800,
    formerPrice: 12500,
    badge: "Made local",
    imageUrl: "/category/home-furniture.jpg",
    description: "A warm, hand-finished bowl for the table or shelf.",
    detail:
      "A quietly textured ceramic bowl for everyday serving or display. Handmade pieces can vary subtly in finish.",
  },
  {
    id: "city-ride-compact",
    title: "City Ride Compact",
    vendor: "Drive Find, Lagos",
    category: "Vehicles",
    price: 4250000,
    formerPrice: 4680000,
    badge: "Featured vehicle",
    imageUrl: "/hero/hero-african-tech-market.jpg",
    description: "A practical compact crossover for everyday movement in the city.",
    detail: "A clean compact vehicle listing from an independent seller. Confirm inspection, ownership documents and delivery terms directly with the seller before any transaction.",
  },
  {
    id: "rattan-lounge-edit",
    title: "Rattan Lounge Edit",
    vendor: "House & Hue, Abuja",
    category: "Home & Furniture",
    price: 86500,
    formerPrice: 112000,
    badge: "Home find",
    imageUrl: "/category/home-furniture.jpg",
    description: "A woven lounge setting that adds warmth to a quiet corner.",
    detail: "A tactile furniture edit designed for relaxed interiors. Confirm measurements, finish and delivery availability with the seller before ordering.",
  },
  {
    id: "pet-home-starter",
    title: "Pet Home Starter",
    vendor: "Paws & Play, Enugu",
    category: "Animals & Pets",
    price: 17400,
    formerPrice: 22900,
    badge: "Pet pick",
    imageUrl: "/category/animals-pets.jpg",
    description: "A practical comfort set for a new pet corner at home.",
    detail: "A curated pet-home set from a local seller. Confirm size, materials and suitability for your animal before ordering.",
  },
] as const satisfies readonly MarketplaceProduct[];

export type CartLine = {
  productId: string;
  quantity: number;
};

export type ResolvedCartLine = CartLine & {
  product: MarketplaceProduct;
  lineTotal: number;
};

export const REFERRAL_DISCOUNT = 500;
export const REFERRAL_MINIMUM_SUBTOTAL = 5000;
export const LAUNCH_PROMO_COMMISSION_RATE = 0;
export const LAUNCH_PROMO_NOTE = "0% commission active for the first two weeks to help you grow!";

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getProduct(productId: string, catalog: readonly MarketplaceProduct[] = MARKETPLACE_PRODUCTS) {
  return catalog.find(product => product.id === productId);
}

export function resolveCartLines(lines: CartLine[], catalog: readonly MarketplaceProduct[] = MARKETPLACE_PRODUCTS): ResolvedCartLine[] {
  return lines.flatMap(line => {
    const product = getProduct(line.productId, catalog);
    const quantity = Math.max(0, Math.floor(line.quantity));
    if (!product || quantity === 0) return [];

    return [{ ...line, quantity, product, lineTotal: product.price * quantity }];
  });
}

export function getCartSubtotal(lines: CartLine[], catalog: readonly MarketplaceProduct[] = MARKETPLACE_PRODUCTS) {
  return resolveCartLines(lines, catalog).reduce((total, line) => total + line.lineTotal, 0);
}

export function qualifiesForReferralDiscount(subtotal: number) {
  return subtotal >= REFERRAL_MINIMUM_SUBTOTAL;
}

export function getCheckoutTotals(lines: CartLine[], hasValidReferralCode = false, catalog: readonly MarketplaceProduct[] = MARKETPLACE_PRODUCTS, deliveryFee = 0) {
  const subtotal = getCartSubtotal(lines, catalog);
  const discount = hasValidReferralCode && qualifiesForReferralDiscount(subtotal) ? REFERRAL_DISCOUNT : 0;
  const normalizedDeliveryFee = subtotal > 0 ? Math.max(0, Math.round(deliveryFee)) : 0;
  return {
    subtotal,
    discount,
    deliveryFee: normalizedDeliveryFee,
    total: Math.max(0, subtotal - discount + normalizedDeliveryFee),
  };
}

export function calculateVendorCommission(amount: number, rate = 12) {
  if (rate === LAUNCH_PROMO_COMMISSION_RATE) return 0;
  const clampedRate = Math.min(15, Math.max(10, rate));
  return Math.round((amount * clampedRate) / 100);
}

export function createOrderReference() {
  const time = Date.now().toString(36).slice(-5).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `AC-${time}-${random}`;
}
