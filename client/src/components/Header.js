import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  // Don't show header on customer menu pages
  const isCustomerPage = location.pathname.startsWith('/menu/');
  if (isCustomerPage) {
    return null;
  }

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <Link to="/" className="logo">
          <div className="logo-icon">
            <i className="fas fa-qrcode"></i>
          </div>
          <span className="logo-text">QR Menu<span className="text-primary"> Pro</span></span>
        </Link>

        <div className="nav-wrapper">
          <nav className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            {isLoggedIn ? (
              <>
                <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`} onClick={() => setIsMobileMenuOpen(false)}>
                  Dashboard
                </Link>
                <Link to="/orders" className={`nav-link ${isActive('/orders')}`} onClick={() => setIsMobileMenuOpen(false)}>
                  Orders
                </Link>
                <Link to="/profile" className={`nav-link ${isActive('/profile')}`} onClick={() => setIsMobileMenuOpen(false)}>
                  Profile
                </Link>
                <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="header-btn secondary">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={`nav-link ${isActive('/login')}`} onClick={() => setIsMobileMenuOpen(false)}>
                  Login
                </Link>
                <Link to="/register" className="header-btn primary" onClick={() => setIsMobileMenuOpen(false)}>
                  Get Started
                </Link>
              </>
            )}
          </nav>

          <button
            className={`menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className="hamburger"></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;