import type { CartLine } from "@shared/marketplace";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CART_STORAGE_KEY = "alpha-collective-cart";

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  addItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function initialCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
      if (
        typeof item === "object" &&
        item !== null &&
        "productId" in item &&
        "quantity" in item &&
        typeof item.productId === "string" &&
        typeof item.quantity === "number" &&
        item.quantity > 0
      ) {
        return [{ productId: item.productId, quantity: Math.min(10, Math.floor(item.quantity)) }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(initialCart);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const setQuantity = (productId: string, quantity: number) => {
      setItems(previous => {
        if (quantity <= 0) return previous.filter(item => item.productId !== productId);
        const normalized = Math.min(10, Math.floor(quantity));
        const existing = previous.find(item => item.productId === productId);
        return existing
          ? previous.map(item => (item.productId === productId ? { ...item, quantity: normalized } : item))
          : [...previous, { productId, quantity: normalized }];
      });
    };

    return {
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      addItem: productId => {
        const current = items.find(item => item.productId === productId)?.quantity ?? 0;
        setQuantity(productId, current + 1);
      },
      setQuantity,
      removeItem: productId => setItems(previous => previous.filter(item => item.productId !== productId)),
      clearCart: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
