export const MARKETPLACE_CATEGORIES = ["Fashion", "Gadgets", "Beauty", "Home & Furniture", "Vehicles", "Animals & Pets"] as const;

export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];

export type MarketplaceProduct = {
  id: string;
  title: string;
  vendor: string;
  category: MarketplaceCategory;
  price: number;
  formerPrice?: number;
  badge?: string;
  imageUrl: string;
  imageUrls?: string[];
  description: string;
  detail: string;
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
    imageUrl: "/manus-storage/alpha-tote-v2_6dc24e32.jpg",
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
    imageUrl: "/manus-storage/alpha-earbuds-v2_91953386.jpg",
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
    imageUrl: "/manus-storage/alpha-beauty-v2_c7243980.jpg",
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
    imageUrl: "/manus-storage/alpha-home-v2_51b763e7.jpg",
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
    imageUrl: "/manus-storage/alpha-vehicles_5be21869.jpg",
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
    imageUrl: "/manus-storage/alpha-furniture_f4fd12ae.jpg",
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
    imageUrl: "/manus-storage/alpha-pets_c5b86711.jpg",
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
export const DELIVERY_FEE = 1500;
export const LAUNCH_PROMO_COMMISSION_RATE = 0;
export const LAUNCH_PROMO_NOTE = "0% commission active for the first two weeks to help you grow!";

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getProduct(productId: string) {
  return MARKETPLACE_PRODUCTS.find(product => product.id === productId);
}

export function resolveCartLines(lines: CartLine[]): ResolvedCartLine[] {
  return lines.flatMap(line => {
    const product = getProduct(line.productId);
    const quantity = Math.max(0, Math.floor(line.quantity));
    if (!product || quantity === 0) return [];

    return [{ ...line, quantity, product, lineTotal: product.price * quantity }];
  });
}

export function getCartSubtotal(lines: CartLine[]) {
  return resolveCartLines(lines).reduce((total, line) => total + line.lineTotal, 0);
}

export function qualifiesForReferralDiscount(subtotal: number) {
  return subtotal >= REFERRAL_MINIMUM_SUBTOTAL;
}

export function getCheckoutTotals(lines: CartLine[], hasValidReferralCode = false) {
  const subtotal = getCartSubtotal(lines);
  const discount = hasValidReferralCode && qualifiesForReferralDiscount(subtotal) ? REFERRAL_DISCOUNT : 0;
  return {
    subtotal,
    discount,
    deliveryFee: subtotal > 0 ? DELIVERY_FEE : 0,
    total: Math.max(0, subtotal - discount + (subtotal > 0 ? DELIVERY_FEE : 0)),
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
