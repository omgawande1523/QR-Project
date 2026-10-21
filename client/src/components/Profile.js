import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config'
import './Auth.css';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    restaurantName: '',
    email: '',
    tables: '',
    profilePicture: '',
    bannerImage: ''
  });
  const [passwordChange, setPasswordChange] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleImageUpload = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 1MB per image)
      if (file.size > 1024 * 1024) {
        setError('Image size should be less than 1MB. Please compress the image.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        // Compress image using canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Reduce size if too large
          const maxWidth = fieldName === 'profilePicture' ? 300 : 1000;
          const maxHeight = fieldName === 'profilePicture' ? 300 : 400;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round(height * maxWidth / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round(width * maxHeight / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with quality 0.7
          const compressedImage = canvas.toDataURL('image/jpeg', 0.7);
          setFormData({ ...formData, [fieldName]: compressedImage });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_BASE_URL}/api/users/${userId}`, { headers });
      setRestaurantInfo(response.data);
      setFormData({
        restaurantName: response.data.restaurantName || '',
        email: response.data.email || '',
        tables: (response.data.tables || []).join(', '),
        profilePicture: response.data.profilePicture || '',
        bannerImage: response.data.bannerImage || ''
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (!formData.restaurantName || !formData.restaurantName.trim()) {
        setError('Restaurant name is required');
        setSaving(false);
        return;
      }

      const tablesArray = formData.tables
        .split(',')
        .map(num => parseInt(num.trim()))
        .filter(num => !isNaN(num));

      const updateData = {
        restaurantName: formData.restaurantName,
        tables: tablesArray,
        profilePicture: formData.profilePicture || '',
        bannerImage: formData.bannerImage || ''
      };

      const response = await axios.put(`${API_BASE_URL}/api/users/${userId}`, updateData, { headers });
      setRestaurantInfo(response.data);
      setSuccess('Profile updated successfully!');
      setEditMode(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      setError('Passwords do not match');
      setSaving(false);
      return;
    }

    if (passwordChange.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setSaving(false);
      return;
    }

    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_BASE_URL}/api/users/${userId}/change-password`, {
        currentPassword: passwordChange.currentPassword,
        newPassword: passwordChange.newPassword
      }, { headers });

      setSuccess('Password changed successfully!');
      setPasswordChange({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/');
  };

  if (loading) {
    return <div className="auth-container"><p>Loading...</p></div>;
  }

  return (
    <div className="auth-container" style={{ maxWidth: '800px' }}>
      <h2>My Restaurant Profile</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Restaurant Info Section */}
      <div style={{
        backgroundColor: '#f9f9f9',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3>Restaurant Information</h3>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="button"
              style={{ backgroundColor: '#2196F3', padding: '8px 16px' }}
            >
              Edit
            </button>
          )}
        </div>

        {editMode ? (
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label>Restaurant Name</label>
              <input
                type="text"
                value={formData.restaurantName}
                onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Email (Read-only)</label>
              <input
                type="email"
                value={formData.email}
                disabled
                style={{ backgroundColor: '#e0e0e0', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label>Table Numbers (comma-separated)</label>
              <input
                type="text"
                placeholder="1, 2, 3, 4..."
                value={formData.tables}
                onChange={(e) => setFormData({ ...formData, tables: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Profile Picture</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'profilePicture')}
                style={{ display: 'block', marginBottom: '10px' }}
              />
              {formData.profilePicture && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#666' }}>Preview:</p>
                  <img src={formData.profilePicture} alt="Profile preview" style={{ maxWidth: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px' }} />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Banner Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'bannerImage')}
                style={{ display: 'block', marginBottom: '10px' }}
              />
              {formData.bannerImage && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#666' }}>Preview:</p>
                  <img src={formData.bannerImage} alt="Banner preview" style={{ maxWidth: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                className="button"
                disabled={saving}
                style={{ backgroundColor: '#4CAF50' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setEditMode(false)}
                style={{ backgroundColor: '#f44336' }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p><strong>Restaurant Name:</strong> {restaurantInfo?.restaurantName || 'N/A'}</p>
            <p><strong>Email:</strong> {restaurantInfo?.email || 'N/A'}</p>
            <p><strong>Tables:</strong> {restaurantInfo?.tables?.join(', ') || 'N/A'}</p>
            {restaurantInfo?.profilePicture && (
              <div style={{ marginTop: '15px' }}>
                <p><strong>Profile Picture:</strong></p>
                <img src={restaurantInfo.profilePicture} alt="Profile" style={{ maxWidth: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
            )}
            {restaurantInfo?.bannerImage && (
              <div style={{ marginTop: '15px' }}>
                <p><strong>Banner Image:</strong></p>
                <img src={restaurantInfo.bannerImage} alt="Banner" style={{ maxWidth: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change Password Section */}
      <div style={{
        backgroundColor: '#f9f9f9',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={passwordChange.currentPassword}
              onChange={(e) => setPasswordChange({ ...passwordChange, currentPassword: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={passwordChange.newPassword}
              onChange={(e) => setPasswordChange({ ...passwordChange, newPassword: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={passwordChange.confirmPassword}
              onChange={(e) => setPasswordChange({ ...passwordChange, confirmPassword: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            className="button"
            disabled={saving}
            style={{ backgroundColor: '#FF9800' }}
          >
            {saving ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Logout Section */}
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button
          onClick={handleLogout}
          className="button"
          style={{ backgroundColor: '#f44336', padding: '12px 30px' }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;
