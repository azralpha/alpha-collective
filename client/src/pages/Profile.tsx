import MarketplaceShell from "@/components/MarketplaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@shared/marketplace";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { BadgeCheck, BookOpen, Camera, ChevronRight, CircleHelp, Download, Heart, Landmark, LockKeyhole, LogOut, MapPin, MessageCircle, Pencil, Plus, ShieldCheck, Sparkles, Star, Trophy, UserRound, X } from "lucide-react";
import GiftCardSection from "@/components/GiftCardSection";

const emptyAddress = { label: "Home", recipientName: "", phone: "", state: "", lga: "", streetDetails: "", isDefault: true };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "AM";
}

function downloadReceipt(order: any) {
  const items = (order.orderLines ?? []).map((line: any) => `${line.quantity} × ${line.title} — ${formatNaira(line.lineTotal)}`).join("\n");
  const receipt = `ALPHA MARKET RECEIPT\n\nOrder: ${order.reference}\nDate: ${new Date(order.createdAt).toLocaleString()}\nStatus: ${order.fulfillmentStatus}\nPayment: ${order.paymentStatus}\n\n${items}\n\nSubtotal: ${formatNaira(order.subtotal)}\nDelivery: ${formatNaira(order.deliveryFee)}\nTotal: ${formatNaira(order.total)}\n\nThank you for shopping with Alpha Market.`;
  const blob = new Blob([receipt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${order.reference}-receipt.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Profile() {
  const { isAuthenticated, loading, user } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.profile.dashboard.useQuery(undefined, { enabled: isAuthenticated });
  const updateProfile = trpc.profile.update.useMutation({ onSuccess: () => { toast.success("Profile saved"); utils.profile.dashboard.invalidate(); }, onError: error => toast.error(error.message) });
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({ onSuccess: () => { toast.success("Profile picture updated"); utils.profile.dashboard.invalidate(); }, onError: error => toast.error(error.message) });
  const toggleFollow = trpc.profile.toggleFollowVendor.useMutation({ onSuccess: () => utils.profile.dashboard.invalidate(), onError: error => toast.error(error.message) });
  const saveAddress = trpc.profile.saveAddress.useMutation({ onSuccess: () => { toast.success("Address saved"); setAddressForm(null); utils.profile.dashboard.invalidate(); }, onError: error => toast.error(error.message) });
  const deleteAddress = trpc.profile.deleteAddress.useMutation({ onSuccess: () => { toast.success("Address removed"); utils.profile.dashboard.invalidate(); }, onError: error => toast.error(error.message) });
  const setDefaultAddress = trpc.profile.setDefaultAddress.useMutation({ onSuccess: () => utils.profile.dashboard.invalidate(), onError: error => toast.error(error.message) });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/"; } });

  const data = dashboard.data;
  const profile = data?.profile;
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "addresses" | "following">("overview");
  const [editingPublic, setEditingPublic] = useState(false);
  const [editingLegal, setEditingLegal] = useState(false);
  const [addressForm, setAddressForm] = useState<any>(null);
  const [publicForm, setPublicForm] = useState({ username: "", phone: "" });
  const [legalForm, setLegalForm] = useState({ legalName: "", dateOfBirth: "" });
  const [avatarBusy, setAvatarBusy] = useState(false);

  const currentName = profile?.username || user?.name || "Alpha Market member";
  const orderCount = data?.orders.length ?? 0;
  const defaultAddress = data?.addresses.find(address => address.isDefault === 1);
  const nextLevelLabel = useMemo(() => data?.loyalty.level === "Trailblazer" ? "You are at the top tier" : `${formatNaira(Math.max(0, (data?.loyalty.nextLevelPoints ?? 0) - (data?.loyalty.points ?? 0)))} loyalty points to the next level`, [data]);

  if (loading || (isAuthenticated && dashboard.isLoading)) return <MarketplaceShell><main className="page-shell"><p className="loading-line">Loading your Alpha Market dashboard…</p></main></MarketplaceShell>;
  if (!isAuthenticated || !data) return <MarketplaceShell><main className="page-shell"><section className="sign-in-card"><ShieldCheck size={34} /><span className="eyebrow">Your account</span><h1>Sign in to your dashboard.</h1><p>Manage your profile, orders, saved addresses, rewards, and followed sellers in one place.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in to continue</button></section></main></MarketplaceShell>;
  if (!profile) return <MarketplaceShell><main className="page-shell"><p className="loading-line">Preparing your profile…</p></main></MarketplaceShell>;

  const openPublicEditor = () => { setPublicForm({ username: profile.username ?? "", phone: profile.phone ?? "" }); setEditingPublic(true); };
  const openLegalEditor = () => { setLegalForm({ legalName: profile.legalName ?? "", dateOfBirth: profile.dateOfBirth ?? "" }); setEditingLegal(true); };
  const handleAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    setAvatarBusy(true);
    const reader = new FileReader();
    reader.onload = () => { uploadAvatar.mutate({ dataUrl: String(reader.result) }, { onSettled: () => setAvatarBusy(false) }); };
    reader.readAsDataURL(file);
  };

  return <MarketplaceShell>
    <main className="page-shell profile-page">
      <section className="profile-hero">
        <div className="profile-hero-copy"><span className="eyebrow eyebrow-dark">Your Alpha Market space</span><h1>Welcome back, {currentName.split(" ")[0]}.</h1><p>Keep your identity, rewards, purchases, and seller community in one calm, useful workspace.</p></div>
        <div className="profile-avatar-wrap">
          {profile.profileImageUrl ? <img src={profile.profileImageUrl} alt={`${currentName} profile`} className="profile-avatar" /> : <div className="profile-avatar profile-avatar-fallback">{initials(currentName)}</div>}
          <label className="avatar-upload" aria-label="Upload profile picture"><Camera size={16} />{avatarBusy ? "Saving" : "Photo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatar} disabled={avatarBusy} /></label>
        </div>
      </section>

      <section className="profile-stat-grid" aria-label="Account summary">
        <article className="profile-stat-card"><span>Orders</span><strong>{orderCount}</strong><small>Purchase history</small></article>
        <article className="profile-stat-card"><span>Community</span><strong className="flex gap-3 text-xl"><span>{data.followersCount}</span><span className="text-slate-300">/</span><span>{data.followingCount}</span></strong><small>Followers / Following</small></article>
        <article className="profile-stat-card"><span>Points</span><strong>{data.loyalty.points.toLocaleString()}</strong><small>{data.loyalty.level} tier</small></article>
        <article className="profile-stat-card"><span>Wallet</span><strong>{formatNaira((data.wallet?.withdrawableBalance ?? 0) + (data.wallet?.bonusBalance ?? 0))}</strong><small><Link href="/wallet">Open wallet</Link></small></article>
      </section>

      <GiftCardSection />

      <nav className="profile-tabs" aria-label="Profile sections">
        {[['overview', 'Overview'], ['orders', 'Orders'], ['addresses', 'Addresses'], ['following', 'Following']].map(([key, label]) => <button key={key} className={activeTab === key ? "profile-tab active" : "profile-tab"} onClick={() => setActiveTab(key as typeof activeTab)}>{label}</button>)}
      </nav>

      {activeTab === "overview" && <div className="profile-content-grid">
        <section className="profile-panel profile-panel-wide">
          <div className="panel-heading"><div><span className="eyebrow">Account overview</span><h2>Identity & security</h2></div><UserRound size={22} /></div>
          <div className="identity-row"><div className="identity-icon"><UserRound size={18} /></div><div className="identity-copy"><strong>Public identity</strong><p>{profile.username || "Add a display name"} · visible on seller and community surfaces</p></div><button className="icon-text-button" onClick={openPublicEditor}><Pencil size={15} /> Edit</button></div>
          {editingPublic && <form className="inline-editor" onSubmit={event => { event.preventDefault(); updateProfile.mutate(publicForm, { onSuccess: () => setEditingPublic(false) }); }}><label>Username / Display Name<input value={publicForm.username} onChange={event => setPublicForm({ ...publicForm, username: event.target.value })} maxLength={80} required /></label><label>Phone number<input value={publicForm.phone} onChange={event => setPublicForm({ ...publicForm, phone: event.target.value })} maxLength={32} placeholder="080…" /></label><div className="editor-actions"><button type="button" className="button button-secondary" onClick={() => setEditingPublic(false)}>Cancel</button><button className="button button-primary" disabled={updateProfile.isPending}>Save public details</button></div></form>}
          <div className="identity-row"><div className="identity-icon secure"><LockKeyhole size={18} /></div><div className="identity-copy"><strong>Legal identity</strong><p>{profile.legalIdentityLocked ? `${profile.legalName} · verified identity record locked` : "Not set yet · required for verification"}</p></div>{profile.legalIdentityLocked ? <span className="locked-pill"><LockKeyhole size={14} /> Locked</span> : <button className="icon-text-button" onClick={openLegalEditor}><Pencil size={15} /> Set once</button>}</div>
          {editingLegal && !profile.legalIdentityLocked && <form className="inline-editor legal-editor" onSubmit={event => { event.preventDefault(); updateProfile.mutate(legalForm, { onSuccess: () => setEditingLegal(false) }); }}><div className="legal-warning"><ShieldCheck size={18} /><span>Your full legal name and date of birth can only be saved once. They must match your KYC identification.</span></div><label>Full Legal Name<input value={legalForm.legalName} onChange={event => setLegalForm({ ...legalForm, legalName: event.target.value })} required /></label><label>Date of Birth<input type="date" value={legalForm.dateOfBirth} onChange={event => setLegalForm({ ...legalForm, dateOfBirth: event.target.value })} required /></label><div className="editor-actions"><button type="button" className="button button-secondary" onClick={() => setEditingLegal(false)}>Cancel</button><button className="button button-primary" disabled={updateProfile.isPending}>Lock legal identity</button></div></form>}
          <div className="identity-row"><div className="identity-icon"><BookOpen size={18} /></div><div className="identity-copy"><strong>Contact & login</strong><p>{profile.email || "Email managed by Manus"} · {profile.loginMethod ? `Signed in with ${profile.loginMethod}` : "Secure OAuth sign-in"}</p></div><span className="managed-pill">Managed securely</span></div>
          <div className="profile-note"><LockKeyhole size={16} /><span>Legal identity cannot be changed once saved. It must correlate with your KYC identification or your account will not be verified.</span></div>
        </section>

        <section className="profile-panel loyalty-panel"><div className="panel-heading"><div><span className="eyebrow">Gamified loyalty</span><h2>{data.loyalty.level}</h2></div><Trophy size={24} /></div><div className="loyalty-score"><strong>{data.loyalty.points.toLocaleString()}</strong><span>points</span></div><div className="progress-track"><span style={{ width: `${data.loyalty.progressPercent}%` }} /></div><p className="muted-copy">{nextLevelLabel}. Earn points from purchases and genuine reviews.</p><div className="achievement-list">{data.achievements.length ? data.achievements.map(achievement => <div className="achievement" key={achievement.achievementKey}><span><Star size={15} /></span><div><strong>{achievement.label}</strong><small>{achievement.description}</small></div></div>) : <p className="empty-copy">Your first achievement will appear after a completed purchase.</p>}</div><Link className="button button-secondary full-button" href="/rewards">Explore rewards <ChevronRight size={16} /></Link></section>

        <section className="profile-panel quick-actions"><div className="panel-heading"><div><span className="eyebrow">Support & actions</span><h2>Need a hand?</h2></div><CircleHelp size={23} /></div><a className="quick-link" href="https://wa.me/2340000000000?text=Hello%20Alpha%20Market%2C%20I%20need%20support" target="_blank" rel="noreferrer"><MessageCircle size={18} /><span>Customer service</span><ChevronRight size={16} /></a><Link className="quick-link" href="/terms-of-use"><ShieldCheck size={18} /><span>Disputes & protection</span><ChevronRight size={16} /></Link><Link className="quick-link" href="/privacy-policy"><CircleHelp size={18} /><span>FAQs & privacy</span><ChevronRight size={16} /></Link><button className="quick-link danger" onClick={() => logout.mutate()}><LogOut size={18} /><span>Log out</span><ChevronRight size={16} /></button></section>
      </div>}

      {activeTab === "orders" && <section className="profile-panel profile-list-panel"><div className="panel-heading"><div><span className="eyebrow">Your purchases</span><h2>Order history</h2></div><BookOpen size={23} /></div>{data.orders.length ? <div className="order-list">{data.orders.map(order => <article className="order-card" key={order.reference}><div className="order-card-top"><div><strong>{order.reference}</strong><small>{new Date(order.createdAt).toLocaleDateString()} · {order.orderLines?.length ?? 0} item line(s)</small></div><span className={`status-pill ${order.fulfillmentStatus}`}>{order.fulfillmentStatus}</span></div><p>{(order.orderLines ?? []).slice(0, 2).map(line => `${line.quantity} × ${line.title}`).join(", ")}{(order.orderLines ?? []).length > 2 ? " and more" : ""}</p><div className="order-card-bottom"><strong>{formatNaira(order.total)}</strong><button className="icon-text-button" onClick={() => downloadReceipt(order)}><Download size={15} /> Receipt</button></div></article>)}</div> : <div className="empty-state"><BookOpen size={28} /><h3>No orders yet</h3><p>Your completed purchases will appear here with downloadable receipts.</p><Link className="button button-primary" href="/shop">Browse the shop</Link></div>}</section>}

      {activeTab === "following" && <section className="profile-panel profile-list-panel"><div className="panel-heading"><div><span className="eyebrow">Seller community</span><h2>My favorite sellers</h2></div><Heart size={23} /></div>{data.followedSellers.length ? <div className="following-grid">{data.followedSellers.map(seller => <article className="seller-feed-card" key={seller.vendorUserId}><div className="seller-feed-heading"><div className="seller-mark">{initials(seller.storeName)}</div><div><strong>{seller.storeName}</strong><small>{seller.category}</small></div><button className="icon-only-button" aria-label={`Unfollow ${seller.storeName}`} onClick={() => toggleFollow.mutate({ vendorUserId: seller.vendorUserId })}><Heart size={16} fill="currentColor" /></button></div><div className="seller-product-grid">{seller.products.map(product => <div className="seller-product" key={product.id}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <div className="seller-product-placeholder"><Sparkles size={17} /></div>}<span>{product.title}</span><strong>{formatNaira(product.price)}</strong></div>)}</div>{!seller.products.length && <p className="empty-copy">New seller drops will appear here.</p>}</article>)}</div> : <div className="empty-state"><Heart size={28} /><h3>Follow sellers you love</h3><p>Open a product page, follow its seller, and their latest drops will land here.</p><Link className="button button-primary" href="/shop">Discover sellers</Link></div>}</section>}

      {activeTab === "addresses" && <section className="profile-panel profile-list-panel"><div className="panel-heading"><div><span className="eyebrow">Faster checkout</span><h2>Address book</h2></div><button className="button button-primary" onClick={() => setAddressForm(emptyAddress)}><Plus size={16} /> Add address</button></div>{addressForm && <AddressEditor initial={addressForm} pending={saveAddress.isPending} onCancel={() => setAddressForm(null)} onSave={values => saveAddress.mutate(values)} />}{data.addresses.length ? <div className="address-grid">{data.addresses.map(address => <article className={address.isDefault ? "address-card default" : "address-card"} key={address.id}><div className="address-card-heading"><div><strong>{address.label}</strong>{address.isDefault === 1 && <span className="default-pill">Default</span>}</div><MapPin size={18} /></div><p>{address.recipientName}<br />{address.phone}<br />Nigeria, {address.state}, {address.lga}<br />{address.streetDetails}</p><div className="address-actions"><button className="icon-text-button" onClick={() => setAddressForm({ ...address, isDefault: address.isDefault === 1 })}><Pencil size={14} /> Edit</button>{address.isDefault !== 1 && <button className="icon-text-button" onClick={() => setDefaultAddress.mutate({ id: address.id })}>Make default</button>}<button className="icon-only-button" aria-label={`Delete ${address.label}`} onClick={() => deleteAddress.mutate({ id: address.id })}><X size={16} /></button></div></article>)}</div> : !addressForm && <div className="empty-state"><MapPin size={28} /><h3>No saved addresses</h3><p>Save your regular delivery details to speed up checkout.</p></div>}</section>}
    </main>
  </MarketplaceShell>;
}

function AddressEditor({ initial, pending, onCancel, onSave }: { initial: any; pending: boolean; onCancel: () => void; onSave: (values: any) => void }) {
  const [form, setForm] = useState(initial);
  return <form className="address-editor" onSubmit={event => { event.preventDefault(); onSave(form); }}><div className="address-editor-heading"><strong>{form.id ? "Edit address" : "Add address"}</strong><button type="button" className="icon-only-button" onClick={onCancel} aria-label="Close address form"><X size={17} /></button></div><div className="form-grid"><label>Label<input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} placeholder="Home, office…" required /></label><label>Recipient name<input value={form.recipientName} onChange={event => setForm({ ...form, recipientName: event.target.value })} required /></label><label>Phone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} required /></label><label>State<input value={form.state} onChange={event => setForm({ ...form, state: event.target.value })} required /></label><label>LGA<input value={form.lga} onChange={event => setForm({ ...form, lga: event.target.value })} required /></label><label className="form-span-2">Street details<textarea value={form.streetDetails} onChange={event => setForm({ ...form, streetDetails: event.target.value })} placeholder="House number, street name, compound, and area" required /></label></div><label className="check-row"><input type="checkbox" checked={Boolean(form.isDefault)} onChange={event => setForm({ ...form, isDefault: event.target.checked })} /> Set as default delivery address</label><div className="editor-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={pending}>Save address</button></div></form>;
}
