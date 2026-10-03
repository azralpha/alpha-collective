import MarketplaceShell from "@/components/MarketplaceShell";
import TelegramVendorLinkCard from "@/components/TelegramVendorLinkCard";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  calculateVendorCommission,
  formatNaira,
  LAUNCH_PROMO_COMMISSION_RATE,
  LAUNCH_PROMO_NOTE,
  MARKETPLACE_CATEGORIES,
  type MarketplaceCategory,
} from "@shared/marketplace";
import { ArrowRight, ChevronLeft, ChevronRight, ImagePlus, LockKeyhole, Pencil, Plus, WalletCards, X } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const ADMIN_VALIDATION_URL = "https://wa.me/2349022143401?text=Hello%20Admin%2C%20I%20have%20submitted%20a%20new%20product%20draft%20for%20review.";
type LocalImage = { file: File; preview: string };
type CatalogueStatus = "all" | "draft" | "active" | "rejected";
type CatalogueCategory = "all" | MarketplaceCategory;

const catalogueStatusOptions: Array<{ value: CatalogueStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
];

async function readFileAsDataUrl(file: File) {
  if (!file.size) throw new Error(`${file.name || "This image"} is empty. Choose the image again and retry.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, offset + chunkSize)));
  return `data:${file.type};base64,${btoa(binary)}`;
}

function existingGallery(product: { imageUrl: string | null; imageUrls: string[] | null }) {
  return product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
}

function releaseImages(images: LocalImage[]) {
  images.forEach(image => URL.revokeObjectURL(image.preview));
}

export default function VendorDashboard() {
  const { loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [catalogueStatus, setCatalogueStatus] = useState<CatalogueStatus>("all");
  const [catalogueCategory, setCatalogueCategory] = useState<CatalogueCategory>("all");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [cataloguePage, setCataloguePage] = useState(1);
  const [cataloguePageSize, setCataloguePageSize] = useState(25);
  const catalogueInput = useMemo(() => ({
    status: catalogueStatus === "all" ? undefined : catalogueStatus,
    category: catalogueCategory === "all" ? undefined : catalogueCategory,
    search: catalogueSearch.trim() || undefined,
    page: cataloguePage,
    pageSize: cataloguePageSize,
  }), [catalogueCategory, cataloguePage, cataloguePageSize, catalogueSearch, catalogueStatus]);
  const dashboard = trpc.marketplace.vendor.dashboard.useQuery(catalogueInput, { enabled: isAuthenticated });
  const [category, setCategory] = useState<MarketplaceCategory>("Fashion");
  const [productImages, setProductImages] = useState<LocalImage[]>([]);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState<MarketplaceCategory>("Fashion");
  const [editImages, setEditImages] = useState<LocalImage[]>([]);
  const uploadProductImage = trpc.marketplace.vendor.uploadProductImage.useMutation();
  const createProduct = trpc.marketplace.vendor.createProduct.useMutation();
  const updateDraftProduct = trpc.marketplace.vendor.updateDraftProduct.useMutation();

  const acceptImages = (files: File[], setter: React.Dispatch<React.SetStateAction<LocalImage[]>>) => {
    const accepted = files.filter(file => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error(`${file.name} was skipped. Use JPG, PNG, or WebP images.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} was skipped. Images must be 5 MB or smaller.`);
        return false;
      }
      return true;
    });
    setter(previous => {
      const availableSlots = Math.max(0, 5 - previous.length);
      if (accepted.length > availableSlots) toast.message("You can add up to five product images.");
      return [...previous, ...accepted.slice(0, availableSlots).map(file => ({ file, preview: URL.createObjectURL(file) }))];
    });
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<LocalImage[]>>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    acceptImages(incoming, setter);
  };

  const removeImage = (index: number, setter: React.Dispatch<React.SetStateAction<LocalImage[]>>) => {
    setter(previous => {
      const image = previous[index];
      if (image) URL.revokeObjectURL(image.preview);
      return previous.filter((_, imageIndex) => imageIndex !== index);
    });
  };

  const uploadImages = async (images: LocalImage[]) => {
    const imageUrls: string[] = [];
    for (const image of images) {
      const dataUrl = await readFileAsDataUrl(image.file);
      const upload = await uploadProductImage.mutateAsync({ dataUrl });
      imageUrls.push(upload.imageUrl);
    }
    return imageUrls;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (productImages.length === 0) return toast.error("Add at least one product image before saving your draft.");
    const form = new FormData(event.currentTarget);
    try {
      const imageUrls = await uploadImages(productImages);
      await createProduct.mutateAsync({ title: String(form.get("title") ?? ""), category, price: Number(form.get("price")), description: String(form.get("description") ?? ""), imageUrls });
      event.currentTarget.reset();
      releaseImages(productImages);
      setProductImages([]);
      setCatalogueStatus("all");
      setCataloguePage(1);
      await utils.marketplace.vendor.dashboard.invalidate();
      toast.success("Your product draft and image gallery were saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your product draft could not be saved.");
    }
  };

  const beginEdit = (product: { id: number; category: MarketplaceCategory }) => {
    releaseImages(editImages);
    setEditImages([]);
    setEditCategory(product.category);
    setEditingProductId(product.id);
  };

  const cancelEdit = () => {
    releaseImages(editImages);
    setEditImages([]);
    setEditingProductId(null);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>, product: { id: number; imageUrl: string | null; imageUrls: string[] | null }) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const imageUrls = editImages.length ? await uploadImages(editImages) : existingGallery(product);
      if (!imageUrls.length) return toast.error("This draft needs at least one product image.");
      await updateDraftProduct.mutateAsync({ id: product.id, title: String(form.get("title") ?? ""), category: editCategory, price: Number(form.get("price")), description: String(form.get("description") ?? ""), ...(editImages.length ? { imageUrls } : {}) });
      await utils.marketplace.vendor.dashboard.invalidate();
      toast.success("Your draft changes were saved.");
      cancelEdit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your draft changes could not be saved.");
    }
  };

  function resetCataloguePage(action: () => void) {
    action();
    setCataloguePage(1);
  }

  if (loading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading your seller dashboard…</p></div></MarketplaceShell>;
  if (!isAuthenticated) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 38 }}><h2>Sign in for your seller space.</h2><p>Applications and product drafts are attached to your account.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to sell <ArrowRight size={17} /></button></div></div></MarketplaceShell>;
  if (dashboard.isLoading) return <MarketplaceShell><div className="page-shell"><p className="loading-line">Loading your seller dashboard…</p></div></MarketplaceShell>;
  if (dashboard.error) return <MarketplaceShell><div className="page-shell"><div className="form-error">{dashboard.error.message}</div></div></MarketplaceShell>;
  if (!dashboard.data?.application) return <MarketplaceShell><div className="page-shell"><div className="sign-in-card" style={{ marginTop: 38 }}><h2>Your seller space starts with an application.</h2><p>Tell us about your store, category, and WhatsApp number first.</p><Link className="button button-primary" href="/sell">Sell on Alpha Market <ArrowRight size={17} /></Link></div></div></MarketplaceShell>;

  const { application, products, kyc, productPage } = dashboard.data;
  const launchRate = LAUNCH_PROMO_COMMISSION_RATE;
  const isSaving = uploadProductImage.isPending || createProduct.isPending || updateDraftProduct.isPending;
  const productStart = productPage.total ? (productPage.page - 1) * productPage.pageSize + 1 : 0;
  const productEnd = productPage.total ? Math.min(productPage.page * productPage.pageSize, productPage.total) : 0;

  return <MarketplaceShell><div className="page-shell"><section><span className="eyebrow">Seller dashboard</span><h1 className="page-title">{application.storeName}</h1><p className="section-kicker">Application status: <strong style={{ textTransform: "capitalize", color: "var(--ink)" }}>{application.status}</strong>. Your submitted products remain drafts until a seller review makes them active.</p><div className="dashboard-metrics"><div className="metric"><strong>{productPage.total}</strong><span>saved products</span></div><div className="metric metric-promo"><strong>0% <em>(Launch Promo)</em></strong><span>current commission guide</span><small>{LAUNCH_PROMO_NOTE}</small></div><div className="metric"><strong>{kyc?.status === "verified" ? "✓" : "KYC"}</strong><span>{kyc?.status === "verified" ? "withdrawal enabled" : "verification required for withdrawals"}</span></div></div><div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}><Link href="/wallet" className="button button-secondary"><WalletCards size={17} /> Open Alpha Wallet</Link><Link href="/kyc" className="button button-secondary"><LockKeyhole size={17} /> {kyc?.status === "verified" ? "View KYC status" : "Complete KYC Verification"}</Link></div></section><TelegramVendorLinkCard /><div className="dashboard-layout"><section><div className="catalogue-list-heading"><div><span className="eyebrow">Your catalogue</span><h2 className="section-title">Saved products.</h2></div><strong>{productPage.total} saved</strong></div><div className="catalogue-browse-controls"><div className="catalogue-status-toggle" role="tablist" aria-label="Saved product status"><span>Status</span>{catalogueStatusOptions.map(option => <button type="button" role="tab" aria-selected={catalogueStatus === option.value} className={catalogueStatus === option.value ? "active" : ""} key={option.value} onClick={() => resetCataloguePage(() => setCatalogueStatus(option.value))}>{option.label}</button>)}</div><label className="catalogue-search">Search saved products<input value={catalogueSearch} onChange={event => resetCataloguePage(() => setCatalogueSearch(event.target.value))} placeholder="Product title" /></label><label>Category<select value={catalogueCategory} onChange={event => resetCataloguePage(() => setCatalogueCategory(event.target.value as CatalogueCategory))}><option value="all">All categories</option>{MARKETPLACE_CATEGORIES.map(item => <option value={item} key={item}>{item}</option>)}</select></label><label>Show<select value={cataloguePageSize} onChange={event => resetCataloguePage(() => setCataloguePageSize(Number(event.target.value)))}><option value={25}>25 products</option><option value={50}>50 products</option><option value={100}>100 products</option></select></label></div><p className="catalogue-page-summary">{productPage.total ? `Showing ${productStart}–${productEnd} of ${productPage.total} saved product${productPage.total === 1 ? "" : "s"}.` : "No saved products match these controls."}</p><div className="dashboard-products">{products.length ? products.map(product => { const images = existingGallery(product); const isEditing = editingProductId === product.id; return <div key={product.id} className={`vendor-product-row${isEditing ? " vendor-product-editing" : ""}`}>{images.length ? <div className="vendor-draft-gallery">{images.slice(0, 4).map((imageUrl, index) => <img className="vendor-product-thumb" src={imageUrl} alt={`${product.title} image ${index + 1}`} key={imageUrl} />)}</div> : <div className="vendor-product-thumb vendor-product-thumb-empty"><ImagePlus size={18} /></div>}{isEditing ? <form className="vendor-edit-form" onSubmit={event => handleEditSubmit(event, product)}><div className="form-grid"><div className="form-field"><label htmlFor={`edit-title-${product.id}`}>Product title</label><input id={`edit-title-${product.id}`} name="title" defaultValue={product.title} required /></div><div className="form-field"><label htmlFor={`edit-category-${product.id}`}>Category</label><select id={`edit-category-${product.id}`} value={editCategory} onChange={event => setEditCategory(event.target.value as MarketplaceCategory)}>{MARKETPLACE_CATEGORIES.map(item => <option value={item} key={item}>{item}</option>)}</select></div><div className="form-field"><label htmlFor={`edit-price-${product.id}`}>Price in Naira</label><input id={`edit-price-${product.id}`} name="price" type="number" min="500" defaultValue={product.price} required /></div><div className="form-field"><label htmlFor={`edit-description-${product.id}`}>Short description</label><textarea id={`edit-description-${product.id}`} name="description" minLength={12} defaultValue={product.description} required /></div></div><div className="form-field"><label htmlFor={`edit-images-${product.id}`}>Replace image gallery <span className="field-note">· Optional</span></label><input id={`edit-images-${product.id}`} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => handleImageChange(event, setEditImages)} />{editImages.length ? <div className="product-upload-gallery">{editImages.map((image, index) => <div className="product-upload-tile" key={`${image.file.name}-${index}`}><img src={image.preview} alt={`Replacement product image ${index + 1}`} /><span>{index === 0 ? "New thumbnail" : `Image ${index + 1}`}</span><button type="button" onClick={() => removeImage(index, setEditImages)} aria-label={`Remove replacement image ${index + 1}`}>×</button></div>)}</div> : <p className="form-hint">Leave empty to keep the current gallery. Adding images replaces the full gallery.</p>}</div><div className="vendor-edit-actions"><button type="submit" className="button button-primary" disabled={isSaving}>Save draft changes</button><button type="button" className="button button-secondary" onClick={cancelEdit} disabled={isSaving}>Cancel</button></div></form> : <><div><h3>{product.title}</h3><p>{product.category} · {formatNaira(product.price)} · Estimated {launchRate}% commission: {formatNaira(calculateVendorCommission(product.price, launchRate))}</p></div><span className="status-tag">{product.status}</span>{product.status === "draft" ? <button type="button" className="vendor-edit-trigger" onClick={() => beginEdit(product)}><Pencil size={15} /> Edit draft</button> : null}</>}</div>; }) : <div className="empty-panel" style={{ marginTop: 20 }}><h2>No saved products found.</h2><p>Try another status, category, or title search, or add a new product draft at the side.</p></div>}</div>{productPage.totalPages > 1 ? <nav className="catalogue-pagination" aria-label="Saved product pages"><button type="button" className="button button-secondary" disabled={productPage.page === 1} onClick={() => setCataloguePage(current => Math.max(1, current - 1))}><ChevronLeft size={16} /> Previous</button><span>Page {productPage.page} of {productPage.totalPages}</span><button type="button" className="button button-secondary" disabled={productPage.page === productPage.totalPages} onClick={() => setCataloguePage(current => Math.min(productPage.totalPages, current + 1))}>Next <ChevronRight size={16} /></button></nav> : null}{productPage.total > 0 && application.status === "pending" ? <a className="button button-primary admin-validation-button" href={ADMIN_VALIDATION_URL} target="_blank" rel="noreferrer">Request Admin Validation <ArrowRight size={17} /></a> : null}</section><aside><div className="summary-card"><span className="eyebrow">Add to catalogue</span><h2 style={{ marginTop: 8 }}>Create a draft.</h2><form className="product-form" onSubmit={handleSubmit} style={{ border: 0, padding: 0, marginTop: 18 }}><div className="form-field"><label htmlFor="productImage">Product images <span className="field-note">· First image becomes the thumbnail</span></label><input id="productImage" name="productImage" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => handleImageChange(event, setProductImages)} required={productImages.length === 0} />{productImages.length ? <div className="product-upload-gallery">{productImages.map((image, index) => <div className="product-upload-tile" key={`${image.file.name}-${index}`}><img src={image.preview} alt={`Selected product image ${index + 1}`} /><span>{index === 0 ? "Thumbnail" : `Image ${index + 1}`}</span><button type="button" onClick={() => removeImage(index, setProductImages)} aria-label={`Remove image ${index + 1}`}>×</button></div>)}</div> : <p className="form-hint">Add up to five clear JPG, PNG, or WebP images, each up to 5 MB.</p>}</div><div className="form-field" style={{ marginTop: 13 }}><label htmlFor="productTitle">Product title</label><input id="productTitle" name="title" required placeholder="What are you selling?" /></div><div className="form-field" style={{ marginTop: 13 }}><label htmlFor="productCategory">Category</label><select id="productCategory" value={category} onChange={event => setCategory(event.target.value as MarketplaceCategory)}>{MARKETPLACE_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="form-field" style={{ marginTop: 13 }}><label htmlFor="productPrice">Price in Naira</label><input id="productPrice" name="price" type="number" min="500" required placeholder="e.g. 15000" /></div><div className="form-field" style={{ marginTop: 13 }}><label htmlFor="productDescription">Short description <span className="field-note">· Indicate if it is a bulk product</span></label><textarea id="productDescription" name="description" minLength={12} required placeholder="Materials, size, condition, or the useful details." /></div>{createProduct.error || uploadProductImage.error ? <div className="form-error">{createProduct.error?.message ?? uploadProductImage.error?.message}</div> : null}<button type="submit" className="button button-primary" style={{ marginTop: 18 }} disabled={isSaving}>{isSaving ? "Saving draft…" : "Save product draft"} <Plus size={16} /></button></form><div className="cod-chip"><WalletCards size={14} /> Confirm payout timing and account details during onboarding.</div></div></aside></div><section className="published-edit-notice"><LockKeyhole size={21} /><div><strong>Published products are locked.</strong><p>Once a product is approved and published, it cannot be edited from this dashboard. Contact the Alpha admin to arrange a paid change request before any update is made.</p></div></section></div></MarketplaceShell>;
}
