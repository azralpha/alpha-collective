import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { Check, ExternalLink, ImageOff, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

function productImages(product: { imageUrl: string | null; imageUrls: string[] | null }) {
  return product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
}

export default function AdminProductReview() {
  const { loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const review = trpc.marketplace.admin.reviewProducts.useQuery(undefined, { enabled: isAuthenticated });
  const setStatus = trpc.marketplace.admin.setProductStatus.useMutation({
    onSuccess: async (_, variables) => {
      await Promise.all([utils.marketplace.admin.reviewProducts.invalidate(), utils.marketplace.publicProducts.invalidate()]);
      toast.success(variables.status === "active" ? "Product approved and now available in the public shop." : "Product rejected. It remains hidden from the public shop.");
    },
  });

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Checking administrator access…</p></div></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 38 }}><h2>Sign in for product review.</h2><p>Only marketplace administrators can approve or reject vendor drafts.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to review products <ShieldCheck size={17} /></button></div></div></MarketplaceShell>;
  if (review.isLoading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading vendor product drafts…</p></div></MarketplaceShell>;
  if (review.error) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 38 }}><h2>Administrator access required.</h2><p>Your signed-in account does not have permission to review vendor products. The project owner account is assigned this access automatically.</p></div></div></MarketplaceShell>;

  const products = review.data ?? [];
  return (
    <MarketplaceShell>
      <div className="page-shell admin-review-page">
        <section className="admin-review-hero"><div><span className="eyebrow">Administrator workspace</span><h1 className="page-title">Review vendor products.</h1><p className="section-kicker">Inspect the seller, price, description, and full image gallery before making a product public. Approved products appear in the public shop immediately.</p></div><div className="admin-review-count"><strong>{products.filter(product => product.productStatus === "draft").length}</strong><span>drafts awaiting review</span></div></section>
        <div className="admin-review-list">
          {products.length ? products.map(product => {
            const images = productImages(product);
            const pending = product.productStatus === "draft";
            return <article className="admin-product-card" key={product.id}>
              <div className="admin-product-gallery">{images.length ? images.map((imageUrl, index) => <img key={imageUrl} src={imageUrl} alt={`${product.title} image ${index + 1}`} />) : <div className="admin-no-image"><ImageOff size={22} /> No images</div>}</div>
              <div className="admin-product-copy"><div className="admin-product-heading"><div><span className="eyebrow">{product.category} · {product.productStatus}</span><h2>{product.title}</h2></div><strong>{formatNaira(product.price)}</strong></div><p>{product.description}</p><dl className="admin-vendor-details"><div><dt>Store</dt><dd>{product.storeName}</dd></div><div><dt>Vendor</dt><dd>{product.vendorName}</dd></div><div><dt>WhatsApp</dt><dd><a href={`https://wa.me/${product.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{product.whatsapp} <ExternalLink size={12} /></a></dd></div></dl>{pending ? <div className="admin-review-actions"><button className="button button-primary" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: product.id, status: "active" })}><Check size={17} /> Approve & publish</button><button className="button button-secondary" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: product.id, status: "rejected" })}><X size={17} /> Reject product</button></div> : <div className={`admin-status admin-status-${product.productStatus}`}>{product.productStatus === "active" ? "Published in public shop" : "Rejected — hidden from public shop"}</div>}</div>
            </article>;
          }) : <div className="empty-panel"><h2>No vendor products to review.</h2><p>New image-backed drafts will appear here when vendors submit them.</p></div>}
        </div>
      </div>
    </MarketplaceShell>
  );
}
