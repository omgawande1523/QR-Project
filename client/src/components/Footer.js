import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-grid">
                    <div className="footer-brand">
                        <Link to="/" className="footer-logo">
                            <i className="fas fa-qrcode"></i>
                            QR Menu Pro
                        </Link>
                        <p className="footer-tagline">
                            Transforming dining experiences with smart, contactless digital menus.
                        </p>
                        <div className="social-links">
                            <a href="#" className="social-link"><i className="fab fa-instagram"></i></a>
                            <a href="#" className="social-link"><i className="fab fa-twitter"></i></a>
                            <a href="#" className="social-link"><i className="fab fa-facebook"></i></a>
                            <a href="#" className="social-link"><i className="fab fa-linkedin"></i></a>
                        </div>
                    </div>

                    <div className="footer-links">
                        <h3>Product</h3>
                        <ul>
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/features">Features</Link></li>
                            <li><Link to="/demo">Demo Menu</Link></li>
                            <li><Link to="/pricing">Pricing</Link></li>
                        </ul>
                    </div>

                    <div className="footer-links">
                        <h3>Support</h3>
                        <ul>
                            <li><Link to="/help">Help Center</Link></li>
                            <li><Link to="/contact">Contact Us</Link></li>
                            <li><Link to="/privacy">Privacy Policy</Link></li>
                            <li><Link to="/terms">Terms of Service</Link></li>
                        </ul>
                    </div>

                    <div className="footer-contact">
                        <h3>Contact</h3>
                        <p><i className="fas fa-envelope"></i> pkvbspu2020@gmail.com</p>
                        <p><i className="fas fa-phone"></i> +91 63938 85191</p>
                        <p><i className="fas fa-map-marker-alt"></i> India</p>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {currentYear} QR Menu Pro. All rights reserved.</p>
                    <div className="footer-bottom-links">
                        <span>Made with <i className="fas fa-heart text-danger"></i> for Restaurants</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
