import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import './Auth.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    token: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    // Get token and email from URL params or navigation state
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (token && email) {
      setFormData(prev => ({
        ...prev,
        token,
        email
      }));
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email) {
      setError('Email is required');
      return;
    }

    if (!formData.token) {
      setError('Reset code is required');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_BASE_URL}/api/users/reset-password`, {
        email: formData.email,
        token: formData.token,
        newPassword: formData.newPassword
      });

      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
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
          <h2>Reset Password</h2>
          <p>Enter your reset code and new password</p>
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
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <div className="input-wrapper-modern">
              <i className="fas fa-key input-icon"></i>
              <input
                type="text"
                name="token"
                placeholder="6-Digit Reset Code"
                value={formData.token}
                onChange={handleChange}
                required
                disabled={loading}
                maxLength="6"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <small className="auth-helper-text">Check your email for the code</small>
          </div>

          <div className="auth-input-group">
            <div className="input-wrapper-modern">
              <i className="fas fa-lock input-icon"></i>
              <input
                type={showPassword ? 'text' : 'password'}
                name="newPassword"
                placeholder="New Password"
                value={formData.newPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <div className="input-wrapper-modern">
              <i className="fas fa-lock input-icon"></i>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Confirm New Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-options">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={loading}
              />
              <span>Show passwords</span>
            </label>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Resetting...' : 'Update Password'}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>Suddenly remembered? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
