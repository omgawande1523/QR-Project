import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/Dashboard';
import Menu from './components/Menu';
import Order from './components/Order';
import Demo from './components/Demo';
import Profile from './components/Profile';
import './App.css';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function AppContent() {
  const location = useLocation();
  const isCustomerMenu = location.pathname.startsWith('/menu/') || location.pathname.startsWith('/order/');

  return (
    <div className="App">
      {!isCustomerMenu && <Header />}
      <div className="main-content">
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
          <Route path="/order/:userId" element={<Order />} />
          <Route path="/demo" element={<div className="page-wrapper"><Demo /></div>} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;