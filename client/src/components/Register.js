import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    phoneNumber: '',
    password: '',
    restaurantName: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (!formData.email || !formData.password || !formData.restaurantName) {
        setError('All fields are required');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }

      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      const requestData = {
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password,
        restaurantName: formData.restaurantName.trim()
      };

      const response = await axios.post(`${API_BASE_URL}/api/users/register`, requestData);

      if (response.data && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('userId', response.data.userId);
        navigate('/dashboard');
      } else if (response.data) {
        navigate('/login', {
          state: { message: 'Registration successful! Please login.' }
        });
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-mesh-bg"></div>

      <div className="auth-card wide">
        <div className="auth-card-header">
          <Link to="/" className="auth-logo">
            <div className="logo-icon-small">
              <i className="fas fa-qrcode"></i>
            </div>
            <span>QR Menu Pro</span>
          </Link>
          <h2>Register Restaurant</h2>
          <p>Get started with your digital menu today</p>
        </div>

        {error && (
          <div className="auth-alert error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form-modern">
          <div className="auth-grid">
            <div className="auth-input-group">
              <div className="input-wrapper-modern">
                <i className="fas fa-store input-icon"></i>
                <input
                  type="text"
                  placeholder="Restaurant Name"
                  value={formData.restaurantName}
                  onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <div className="input-wrapper-modern">
                <i className="fas fa-envelope input-icon"></i>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <div className="input-wrapper-modern">
                <i className="fas fa-phone input-icon"></i>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <div className="input-wrapper-modern">
                <i className="fas fa-lock input-icon"></i>
                <input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn">
            Create Account
          </button>
        </form>

        <div className="auth-card-footer">
          <p>Already have an account? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;