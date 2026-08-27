import { useCart } from "@/contexts/CartContext";
import { formatNaira, type MarketplaceProduct } from "@shared/marketplace";
import { Plus } from "lucide-react";
import { Link } from "wouter";
import VendorTrustBadges from "./VendorTrustBadges";
import "./vendorTrustBadges.css";

export default function ProductCard({ product }: { product: MarketplaceProduct }) {
  const { addItem } = useCart();
  const isVendorFind = product.id.startsWith("vendor-");
  const isSoldOut = !isVendorFind && product.stockQuantity === 0;

  return (
    <article className="product-card">
      <Link href={`/product/${product.id}`} className="product-image-wrap" aria-label={`View ${product.title}`}>
        {product.badge ? <span className="product-badge">{product.badge}</span> : null}
        <img src={product.imageUrl} alt={product.title} className="product-image" />
      </Link>
      <div className="product-card-copy">
        <div className="product-meta"><span>{product.category}</span><span className="meta-separator">/</span><span>{product.vendor.split(",")[0]}</span><VendorTrustBadges trust={product.vendorTrust} /></div>
        <Link href={`/product/${product.id}`} className="product-title">{product.title}</Link>
        <p className="product-description">{product.description}</p>
        <div className="product-bottom-row">
          <div className="price-stack">
            <strong>{formatNaira(product.price)}</strong>
            {product.formerPrice ? <s>{formatNaira(product.formerPrice)}</s> : null}
          </div>
          {isVendorFind ? <Link href={`/product/${product.id}`} className="product-view-link">View</Link> : <button disabled={isSoldOut} onClick={() => { if (!isSoldOut) addItem(product.id); }} className="add-to-cart-icon" aria-label={isSoldOut ? `${product.title} is out of stock` : `Add ${product.title} to cart`}><Plus size={18} /></button>}
        </div>
      </div>
    </article>
  );
}
