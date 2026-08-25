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
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
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
      <Route path="/admin/products" component={AdminProductReview} />
      <Route path="/admin/wallet-orders" component={AdminWalletOrders} />
      <Route path="/admin/official-products" component={AdminOfficialProducts} />
      <Route path="/admin/dropship-integrations" component={DropshipIntegrations} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <CartProvider>
            <Toaster />
            <Router />
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
