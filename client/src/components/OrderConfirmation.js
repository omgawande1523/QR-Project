import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import API_BASE_URL, { SOCKET_URL } from '../config';
import './OrderConfirmation.css';

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(20);

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (!order) return;

    // Connect to WebSocket for real-time updates
    const socket = io(SOCKET_URL);
    socket.emit('join', order.restaurantId);
    
    socket.on('orderUpdated', (updatedOrder) => {
      if (updatedOrder._id === orderId) {
        setOrder(updatedOrder);
        // Update estimated time based on status
        switch(updatedOrder.status) {
          case 'process':
            setEstimatedTime(15);
            break;
          case 'complete':
            setEstimatedTime(0);
            break;
          default:
            setEstimatedTime(20);
        }
      }
    });

    return () => socket.disconnect();
  }, [order, orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/orders/${orderId}`);
      setOrder(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching order:', error);
      setError('Failed to load order details');
      setLoading(false);
    }
  };

  const getStatusStep = () => {
    switch(order?.status) {
      case 'pending':
        return 1;
      case 'process':
        return 2;
      case 'complete':
        return 3;
      default:
        return 1;
    }
  };

  const getStatusMessage = () => {
    switch(order?.status) {
      case 'pending':
        return 'Your order has been received and is waiting to be prepared';
      case 'process':
        return 'Your order is being prepared by our kitchen staff';
      case 'complete':
        return 'Your order is ready! It will be served to your table shortly';
      case 'cancelled':
        return 'Your order has been cancelled';
      default:
        return 'Processing your order';
    }
  };

  if (loading) {
    return (
      <div className="confirmation-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="confirmation-container">
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error || 'Order not found'}</p>
          <button onClick={() => navigate('/')} className="back-btn">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const currentStep = getStatusStep();
  const isCancelled = order.status === 'cancelled';
  const isComplete = order.status === 'complete';

  return (
    <div className="confirmation-container">
      <div className="confirmation-card">
        {/* Success Header */}
        {!isCancelled && (
          <div className="success-header">
            {isComplete ? (
              <div className="success-icon completed">
                <i className="fas fa-check"></i>
              </div>
            ) : (
              <div className="success-icon">
                <i className="fas fa-check-circle"></i>
              </div>
            )}
            <h1>Order Confirmed!</h1>
            <p className="order-id">Order #{order._id.slice(-8).toUpperCase()}</p>
          </div>
        )}

        {isCancelled && (
          <div className="cancel-header">
            <div className="cancel-icon">
              <i className="fas fa-times-circle"></i>
            </div>
            <h1>Order Cancelled</h1>
          </div>
        )}

        {/* Order Details Summary */}
        <div className="order-summary">
          <div className="summary-item">
            <span className="label">
              <i className="fas fa-user"></i> Customer
            </span>
            <span className="value">{order.customerName}</span>
          </div>
          <div className="summary-item">
            <span className="label">
              <i className="fas fa-chair"></i> Table
            </span>
            <span className="value">#{order.tableNumber}</span>
          </div>
          <div className="summary-item">
            <span className="label">
              <i className="fas fa-clock"></i> Time
            </span>
            <span className="value">
              {new Date(order.createdAt || Date.now()).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Order Status Timeline */}
        {!isCancelled && (
          <div className="status-timeline">
            <div className={`timeline-item ${currentStep >= 1 ? 'active' : ''}`}>
              <div className="timeline-number">
                <i className="fas fa-shopping-cart"></i>
              </div>
              <div className="timeline-label">
                <p className="step-title">Order Received</p>
              </div>
            </div>

            <div className="timeline-connector" style={{ opacity: currentStep >= 2 ? 1 : 0.3 }}>
              <div className="line"></div>
            </div>

            <div className={`timeline-item ${currentStep >= 2 ? 'active' : ''}`}>
              <div className="timeline-number">
                <i className="fas fa-utensils"></i>
              </div>
              <div className="timeline-label">
                <p className="step-title">Being Prepared</p>
              </div>
            </div>

            <div className="timeline-connector" style={{ opacity: currentStep >= 3 ? 1 : 0.3 }}>
              <div className="line"></div>
            </div>

            <div className={`timeline-item ${currentStep >= 3 ? 'active' : ''}`}>
              <div className="timeline-number">
                <i className="fas fa-check"></i>
              </div>
              <div className="timeline-label">
                <p className="step-title">Ready to Serve</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className={`status-message ${order.status}`}>
          <i className={`fas fa-${order.status === 'complete' ? 'thumbs-up' : order.status === 'cancelled' ? 'ban' : 'hourglass-half'}`}></i>
          <p>{getStatusMessage()}</p>
        </div>

        {/* Estimated Time */}
        {!isCancelled && estimatedTime > 0 && (
          <div className="estimated-time">
            <div className="time-display">
              <span className="time">{estimatedTime}</span>
              <span className="unit">mins</span>
            </div>
            <p>Estimated time for your order</p>
          </div>
        )}

        {isComplete && (
          <div className="complete-message">
            <i className="fas fa-bell"></i>
            <p>Your order has been placed on your table. Enjoy your meal!</p>
          </div>
        )}

        {/* Order Items */}
        <div className="order-items-section">
          <h3>Order Items</h3>
          <div className="items-list">
            {order.items.map((item, index) => (
              <div key={index} className="item-row">
                <div className="item-details">
                  <span className="item-name">{item.menuItemName}</span>
                  <span className="item-quantity">× {item.quantity}</span>
                </div>
                <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="order-total">
            <span className="total-label">Total Amount</span>
            <span className="total-value">₹{order.totalAmount?.toFixed(2) || '0.00'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="confirmation-actions">
          <button 
            onClick={() => navigate(`/menu/${order.restaurantId}`)}
            className="action-btn secondary"
          >
            <i className="fas fa-shopping-cart"></i> Order More
          </button>
          <button 
            onClick={() => navigate('/')}
            className="action-btn primary"
          >
            <i className="fas fa-home"></i> Back to Home
          </button>
        </div>

        {/* Footer Note */}
        <div className="confirmation-footer">
          <p>Your order status updates will appear above. Staff will bring your order to Table #{order.tableNumber}</p>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
