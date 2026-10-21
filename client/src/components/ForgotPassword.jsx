import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config'
import './Auth.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(`${API_BASE_URL}/api/users/forgot-password`, { email });
      setSuccess('Password reset email has been sent. Check your inbox for the reset code.');
      setEmail('');
      setTimeout(() => {
        navigate('/reset-password', { state: { email } });
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-mesh-bg"></div>

      <div className="auth-card">
        <div className="auth-card-header">
          <Link to="/" className="auth-logo">
            <div className="logo-icon-small">
              <i className="fas fa-qrcode"></i>
            </div>
            <span>QR Menu Pro</span>
          </Link>
          <h2>Forgot Password</h2>
          <p>We'll send a reset code to your email</p>
        </div>

        {success && (
          <div className="auth-alert success">
            <i className="fas fa-check-circle"></i>
            {success}
          </div>
        )}

        {error && (
          <div className="auth-alert error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form-modern">
          <div className="auth-input-group">
            <div className="input-wrapper-modern">
              <i className="fas fa-envelope input-icon"></i>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Sending Code...' : 'Send Reset Code'}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>Remember your password? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
