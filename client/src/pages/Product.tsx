import MarketplaceShell from "@/components/MarketplaceShell";
import ProductCard from "@/components/ProductCard";
import VendorTrustBadges from "@/components/VendorTrustBadges";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { useDocumentSeo } from "@/lib/useDocumentSeo";
import { formatNaira, getProduct, MARKETPLACE_PRODUCTS, type MarketplaceProduct } from "@shared/marketplace";
import { ArrowLeft, CheckCircle2, MessageCircle, Send, ShoppingBag, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

export default function Product() {
  const [, params] = useRoute("/product/:id");
  const approvedProducts = trpc.marketplace.publicProducts.useQuery(undefined, { staleTime: 0, gcTime: 10 * 60_000, refetchOnWindowFocus: true });
  const product = (getProduct(params?.id ?? "") ?? approvedProducts.data?.find(item => item.id === params?.id)) as MarketplaceProduct | undefined;
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sentInquiryId, setSentInquiryId] = useState<string | null>(null);
  const productPath = `/product/${encodeURIComponent(params?.id ?? "")}`;
  const vendorProductId = product?.id.match(/^vendor-\d+$/)?.[0];
  const inquiries = trpc.telegramInquiries.forProduct.useQuery({ productId: vendorProductId ?? "vendor-0" }, { enabled: Boolean(vendorProductId && isAuthenticated), refetchInterval: 30_000 });
  const createInquiry = trpc.telegramInquiries.create.useMutation({
    onSuccess: result => {
      setSentInquiryId(result.inquiryId);
      setQuestion("");
      setAskOpen(false);
      void inquiries.refetch();
      toast.success("Your question has been sent to the vendor. Please wait for a reply.");
    },
  });
  useDocumentSeo({
    title: product ? `${product.title} | Alpha Market` : "Product | Alpha Market",
    description: product?.description ?? "Browse marketplace finds on Alpha Market.",
    canonicalPath: productPath,
    product,
  });

  if (!product && approvedProducts.isLoading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading this seller find…</p></div></MarketplaceShell>;
  if (!product) {
    return <MarketplaceShell><div className="page-shell"><div className="empty-panel"><h2>This find has moved on.</h2><p>Explore the rest of the Alpha Market edit.</p><Link href="/shop" className="button button-primary">Back to shop</Link></div></div></MarketplaceShell>;
  }

  const related = [...MARKETPLACE_PRODUCTS, ...(approvedProducts.data ?? [])].filter(item => item.id !== product.id && item.category === product.category).slice(0, 3);
  const isVendorFind = product.id.startsWith("vendor-");
  const normalizedProduct = product;
  const isSoldOut = !isVendorFind && normalizedProduct.stockQuantity === 0;
  const lowStockLabel = !isVendorFind && normalizedProduct.stockQuantity !== undefined && normalizedProduct.stockQuantity > 0 && normalizedProduct.stockQuantity <= 5
    ? `Only ${normalizedProduct.stockQuantity} item${normalizedProduct.stockQuantity === 1 ? "" : "s"} left in stock`
    : null;
  const galleryImages = normalizedProduct.imageUrls?.length ? normalizedProduct.imageUrls : [product.imageUrl];
  const displayedImage = selectedImage && galleryImages.includes(selectedImage) ? selectedImage : galleryImages[0];
  const submitQuestion = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    createInquiry.mutate({ productId: product.id as `vendor-${number}`, question });
  };

  return (
    <MarketplaceShell>
      <div className="page-shell">
        <div className="detail-layout">
          <div><Link href="/shop" className="back-link"><ArrowLeft size={16} /> Back to shop</Link><div className="detail-image"><img src={displayedImage} alt={product.title} /></div>{galleryImages.length > 1 ? <div className="product-detail-gallery" aria-label="Product image gallery">{galleryImages.map((imageUrl, index) => <button key={imageUrl} type="button" className={displayedImage === imageUrl ? "active" : ""} onClick={() => setSelectedImage(imageUrl)} aria-label={`View product image ${index + 1}`}><img src={imageUrl} alt={`${product.title} view ${index + 1}`} /></button>)}</div> : null}</div>
          <div className="detail-copy">
            <span className="eyebrow">{product.category} / {product.badge ?? "collective find"}</span>
            <h1>{product.title}</h1>
            <p className="vendor-byline">By {product.vendor} <VendorTrustBadges trust={normalizedProduct.vendorTrust} /></p>
            <div className="detail-price">{formatNaira(product.price)} {product.formerPrice ? <s>{formatNaira(product.formerPrice)}</s> : null}</div>
            {lowStockLabel ? <p className="stock-note stock-note-low">{lowStockLabel}</p> : null}
            {isSoldOut ? <p className="stock-note stock-note-empty">Currently out of stock</p> : null}
            <p className="detail-description">{product.detail}</p>
            <div className="detail-actions">{isVendorFind ? <><button className="button button-primary" type="button" onClick={() => { if (!isAuthenticated) { startLogin(); return; } setAskOpen(true); }}><MessageCircle size={17} /> Ask about product</button><button className="button button-secondary" onClick={() => { addItem(product.id); toast.success(`${product.title} added to your cart.`); }}><ShoppingBag size={17} /> Add to Cart</button></> : <button className="button button-primary" disabled={isSoldOut} onClick={() => { if (isSoldOut) return; addItem(product.id); toast.success(`${product.title} added to your cart.`); }}><ShoppingBag size={17} /> {isSoldOut ? "Out of stock" : "Add to cart"}</button>}</div>
            <div className="detail-facts">
              <div className="detail-fact"><Truck size={19} /><span><strong>Pay on Delivery is available after KYC verification.</strong><br />Your saved order is confirmed before delivery coordination begins.</span></div>
              <div className="detail-fact"><CheckCircle2 size={19} /><span><strong>Questions go straight to the seller.</strong><br />Ask about stock, sizing, delivery, or any product detail.</span></div>
            </div>
            {isVendorFind && inquiries.data?.some(inquiry => inquiry.reply) ? <section className="inquiry-replies" aria-label="Vendor replies"><span className="eyebrow">Seller replies</span>{inquiries.data.filter(inquiry => inquiry.reply).map(inquiry => <div className="inquiry-reply" key={inquiry.inquiryId}><p><strong>Your question:</strong> {inquiry.question}</p><p><strong>Vendor reply:</strong> {inquiry.reply}</p></div>)}</section> : null}
            {sentInquiryId ? <p className="form-hint" role="status">Your question has been sent to the vendor. We’ll show their reply here when they respond.</p> : null}
          </div>
        </div>
        {related.length > 0 ? <section className="section" style={{ width: "100%" }}><div className="section-heading"><div><span className="eyebrow">Keep looking</span><h2 className="section-title">More from this corner.</h2></div></div><div className="product-grid">{related.map(item => <ProductCard key={item.id} product={item} />)}</div></section> : null}
      </div>
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ask about {product.title}</DialogTitle><DialogDescription>Your question will be sent privately to the vendor and to the Alpha Market Vendors Group.</DialogDescription></DialogHeader>
          <form onSubmit={submitQuestion}>
            <textarea value={question} onChange={event => setQuestion(event.target.value)} minLength={3} maxLength={1000} required rows={6} placeholder="Ask about availability, size, colour, delivery, or anything else…" aria-label="Your product question" />
            <DialogFooter><button type="button" className="button button-secondary" onClick={() => setAskOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={createInquiry.isPending || question.trim().length < 3}><Send size={16} /> {createInquiry.isPending ? "Sending…" : "Send question"}</button></DialogFooter>
            {createInquiry.error ? <p className="form-error">{createInquiry.error.message}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
    </MarketplaceShell>
  );
}
