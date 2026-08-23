export const MARKETPLACE_CATEGORIES = ["Fashion", "Phones", "Beauty", "Home"] as const;

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
    category: "Phones",
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
    category: "Home",
    price: 9800,
    formerPrice: 12500,
    badge: "Made local",
    imageUrl: "/manus-storage/alpha-home-v2_51b763e7.jpg",
    description: "A warm, hand-finished bowl for the table or shelf.",
    detail:
      "A quietly textured ceramic bowl for everyday serving or display. Handmade pieces can vary subtly in finish.",
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
  const clampedRate = Math.min(15, Math.max(10, rate));
  return Math.round((amount * clampedRate) / 100);
}

export function createOrderReference() {
  const time = Date.now().toString(36).slice(-5).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `AC-${time}-${random}`;
}
