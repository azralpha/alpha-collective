import MarketplaceShell, { WHATSAPP_SUPPORT_URL } from "@/components/MarketplaceShell";
import ProductCard from "@/components/ProductCard";
import { useCart } from "@/contexts/CartContext";
import { formatNaira, getProduct, MARKETPLACE_PRODUCTS } from "@shared/marketplace";
import { ArrowLeft, CheckCircle2, MessageCircle, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

export default function Product() {
  const [, params] = useRoute("/product/:id");
  const product = getProduct(params?.id ?? "");
  const { addItem } = useCart();

  if (!product) {
    return <MarketplaceShell><div className="page-shell"><div className="empty-panel"><h2>This find has moved on.</h2><p>Explore the rest of the Alpha Collective edit.</p><Link href="/shop" className="button button-primary">Back to shop</Link></div></div></MarketplaceShell>;
  }

  const related = MARKETPLACE_PRODUCTS.filter(item => item.id !== product.id && item.category === product.category).slice(0, 3);
  return (
    <MarketplaceShell>
      <div className="page-shell">
        <div className="detail-layout">
          <div><Link href="/shop" className="back-link"><ArrowLeft size={16} /> Back to shop</Link><div className="detail-image"><img src={product.imageUrl} alt={product.title} /></div></div>
          <div className="detail-copy">
            <span className="eyebrow">{product.category} / {product.badge ?? "collective find"}</span>
            <h1>{product.title}</h1>
            <p className="vendor-byline">Sold by {product.vendor}</p>
            <div className="detail-price">{formatNaira(product.price)} {product.formerPrice ? <s>{formatNaira(product.formerPrice)}</s> : null}</div>
            <p className="detail-description">{product.detail}</p>
            <div className="detail-actions"><button className="button button-primary" onClick={() => { addItem(product.id); toast.success(`${product.title} added to your cart.`); }}><ShoppingBag size={17} /> Add to cart</button><a className="button button-secondary" href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Ask on WhatsApp</a></div>
            <div className="detail-facts">
              <div className="detail-fact"><Truck size={19} /><span><strong>Pay on Delivery is available.</strong><br />Your saved order is confirmed before delivery coordination begins.</span></div>
              <div className="detail-fact"><CheckCircle2 size={19} /><span><strong>Seller details stay close.</strong><br />Use WhatsApp support if you need a product or delivery clarification.</span></div>
            </div>
          </div>
        </div>
        {related.length > 0 ? <section className="section" style={{ width: "100%" }}><div className="section-heading"><div><span className="eyebrow">Keep looking</span><h2 className="section-title">More from this corner.</h2></div></div><div className="product-grid">{related.map(item => <ProductCard key={item.id} product={item} />)}</div></section> : null}
      </div>
    </MarketplaceShell>
  );
}
