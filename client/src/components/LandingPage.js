import React from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import './LandingPage.css';

const LandingPage = () => {
  const [qrValue, setQrValue] = React.useState('');

  React.useEffect(() => {
    setQrValue(`${window.location.origin}/demo`);
  }, []);

  return (
    <div className="landing-page">
      {/* Hero Section with Mesh Gradient */}
      <section className="hero-section">
        <div className="hero-mesh"></div>
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge animate-fade-in">
              <span className="badge-dot"></span>
              The Future of Dining is Here
            </div>
            <h1 className="hero-title animate-slide-up">
              Elevate Your Restaurant with <span className="text-gradient">Smart Digital Menus</span>
            </h1>
            <p className="hero-subtitle animate-slide-up-delayed">
              Transform your paper menu into a stunning digital experience.
              Increase efficiency and delight your customers with QR Menu Pro.
            </p>
            <div className="hero-cta animate-slide-up-further">
              <Link to="/register" className="btn-hero-primary">
                Launch Your Menu
                <i className="fas fa-arrow-right"></i>
              </Link>
              <Link to="/demo" className="btn-hero-secondary">
                View Interactive Demo
              </Link>
            </div>
          </div>
          <div className="hero-visual animate-float">
            <div className="qr-card-premium">
              <div className="qr-header">
                <i className="fas fa-qrcode"></i>
                <span>SCAN ME</span>
              </div>
              <div className="qr-body">
                {qrValue ? (
                  <QRCode value={qrValue} size={220} fgColor="#2d3436" />
                ) : (
                  <div style={{ width: 220, height: 220, background: '#f0f0f0' }}></div>
                )}
              </div>
              <div className="qr-footer">
                <p>Try it yourself</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Shoutout */}
      <section className="stats-shoutout">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-number">500+</span>
            <span className="stat-label">Restaurants</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">50k+</span>
            <span className="stat-label">Monthly Orders</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">4.9/5</span>
            <span className="stat-label">User Rating</span>
          </div>
        </div>
      </section>

      {/* Modern Features Grid */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Seamless Experience</h2>
            <p className="section-subtitle">Powerful features designed to make your operations smoother.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper color-1">
                <i className="fas fa-magic"></i>
              </div>
              <h3>Instant Updates</h3>
              <p>Change prices or hide sold-out items in real-time. No reprinting costs, ever.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper color-2">
                <i className="fas fa-bolt"></i>
              </div>
              <h3>Order Tracking</h3>
              <p>Manage pending, processing, and ready orders with our intuitive Kanban board.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper color-3">
                <i className="fas fa-chart-line"></i>
              </div>
              <h3>Smart Analytics</h3>
              <p>Gain insights into your most popular dishes and peak ordering hours.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper color-4">
                <i className="fas fa-user-shield"></i>
              </div>
              <h3>Contactless Admin</h3>
              <p>Let your staff focus on service while customers order directly from their phones.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works - Pull Quote Style */}
      <section className="how-it-works-modern">
        <div className="container">
          <h2 className="section-title text-center">Get Live in 3 Easy Steps</h2>
          <div className="modern-steps">
            <div className="modern-step">
              <div className="step-count">01</div>
              <div className="step-info">
                <h3>Sign Up</h3>
                <p>Register your restaurant and define your table layout in seconds.</p>
              </div>
            </div>
            <div className="modern-step">
              <div className="step-count">02</div>
              <div className="step-info">
                <h3>Build Menu</h3>
                <p>Add categories and dishes with beautiful images and clear pricing.</p>
              </div>
            </div>
            <div className="modern-step">
              <div className="step-count">03</div>
              <div className="step-info">
                <h3>Print QR</h3>
                <p>Download your unique QR codes and place them on your dining tables.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action with Mesh */}
      <section className="cta-modern">
        <div className="cta-overlay-mesh"></div>
        <div className="container">
          <div className="cta-content">
            <h2>Ready to transform your dining?</h2>
            <p>Join the digital revolution and give your customers a premium experience.</p>
            <Link to="/register" className="btn-hero-primary">Start Free Trial</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;