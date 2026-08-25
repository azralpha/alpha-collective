import MarketplaceShell from "@/components/MarketplaceShell";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/lib/trpc";
import { MARKETPLACE_CATEGORIES, MARKETPLACE_PRODUCTS, type MarketplaceCategory } from "@shared/marketplace";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";

type CategoryFilter = "All" | MarketplaceCategory;

function categoryFromSearch(search: string): CategoryFilter {
  const value = new URLSearchParams(search).get("category");
  return MARKETPLACE_CATEGORIES.includes(value as MarketplaceCategory) ? (value as MarketplaceCategory) : "All";
}

function referralFromSearch(search: string) {
  const value = new URLSearchParams(search).get("ref");
  return value?.toUpperCase().startsWith("ALPHA-") ? value.toUpperCase() : null;
}

export default function Shop() {
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const [search, setSearch] = useState("");
  const selectedCategory = categoryFromSearch(searchParams);
  const referralCode = referralFromSearch(searchParams);
  const approvedProducts = trpc.marketplace.publicProducts.useQuery(undefined, { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false });

  useEffect(() => {
    if (referralCode) window.localStorage.setItem("alpha-collective-referral-code", referralCode);
  }, [referralCode]);

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...MARKETPLACE_PRODUCTS, ...(approvedProducts.data ?? [])].filter(product => {
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      const matchesSearch = !query || [product.title, product.category, product.vendor].join(" ").toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [approvedProducts.data, search, selectedCategory]);

  const setCategory = (category: CategoryFilter) => setLocation(category === "All" ? "/shop" : `/shop?category=${category}`);

  return (
    <MarketplaceShell>
      <div className="page-shell">
        <section className="listing-hero">
          <div><span className="eyebrow">The everyday edit</span><h1>More ways to find your next thing.</h1></div>
          <p>Six useful corners of the collective, with prices in Naira and the seller name always in view.</p>
        </section>
        <section className="shop-toolbar" aria-label="Shop filters">
          <div className="category-pills">
            {(["All", ...MARKETPLACE_CATEGORIES] as CategoryFilter[]).map(category => (
              <button key={category} onClick={() => setCategory(category)} className={`category-pill ${selectedCategory === category ? "active" : ""}`}>{category}</button>
            ))}
          </div>
          <label className="search-input" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the collective" style={{ border: 0, outline: 0, background: "transparent", width: "100%" }} />
          </label>
        </section>
        {referralCode ? <div className="application-status"><strong>Referral code saved: {referralCode}</strong><p>It will be offered at checkout for an eligible order from ₦5,000. The code is checked before your KYC-verified Pay on Delivery order is saved.</p></div> : null}
        <div className="shop-results">
          <p className="result-count"><SlidersHorizontal size={12} style={{ display: "inline", marginRight: 5 }} />{products.length} {products.length === 1 ? "find" : "finds"} in view</p>
          {products.length > 0 ? <div className="product-grid">{products.map(product => <ProductCard key={product.id} product={product} />)}</div> : (
            <div className="empty-panel" style={{ marginTop: 22 }}><h2>No matching finds yet.</h2><p>Try another word or return to the full collection.</p><Link href="/shop" className="button button-secondary">See all finds</Link></div>
          )}
        </div>
      </div>
    </MarketplaceShell>
  );
}
