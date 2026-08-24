import MarketplaceShell, { WHATSAPP_SUPPORT_URL } from "@/components/MarketplaceShell";
import ProductCard from "@/components/ProductCard";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { formatNaira, getProduct, MARKETPLACE_PRODUCTS, type MarketplaceProduct } from "@shared/marketplace";
import { ArrowLeft, CheckCircle2, MessageCircle, ShoppingBag, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

export default function Product() {
  const [, params] = useRoute("/product/:id");
  const approvedProducts = trpc.marketplace.publicProducts.useQuery();
  const product = getProduct(params?.id ?? "") ?? approvedProducts.data?.find(item => item.id === params?.id);
  const { addItem } = useCart();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!product && approvedProducts.isLoading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading this seller find…</p></div></MarketplaceShell>;
  if (!product) {
    return <MarketplaceShell><div className="page-shell"><div className="empty-panel"><h2>This find has moved on.</h2><p>Explore the rest of the Alpha Collective edit.</p><Link href="/shop" className="button button-primary">Back to shop</Link></div></div></MarketplaceShell>;
  }

  const related = [...MARKETPLACE_PRODUCTS, ...(approvedProducts.data ?? [])].filter(item => item.id !== product.id && item.category === product.category).slice(0, 3);
  const isVendorFind = product.id.startsWith("vendor-");
  const normalizedProduct = product as MarketplaceProduct;
  const galleryImages = normalizedProduct.imageUrls?.length ? normalizedProduct.imageUrls : [product.imageUrl];
  const displayedImage = selectedImage && galleryImages.includes(selectedImage) ? selectedImage : galleryImages[0];
  return (
    <MarketplaceShell>
      <div className="page-shell">
        <div className="detail-layout">
          <div><Link href="/shop" className="back-link"><ArrowLeft size={16} /> Back to shop</Link><div className="detail-image"><img src={displayedImage} alt={product.title} /></div>{galleryImages.length > 1 ? <div className="product-detail-gallery" aria-label="Product image gallery">{galleryImages.map((imageUrl, index) => <button key={imageUrl} type="button" className={displayedImage === imageUrl ? "active" : ""} onClick={() => setSelectedImage(imageUrl)} aria-label={`View product image ${index + 1}`}><img src={imageUrl} alt={`${product.title} view ${index + 1}`} /></button>)}</div> : null}</div>
          <div className="detail-copy">
            <span className="eyebrow">{product.category} / {product.badge ?? "collective find"}</span>
            <h1>{product.title}</h1>
            <p className="vendor-byline">By {product.vendor}</p>
            <div className="detail-price">{formatNaira(product.price)} {product.formerPrice ? <s>{formatNaira(product.formerPrice)}</s> : null}</div>
            <p className="detail-description">{product.detail}</p>
            <div className="detail-actions">{isVendorFind ? <a className="button button-primary" href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Ask about this product</a> : <button className="button button-primary" onClick={() => { addItem(product.id); toast.success(`${product.title} added to your cart.`); }}><ShoppingBag size={17} /> Add to cart</button>}<a className="button button-secondary" href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Ask on WhatsApp</a></div>
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
