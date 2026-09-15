import type { VendorTrust } from "@shared/marketplace";
import { BadgeCheck, Bolt, Star } from "lucide-react";

export default function VendorTrustBadges({ trust }: { trust?: VendorTrust }) {
  if (!trust) return null;

  return (
    <span className="vendor-trust-badges" aria-label="Store trust status">
      <span className={`vendor-trust-badge ${trust.verification === "verified" ? "vendor-trust-verified" : "vendor-trust-unverified"}`}>
        {trust.verification === "verified" ? <BadgeCheck size={12} aria-hidden="true" /> : null}
        {trust.verification === "verified" ? "Verified" : "Unverified"}
      </span>
      {trust.lightningSeller ? <span className="vendor-trust-badge vendor-trust-lightning"><Bolt size={12} aria-hidden="true" /> Lightning Seller</span> : null}
      {trust.topRated ? <span className="vendor-trust-badge vendor-trust-top-rated"><Star size={12} aria-hidden="true" /> Top Rated</span> : null}
    </span>
  );
}
