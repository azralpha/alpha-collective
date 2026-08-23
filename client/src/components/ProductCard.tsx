import { useCart } from "@/contexts/CartContext";
import { formatNaira, type MarketplaceProduct } from "@shared/marketplace";
import { Plus } from "lucide-react";
import { Link } from "wouter";

export default function ProductCard({ product }: { product: MarketplaceProduct }) {
  const { addItem } = useCart();

  return (
    <article className="product-card">
      <Link href={`/product/${product.id}`} className="product-image-wrap" aria-label={`View ${product.title}`}>
        {product.badge ? <span className="product-badge">{product.badge}</span> : null}
        <img src={product.imageUrl} alt={product.title} className="product-image" />
      </Link>
      <div className="product-card-copy">
        <div className="product-meta"><span>{product.category}</span><span className="meta-separator">/</span><span>{product.vendor.split(",")[0]}</span></div>
        <Link href={`/product/${product.id}`} className="product-title">{product.title}</Link>
        <p className="product-description">{product.description}</p>
        <div className="product-bottom-row">
          <div className="price-stack">
            <strong>{formatNaira(product.price)}</strong>
            {product.formerPrice ? <s>{formatNaira(product.formerPrice)}</s> : null}
          </div>
          <button onClick={() => addItem(product.id)} className="add-to-cart-icon" aria-label={`Add ${product.title} to cart`}>
            <Plus size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
