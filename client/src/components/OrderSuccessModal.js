import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SOCKET_URL } from '../config';
import './OrderSuccessModal.css';

const OrderSuccessModal = ({ orders, onClose, restaurantInfo, onClearOrder, menuItems, onQuickOrder }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeOrders, setActiveOrders] = useState(orders);
  const [estimatedTime, setEstimatedTime] = useState(20);
  const [seconds, setSeconds] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Multi-sensory feedback helper
  const triggerHaptic = (pattern = 50) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const currentOrder = activeOrders[selectedIndex];

  useEffect(() => {
    setActiveOrders(orders);
    // If the selected index is now out of bounds, reset to 0
    if (selectedIndex >= orders.length) {
      setSelectedIndex(0);
    }
  }, [orders, selectedIndex]);

  useEffect(() => {
    if (activeOrders.length === 0) return;

    const socket = io(SOCKET_URL);
    // Follow each order with the tracking token it was placed with
    socket.on('connect', () => {
      activeOrders.forEach(o => socket.emit('trackOrder', { orderId: o._id, token: o.trackingToken }));
    });

    socket.on('orderUpdated', (updatedOrder) => {
      const prevOrder = activeOrders.find(o => o._id === updatedOrder._id);

      setActiveOrders(prev =>
        prev.map(o => o._id === updatedOrder._id ? { ...updatedOrder, trackingToken: o.trackingToken } : o)
      );

      // Celebration & Haptics on status change
      if (prevOrder && prevOrder.status !== updatedOrder.status) {
        triggerHaptic(prevOrder.status === 'process' && updatedOrder.status === 'ready' ? [100, 50, 100] : 50);

        if (updatedOrder.status === 'ready' || updatedOrder.status === 'complete') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
        }
      }

      // If it's the current order, update estimated time
      if (currentOrder && updatedOrder._id === currentOrder._id) {
        switch (updatedOrder.status) {
          case 'process':
            setEstimatedTime(15);
            setSeconds(0);
            break;
          case 'complete':
            setEstimatedTime(0);
            setSeconds(0);
            break;
          case 'ready':
            setEstimatedTime(2);
            setSeconds(0);
            break;
          default: setEstimatedTime(20);
        }
      }
    });

    return () => socket.disconnect();
  }, [activeOrders, currentOrder]);

  // Live Ticking Countdown
  useEffect(() => {
    if (estimatedTime <= 0 && seconds <= 0) return;

    const timer = setInterval(() => {
      if (seconds > 0) {
        setSeconds(s => s - 1);
      } else if (estimatedTime > 0) {
        setEstimatedTime(t => t - 1);
        setSeconds(59);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [estimatedTime, seconds]);

  const getStatusStep = (order) => {
    switch (order?.status) {
      case 'pending': return 1;
      case 'process': return 2;
      case 'ready': return 3;
      case 'billed': return 4;
      case 'complete': return 4;
      default: return 1;
    }
  };

  const getStatusMessage = (order) => {
    switch (order?.status) {
      case 'pending': return 'Your order has been received and is waiting to be prepared';
      case 'process': return 'Your order is being prepared by our kitchen staff';
      case 'ready': return 'Your order is ready! It will be served shortly';
      case 'billed': return 'Bill Generated! You can view your digital receipt below';
      case 'complete': return 'Order Completed! Thank you for dining with us';
      case 'cancelled': return 'Your order has been cancelled';
      default: return 'Processing your order';
    }
  };

  const currentStep = getStatusStep(currentOrder);
  const isCancelled = currentOrder?.status === 'cancelled';
  const isComplete = currentOrder?.status === 'complete';
  const isBilled = currentOrder?.status === 'billed';

  const downloadReceipt = async () => {
    const element = document.querySelector('.printable-bill-template');
    if (!element) return;

    element.style.display = 'block';
    element.style.position = 'fixed';
    element.style.left = '-9999px';

    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 380,
        windowHeight: element.scrollHeight
      });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = { width: canvas.width, height: canvas.height };
      const pdfWidth = 80;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt-${currentOrder._id.slice(-6).toUpperCase()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Could not generate receipt.');
    } finally {
      element.style.display = 'none';
      element.style.position = 'absolute';
      element.style.left = '0';
    }
  };

  const handleClose = () => {
    // If current order is finished, remove it from persistence
    if (isComplete || isCancelled) {
      onClearOrder(currentOrder._id);
    }
    onClose();
  };

  if (!currentOrder) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={handleClose}>&times;</button>

        {/* Multi-Order Tabs */}
        {activeOrders.length > 1 && (
          <div className="order-tabs">
            {activeOrders.map((o, idx) => (
              <button
                key={o._id}
                className={`order-tab ${idx === selectedIndex ? 'active' : ''}`}
                onClick={() => setSelectedIndex(idx)}
              >
                Order {idx + 1}
              </button>
            ))}
          </div>
        )}

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
            <h2>Order Tracking</h2>
            <p className="order-id">ID: #{currentOrder._id.slice(-6).toUpperCase()}</p>
          </div>
        )}

        {isCancelled && (
          <div className="cancel-header">
            <div className="cancel-icon">
              <i className="fas fa-times-circle"></i>
            </div>
            <h2>Order Cancelled</h2>
          </div>
        )}

        {/* Order Details Summary */}
        <div className="order-summary">
          <div className="summary-item">
            <span className="label"><i className="fas fa-user"></i> Name</span>
            <span className="value">{currentOrder.customerName}</span>
          </div>
          <div className="summary-item">
            <span className="label"><i className="fas fa-chair"></i> Table</span>
            <span className="value">{currentOrder.tableNumber}</span>
          </div>
        </div>

        {/* Status Timeline */}
        {!isCancelled && (
          <div className="status-timeline">
            <div className={`timeline-item ${currentStep >= 1 ? 'active' : ''}`}>
              <div className="timeline-dot"><i className="fas fa-shopping-cart"></i></div>
              <span className="timeline-text">Received</span>
            </div>
            <div className={`timeline-line ${currentStep >= 2 ? 'active' : ''}`}></div>
            <div className={`timeline-item ${currentStep >= 2 ? 'active' : ''}`}>
              <div className={`timeline-dot ${currentOrder.status === 'process' ? 'preparing' : ''}`}><i className="fas fa-utensils"></i></div>
              <span className="timeline-text">Preparing</span>
            </div>
            <div className={`timeline-line ${currentStep >= 3 ? 'active' : ''}`}></div>
            <div className={`timeline-item ${currentStep >= 3 ? 'active' : ''}`}>
              <div className="timeline-dot"><i className="fas fa-bell"></i></div>
              <span className="timeline-text">Ready</span>
            </div>
            <div className={`timeline-line ${currentStep >= 4 ? 'active' : ''}`}></div>
            <div className={`timeline-item ${currentStep >= 4 ? 'active' : ''}`}>
              <div className="timeline-dot"><i className="fas fa-receipt"></i></div>
              <span className="timeline-text">{isBilled ? 'Billed' : 'Done'}</span>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className={`status-message ${currentOrder.status}`}>
          <p>{getStatusMessage(currentOrder)}</p>
        </div>

        {/* Estimated Time Countdown */}
        {!isCancelled && (estimatedTime > 0 || seconds > 0) && (
          <div className={`countdown-container ${estimatedTime < 2 ? 'imminent' : ''}`}>
            <div className="countdown-timer">
              <i className="fas fa-clock"></i>
              <span className="time-display">
                {String(estimatedTime).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
            <p className="countdown-label">Estimated Service Time</p>
          </div>
        )}

        {/* Confetti Celebration */}
        {showConfetti && (
          <div className="confetti-wrapper">
            {[...Array(20)].map((_, i) => (
              <div key={i} className={`confetti-piece p${i}`}></div>
            ))}
          </div>
        )}

        {/* "While You Wait" - Upsell Carousel */}
        {!isComplete && !isCancelled && menuItems && (
          <div className="quick-add-section">
            <h3 className="section-title">Want something more? ✨</h3>
            <div className="quick-add-carousel">
              {menuItems
                .filter(item => ['Drinks', 'Beverages', 'Desserts', 'Snacks'].includes(item.category))
                .slice(0, 6)
                .map(item => (
                  <div key={item._id} className="quick-add-card" onClick={() => onQuickOrder(item)}>
                    <div className="quick-add-img">
                      <img src={item.image || 'https://via.placeholder.com/100'} alt={item.name} />
                      <div className="quick-add-overlay"><i className="fas fa-plus"></i></div>
                    </div>
                    <span className="quick-item-name">{item.name}</span>
                    <span className="quick-item-price">₹{item.price}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="order-items-scroll">
          <div className="scroll-header">
            <h3>Order Details</h3>
            <span className="item-count">{currentOrder.items.length} Items</span>
          </div>
          {currentOrder.items.map((item, index) => (
            <div key={index} className="item-row">
              <div className="item-info-pill">
                <span className="item-qty">{item.quantity}</span>
                <span className="item-name">{item.menuItemName}</span>
              </div>
              <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="order-total-premium">
            <span>Total Paid</span>
            <span>₹{currentOrder.totalAmount?.toFixed(2) || '0.00'}</span>
          </div>
        </div>

        {/* Feedback Widget (Simple Emoji) */}
        {(isComplete || isBilled) && (
          <div className="feedback-widget">
            <p>How was your experience today?</p>
            <div className="emoji-row">
              <button onClick={() => triggerHaptic(20)}>😍</button>
              <button onClick={() => triggerHaptic(20)}>😊</button>
              <button onClick={() => triggerHaptic(20)}>😐</button>
              <button onClick={() => triggerHaptic(20)}>👎</button>
            </div>
          </div>
        )}

        <div className="modal-actions">
          {isBilled && (
            <button onClick={downloadReceipt} className="action-btn secondary">
              <i className="fas fa-download"></i> Download Receipt
            </button>
          )}
          <button onClick={onClose} className="action-btn primary">Back to Menu</button>
        </div>
      </div>

      {/* DEDICATED PRINTABLE BILL TEMPLATE (Hidden by default) */}
      <div className="printable-bill-template">
        <div className="bill-header">
          <h1>{restaurantInfo?.restaurantName || 'RESTAURANT'}</h1>
          <p className="bill-subtitle">Digital Receipt</p>
          <div className="bill-divider"></div>
        </div>

        <div className="bill-info">
          <p><span>Order ID:</span> <span>#{currentOrder._id.slice(-6).toUpperCase()}</span></p>
          <p><span>Date:</span> <span>{new Date(currentOrder.createdAt).toLocaleString()}</span></p>
          <p><span>Customer:</span> <span>{currentOrder.customerName}</span></p>
          <p><span>Table No:</span> <span>{currentOrder.tableNumber}</span></p>
        </div>

        <div className="bill-divider"></div>

        <table className="bill-table">
          <thead>
            <tr>
              <th className="text-left">Item</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {currentOrder.items.map((item, index) => (
              <tr key={index}>
                <td className="text-left">{item.menuItemName}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">₹{(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bill-divider"></div>

        <div className="bill-total-row">
          <span>Total Amount</span>
          <span>₹{currentOrder.totalAmount?.toFixed(2)}</span>
        </div>

        <div className="bill-footer">
          <p>Thank you for visiting!</p>
          <p>Please come again.</p>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;
