import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/Dashboard';
const Menu = lazy(() => import('./components/Menu')); // old menu, replaced next; lazy so its global CSS stays out
import Order from './components/Order';
import Demo from './components/Demo';
import Profile from './components/Profile';
import { ToastProvider, Spinner } from './components/ui';
import './App.css';

// Customer screens load separately so a scanned QR code downloads only what the menu needs.
const CustomerApp = lazy(() => import('./features/customer/CustomerApp'));
const ItemDetailScreen = lazy(() => import('./features/customer/ItemDetailScreen'));

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
  const isCustomerMenu = location.pathname.startsWith('/menu/') || location.pathname.startsWith('/order/');

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
            <Route path="/menu/:userId" element={<Menu />} />
            <Route path="/menu/:restaurantId" element={<CustomerApp />}>
              <Route path="item/:itemId" element={<ItemDetailScreen />} />
            </Route>
            <Route path="/order/:userId" element={<Order />} />
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
