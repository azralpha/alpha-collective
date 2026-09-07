import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Cart from "@/pages/Cart";
import AdminProductReview from "@/pages/AdminProductReview";
import AdminWalletOrders from "@/pages/AdminWalletOrders";
import AdminOfficialProducts from "@/pages/AdminOfficialProducts";
import Checkout from "@/pages/Checkout";
import Home from "@/pages/Home";
import KycVerification from "@/pages/KycVerification";
import DropshipIntegrations from "@/pages/DropshipIntegrations";
import NotFound from "@/pages/NotFound";
import Product from "@/pages/Product";
import Sell from "@/pages/Sell";
import Shop from "@/pages/Shop";
import VendorDashboard from "@/pages/VendorDashboard";
import Wallet from "@/pages/Wallet";
import Rewards from "@/pages/Rewards";
import Legal from "@/pages/Legal";
import AdminTieredCartRewards from "@/pages/AdminTieredCartRewards";
import AdminNewsletter from "@/pages/AdminNewsletter";
import CookieConsent from "@/components/CookieConsent";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { startLogin } from "@/const";
import { useEffect } from "react";
import { CartProvider } from "./contexts/CartContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/product/:id" component={Product} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/sell" component={Sell} />
      <Route path="/vendor/dashboard" component={VendorDashboard} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/rewards" component={Rewards} />
      <Route path="/kyc" component={KycVerification} />
      <Route path="/terms-of-use"><Legal kind="terms" /></Route>
      <Route path="/privacy-policy"><Legal kind="privacy" /></Route>
      <Route path="/admin/products" component={AdminProductReview} />
      <Route path="/admin/wallet-orders" component={AdminWalletOrders} />
      <Route path="/admin/official-products" component={AdminOfficialProducts} />
      <Route path="/admin/dropship-integrations" component={DropshipIntegrations} />
      <Route path="/admin/rewards" component={AdminTieredCartRewards} />
      <Route path="/admin/newsletter" component={AdminNewsletter} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function OAuthHandoffResume() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauthHandoff") !== "1") return;

    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
    const timer = window.setTimeout(() => startLogin(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <CartProvider>
            <Toaster />
            <CookieConsent />
            <OAuthHandoffResume />
            <Router />
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
