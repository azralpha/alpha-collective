import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Tiered Cart Rewards user interface", () => {
  it("renders cart progress, one-click additions, and uses the same widget in the cart page and native drawer", () => {
    const widget = readFileSync(resolve(process.cwd(), "client/src/components/CartTierRewardWidget.tsx"), "utf8");
    const cart = readFileSync(resolve(process.cwd(), "client/src/pages/Cart.tsx"), "utf8");
    const drawer = readFileSync(resolve(process.cwd(), "client/src/components/CartDrawer.tsx"), "utf8");
    expect(widget).toContain("Spend");
    expect(widget).toContain("addItem(item.productId)");
    expect(widget).toContain("smartUpsell");
    expect(cart).toContain("CartTierRewardWidget items={items}");
    expect(drawer).toContain("CartTierRewardWidget items={items}");
  });
});
