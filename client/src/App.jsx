import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import { ToastProvider, Spinner } from './components/ui';
import { isLoggedIn } from './lib/session';
import './App.css';

// Old pages (replaced during the redesign) are lazy so their global CSS only loads on those pages.
const LandingPage = lazy(() => import('./components/LandingPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Demo = lazy(() => import('./components/Demo'));
const Profile = lazy(() => import('./components/Profile'));

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

// Customer screens load separately so a scanned QR code downloads only what the menu needs.
const CustomerApp = lazy(() => import('./features/customer/CustomerApp'));
const WelcomeScreen = lazy(() => import('./features/customer/WelcomeScreen'));
const MenuScreen = lazy(() => import('./features/customer/MenuScreen'));
const ItemDetailScreen = lazy(() => import('./features/customer/ItemDetailScreen'));
const CartScreen = lazy(() => import('./features/customer/CartScreen'));
const OrdersScreen = lazy(() => import('./features/customer/OrdersScreen'));
const OrderTrackingScreen = lazy(() => import('./features/customer/OrderTrackingScreen'));

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function PageLoader() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--olive-700)' }}>
      <Spinner />
    </div>
  );
}

// Header and footer of the pre-redesign pages that have not been replaced yet.
function LegacyLayout() {
  return (
    <div className="App">
      <Header />
      <div className="main-content">
        <div className="page-wrapper"><Outlet /></div>
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<LegacyLayout />}>
              <Route path="/" element={<LandingPage />} />
              {/* Old dashboard: menu, tables and settings until their new screens land */}
              <Route path="/dashboard/classic" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/demo" element={<Demo />} />
            </Route>

            <Route path="/dashboard" element={<OwnerLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="orders" element={<OrdersBoard />} />
              <Route path="menu" element={<MenuManager />} />
              <Route path="tables" element={<Navigate to="/dashboard/classic" replace />} />
              <Route path="settings" element={<Navigate to="/profile" replace />} />
            </Route>
            <Route path="/orders" element={<Navigate to="/dashboard/orders" replace />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/menu/:restaurantId" element={<CustomerApp />}>
              <Route index element={<WelcomeScreen />} />
              <Route path="browse" element={<MenuScreen />} />
              <Route path="item/:itemId" element={<ItemDetailScreen />} />
              <Route path="cart" element={<CartScreen />} />
              <Route path="orders" element={<OrdersScreen />} />
              <Route path="orders/:orderId" element={<OrderTrackingScreen />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </ToastProvider>
  );
}

export default App;
