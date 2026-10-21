import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import { ToastProvider, Spinner } from './components/ui';
import './App.css';

const LandingPage = lazy(() => import('./components/LandingPage'));
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Order = lazy(() => import('./components/Order'));
const Demo = lazy(() => import('./components/Demo'));
const Profile = lazy(() => import('./components/Profile'));

// Old pages (replaced during the redesign) are lazy so their global CSS only loads on those pages.
// Customer screens load separately so a scanned QR code downloads only what the menu needs.
const CustomerApp = lazy(() => import('./features/customer/CustomerApp'));
const WelcomeScreen = lazy(() => import('./features/customer/WelcomeScreen'));
const MenuScreen = lazy(() => import('./features/customer/MenuScreen'));
const ItemDetailScreen = lazy(() => import('./features/customer/ItemDetailScreen'));
const CartScreen = lazy(() => import('./features/customer/CartScreen'));
const OrdersScreen = lazy(() => import('./features/customer/OrdersScreen'));
const OrderTrackingScreen = lazy(() => import('./features/customer/OrderTrackingScreen'));

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function PageLoader() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--olive-700)' }}>
      <Spinner />
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const isCustomerMenu = location.pathname.startsWith('/menu/');

  return (
    <div className="App">
      {!isCustomerMenu && <Header />}
      <div className="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<div className="page-wrapper"><LandingPage /></div>} />
            <Route path="/login" element={<div className="page-wrapper"><Login /></div>} />
            <Route path="/register" element={<div className="page-wrapper"><Register /></div>} />
            <Route path="/forgot-password" element={<div className="page-wrapper"><ForgotPassword /></div>} />
            <Route path="/reset-password" element={<div className="page-wrapper"><ResetPassword /></div>} />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <div className="page-wrapper"><Dashboard /></div>
              </PrivateRoute>
            } />
            <Route path="/profile" element={
              <PrivateRoute>
                <div className="page-wrapper"><Profile /></div>
              </PrivateRoute>
            } />
            <Route path="/orders" element={
              <PrivateRoute>
                <div className="page-wrapper"><Order /></div>
              </PrivateRoute>
            } />
            <Route path="/menu/:restaurantId" element={<CustomerApp />}>
              <Route index element={<WelcomeScreen />} />
              <Route path="browse" element={<MenuScreen />} />
              <Route path="item/:itemId" element={<ItemDetailScreen />} />
              <Route path="cart" element={<CartScreen />} />
              <Route path="orders" element={<OrdersScreen />} />
              <Route path="orders/:orderId" element={<OrderTrackingScreen />} />
            </Route>
            <Route path="/demo" element={<div className="page-wrapper"><Demo /></div>} />
          </Routes>
        </Suspense>
      </div>
      {!isCustomerMenu && <Footer />}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <Router>
        <AppContent />
      </Router>
    </ToastProvider>
  );
}

export default App;
