import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const location = useLocation();
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });


  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/users/login`, {
        identifier: formData.identifier,
        password: formData.password
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userId', response.data.userId);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
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
          <h2>Welcome Back</h2>
          <p>Login to your restaurant dashboard</p>
        </div>

        {successMessage && (
          <div className="auth-alert success">
            <i className="fas fa-check-circle"></i>
            {successMessage}
          </div>
        )}

        {error && (
          <div className="auth-alert error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form-modern">
          <div className="auth-input-group">
            <div className="input-wrapper-modern">
              <i className="fas fa-user input-icon"></i>
              <input
                type="text"
                name="identifier"
                placeholder="Email or Phone Number"
                value={formData.identifier}
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
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="auth-extra">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login to Dashboard'}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>Don't have an account? <Link to="/register">Create one now</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;