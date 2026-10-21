import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { ToastProvider, Spinner } from './components/ui';

// Every screen is a separate chunk: a scanned QR code downloads only what the customer menu needs.
const LandingPage = lazy(() => import('./features/landing/LandingPage'));
const DemoRedirect = lazy(() => import('./features/landing/DemoRedirect'));
const NotFound = lazy(() => import('./features/landing/NotFound'));

// Owner sign-in
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));

// Owner dashboard
const OwnerLayout = lazy(() => import('./features/owner/OwnerLayout'));
const DashboardHome = lazy(() => import('./features/owner/DashboardHome'));
const OrdersBoard = lazy(() => import('./features/owner/OrdersBoard'));
const MenuManager = lazy(() => import('./features/owner/MenuManager'));
const TablesPage = lazy(() => import('./features/owner/TablesPage'));
const SettingsPage = lazy(() => import('./features/owner/SettingsPage'));
const KitchenScreen = lazy(() => import('./features/kitchen/KitchenScreen'));

// Customer (opened by scanning a table QR code)
const CustomerApp = lazy(() => import('./features/customer/CustomerApp'));
const WelcomeScreen = lazy(() => import('./features/customer/WelcomeScreen'));
const MenuScreen = lazy(() => import('./features/customer/MenuScreen'));
const ItemDetailScreen = lazy(() => import('./features/customer/ItemDetailScreen'));
const CartScreen = lazy(() => import('./features/customer/CartScreen'));
const OrdersScreen = lazy(() => import('./features/customer/OrdersScreen'));
const OrderTrackingScreen = lazy(() => import('./features/customer/OrderTrackingScreen'));

function PageLoader() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--olive-700)' }}>
      <Spinner />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/demo" element={<DemoRedirect />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/dashboard" element={<OwnerLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="orders" element={<OrdersBoard />} />
              <Route path="menu" element={<MenuManager />} />
              <Route path="tables" element={<TablesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="/kitchen" element={<KitchenScreen />} />
            {/* Paths used by the previous version of the app */}
            <Route path="/orders" element={<Navigate to="/dashboard/orders" replace />} />
            <Route path="/profile" element={<Navigate to="/dashboard/settings" replace />} />

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
