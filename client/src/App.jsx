import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { ToastProvider } from './components/ui';
import { PageLoader } from './components/PageLoader';
import { staffRoutes } from './staffRoutes';

// The website. Every screen is a separate chunk: a scanned QR code downloads only what the customer menu
// needs. The sign-in and staff screens come from staffRoutes.jsx, shared with the staff app.
const LandingPage = lazy(() => import('./features/landing/LandingPage'));
const DemoRedirect = lazy(() => import('./features/landing/DemoRedirect'));
const NotFound = lazy(() => import('./features/landing/NotFound'));
const PrivacyPage = lazy(() => import('./features/landing/PrivacyPage'));
const DeleteAccountPage = lazy(() => import('./features/landing/DeleteAccountPage'));

// Customer (opened by scanning a table QR code)
const CustomerApp = lazy(() => import('./features/customer/CustomerApp'));
const MenuLauncher = lazy(() => import('./features/customer/CustomerApp').then((m) => ({ default: m.MenuLauncher })));
const WelcomeScreen = lazy(() => import('./features/customer/WelcomeScreen'));
const MenuScreen = lazy(() => import('./features/customer/MenuScreen'));
const ItemDetailScreen = lazy(() => import('./features/customer/ItemDetailScreen'));
const CartScreen = lazy(() => import('./features/customer/CartScreen'));
const OrdersScreen = lazy(() => import('./features/customer/OrdersScreen'));
const OrderTrackingScreen = lazy(() => import('./features/customer/OrderTrackingScreen'));

function App() {
  return (
    <ToastProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/demo" element={<DemoRedirect />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/delete-account" element={<DeleteAccountPage />} />

            {staffRoutes()}

            <Route path="/menu" element={<MenuLauncher />} />
            <Route path="/menu/:restaurantId" element={<CustomerApp />}>
              <Route index element={<WelcomeScreen />} />
              <Route path="browse" element={<MenuScreen />} />
              <Route path="item/:itemId" element={<ItemDetailScreen />} />
              <Route path="cart" element={<CartScreen />} />
              <Route path="orders" element={<OrdersScreen />} />
              <Route path="orders/:orderId" element={<OrderTrackingScreen />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </ToastProvider>
  );
}

export default App;
