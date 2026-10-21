import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import OrderSuccessModal from './OrderSuccessModal';
import API_BASE_URL, { SOCKET_URL } from '../config';
import './Menu.css';

const Menu = () => {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [itemDetail, setItemDetail] = useState(null);
  const [specialNote, setSpecialNote] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [serviceConfirmation, setServiceConfirmation] = useState(null);

  // Multi-sensory feedback helper
  const triggerHaptic = (pattern = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // Parallax and Scroll Effects
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const progress = Math.min(scrollY / 150, 1);
      setScrollProgress(progress);
      setShowBackToTop(scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for Active Category
  useEffect(() => {
    if (loading || menuItems.length === 0) return;

    const options = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveCategory(entry.target.id.replace('section-', ''));
        }
      });
    }, options);

    const sections = document.querySelectorAll('.category-section');
    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, [loading, menuItems, searchQuery]);

  const scrollToSection = (category) => {
    if (category === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(`section-${category}`);
    if (element) {
      const offset = 140; // Adjust based on sticky header height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);
    s.emit('join', userId);

    s.on('menuUpdated', (updatedItem) => {
      setMenuItems(prevItems =>
        prevItems.map(item => item._id === updatedItem._id ? updatedItem : item)
      );
    });

    s.on('orderUpdated', (updatedOrder) => {
      setActiveOrders(prevOrders =>
        prevOrders.map(order => order._id === updatedOrder._id ? updatedOrder : order)
      );
    });

    return () => s.disconnect();
  }, [userId]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      const [menuResponse, restaurantResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/menu/${userId}`),
        axios.get(`${API_BASE_URL}/api/users/${userId}/public`)
      ]);

      setMenuItems(menuResponse.data);
      setRestaurantInfo(restaurantResponse.data);

      const uniqueCategories = [...new Set(menuResponse.data.map(item => item.category))].filter(Boolean);
      setCategories(uniqueCategories);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching menu:', error);
      setError(error.response?.data?.message || 'Failed to load menu. Please check the restaurant ID or try again later.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    const params = new URLSearchParams(location.search);
    const table = params.get('table');
    if (table) {
      setTableNumber(table);
      localStorage.setItem('tableNumber', table);

      // Record scan analytics
      const hasScannedThisSession = sessionStorage.getItem(`scanned_t${table}_${userId}`);
      if (!hasScannedThisSession) {
        axios.post(`${API_BASE_URL}/api/users/${userId}/scan/${table}`)
          .then(() => {
            sessionStorage.setItem(`scanned_t${table}_${userId}`, 'true');
          })
          .catch(err => console.error('Failed to record scan:', err));
      }
    } else {
      const savedTable = localStorage.getItem('tableNumber');
      if (savedTable) setTableNumber(savedTable);
    }

    // Check for saved customer name
    const savedName = localStorage.getItem('customerName');
    if (savedName) setCustomerName(savedName);

    // Check for active orders in localStorage
    const savedOrderIds = JSON.parse(localStorage.getItem('activeOrderIds') || '[]');
    if (savedOrderIds.length > 0) {
      fetchActiveOrders(savedOrderIds);
    }
  }, [userId, location]);

  const fetchActiveOrders = async (orderIds) => {
    try {
      const orders = await Promise.all(
        orderIds.map(id => axios.get(`${API_BASE_URL}/api/orders/status/${id}`).then(res => res.data))
      );
      const liveOrders = orders.filter(order => order && order.status !== 'complete' && order.status !== 'cancelled');
      setActiveOrders(liveOrders);

      // Update storage with only live orders
      localStorage.setItem('activeOrderIds', JSON.stringify(liveOrders.map(o => o._id)));

      if (liveOrders.length > 0) {
        setShowOrderModal(false); // keep it minimized on refresh
      }
    } catch (error) {
      console.error('Error fetching active orders:', error);
    }
  };

  const addToCart = (item, event = null, notes = '') => {
    triggerHaptic(15);
    setCart([...cart, { ...item, notes }]);

    if (event) {
      triggerFlyAnimation(event);
    }

    // Reset special note if adding from modal
    setSpecialNote('');
    setItemDetail(null);
  };

  const triggerFlyAnimation = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const cartBtn = document.querySelector('.floating-cart-bar');

    if (!cartBtn) return;

    const cartRect = cartBtn.getBoundingClientRect();

    const flyer = document.createElement('div');
    flyer.className = 'flyer-dot';
    flyer.style.left = `${rect.left + rect.width / 2}px`;
    flyer.style.top = `${rect.top + rect.height / 2}px`;
    document.body.appendChild(flyer);

    requestAnimationFrame(() => {
      flyer.style.left = `${cartRect.left + cartRect.width / 2}px`;
      flyer.style.top = `${cartRect.top + cartRect.height / 2}px`;
      flyer.style.transform = 'scale(0.5) opacity(0)';
    });

    setTimeout(() => flyer.remove(), 800);
  };

  const removeFromCart = (itemId) => {
    triggerHaptic(10);
    setCart(prevCart => {
      const newCart = [...prevCart];
      const index = newCart.findIndex(i => i._id === itemId);
      if (index !== -1) {
        newCart.splice(index, 1);
      }
      return newCart;
    });
  };

  const placeOrder = async () => {
    try {
      if (cart.length === 0) {
        alert('Your cart is empty');
        return;
      }

      if (!tableNumber.trim()) {
        alert('Please enter your table number');
        return;
      }

      if (!customerName.trim()) {
        alert('Please enter your name');
        return;
      }

      const itemsMap = {};
      cart.forEach((item) => {
        // Use composite key (ID + notes) to keep uniquely customized items separate
        const key = `${item._id || item.id}-${item.notes || ''}`;
        if (!itemsMap[key]) {
          itemsMap[key] = { ...item, quantity: 0 };
        }
        itemsMap[key].quantity += 1;
      });

      const order = {
        items: Object.values(itemsMap).map(item => ({
          menuItemName: item.name,
          price: parseFloat(item.price),
          quantity: item.quantity,
          notes: item.notes // Include kitchen notes
        })),
        customerName: customerName.trim(),
        restaurantId: userId,
        tableNumber: tableNumber.trim(),
        totalAmount: cart.reduce((total, item) => total + item.price, 0)
      };

      const response = await axios.post(`${API_BASE_URL}/api/orders`, order);

      setCart([]);
      setShowCustomerForm(false);
      setShowCartSheet(false);
      // Persist customer name
      localStorage.setItem('customerName', customerName.trim());
      // Don't reset tableNumber anymore, it should persist for the session
      setCustomerName('');

      const newOrder = response.data;
      setActiveOrders(prev => [...prev, newOrder]);
      setShowOrderModal(true);

      // Save order IDs to localStorage for persistence
      const currentIds = JSON.parse(localStorage.getItem('activeOrderIds') || '[]');
      if (!currentIds.includes(newOrder._id)) {
        localStorage.setItem('activeOrderIds', JSON.stringify([...currentIds, newOrder._id]));
      }

    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleRequestService = (type) => {
    let currentTable = tableNumber;

    // Fallback: Try fetching from active orders if local state is empty
    if (!currentTable && activeOrders.length > 0) {
      currentTable = activeOrders[0].tableNumber;
      setTableNumber(currentTable);
    }

    // Interactive fallback: Prompt the user
    if (!currentTable) {
      const enteredTable = window.prompt('Please enter your table number to request service:');
      if (enteredTable) {
        currentTable = enteredTable;
        setTableNumber(enteredTable);
        localStorage.setItem('tableNumber', enteredTable);
      }
    }

    // If still no customer name, use the one from localStorage
    let currentName = customerName || localStorage.getItem('customerName') || 'Guest';
    if (!customerName && currentName !== 'Guest') {
      setCustomerName(currentName);
    }

    if (!socket || !currentTable) {
      if (!socket) alert('Connecting to server... Please try again in a moment.');
      setShowServiceMenu(false);
      return;
    }

    setServiceLoading(true);
    socket.emit('serviceRequest', {
      type,
      tableNumber: currentTable,
      restaurantId: userId,
      customerName: currentName,
      timestamp: new Date()
    });

    triggerHaptic([100, 50, 100]);

    setTimeout(() => {
      setServiceLoading(false);
      setShowServiceMenu(false);
      setServiceConfirmation({ type, table: currentTable });
      // Clear confirmation after 4 seconds
      setTimeout(() => setServiceConfirmation(null), 4000);
    }, 1000);
  };

  const handleShareMenu = async () => {
    const shareData = {
      title: restaurantInfo?.restaurantName || 'Digital Menu',
      text: `Check out the menu at ${restaurantInfo?.restaurantName}!`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Menu link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const renderSkeletons = () => (
    <div className="menu-page">
      <div className="skeleton-banner shimmer"></div>
      <div className="skeleton-brand-bar">
        <div className="skeleton-logo shimmer"></div>
        <div className="brand-info">
          <div className="skeleton-title shimmer"></div>
          <div className="skeleton-meta shimmer"></div>
        </div>
      </div>
      <div className="skeleton-categories">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-cat shimmer"></div>)}
      </div>
      <div className="menu-grid-premium">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-card shimmer"></div>)}
      </div>
    </div>
  );

  if (loading) return renderSkeletons();

  if (error) {
    return (
      <div className="menu-container">
        <div className="error">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
          <p style={{ fontSize: '14px', marginTop: '10px', color: '#666' }}>Restaurant ID: {userId}</p>
        </div>
      </div>
    );
  }

  if (!restaurantInfo) {
    return (
      <div className="menu-container">
        <div className="error">
          <i className="fas fa-exclamation-circle"></i>
          <p>Restaurant not found</p>
        </div>
      </div>
    );
  }

  const cartTotal = cart.reduce((total, item) => total + item.price, 0);

  const renderProductCard = (item) => (
    <div key={item._id} className={`premium-item-card ${!item.available ? 'sold-out' : ''}`}>
      <div className="item-img-box" onClick={() => setItemDetail(item)}>
        <img
          src={item.image || 'https://via.placeholder.com/300x200?text=Delicious+Food'}
          alt={item.name}
          loading="lazy"
        />
        {!item.available && <div className="sold-out-overlay">Sold Out</div>}
        <div className="img-expand-hint"><i className="fas fa-expand-alt"></i></div>
      </div>
      <div className="item-details" onClick={() => setItemDetail(item)}>
        <div className="item-main-info">
          <h3>{item.name}</h3>
          <p className="item-desc">{item.description}</p>
        </div>
        <div className="item-footer" onClick={e => e.stopPropagation()}>
          <span className="item-price">₹{item.price}</span>
          {cart.filter(c => c._id === item._id).length > 0 ? (
            <div className="qty-selector-premium">
              <button className="qty-btn" onClick={() => removeFromCart(item._id)}>−</button>
              <span className="qty-display">{cart.filter(c => c._id === item._id).length}</span>
              <button className="qty-btn" onClick={(e) => addToCart(item, e)}>+</button>
            </div>
          ) : (
            <button
              className="add-btn-premium"
              onClick={(e) => addToCart(item, e)}
              disabled={!item.available}
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`menu-page fade-in ${isDarkMode ? 'premium-dark' : ''}`}>
      {/* Top Action Bar */}
      <div className="top-action-bar">
        <button className="theme-toggle-btn-premium" onClick={() => {
          setIsDarkMode(!isDarkMode);
          localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
          triggerHaptic(30);
        }}>
          <i className={isDarkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
        </button>
        <button className="share-btn-premium" onClick={handleShareMenu}>
          <i className="fas fa-share-alt"></i>
        </button>

        {/* Global Service Bell */}
        <div className={`service-action-wrapper ${showServiceMenu ? 'active' : ''}`}>
          <button
            className={`service-bell-btn ${showServiceMenu ? 'active' : ''}`}
            onClick={() => {
              setShowServiceMenu(!showServiceMenu);
              triggerHaptic(20);
            }}
          >
            <i className={showServiceMenu ? 'fas fa-times' : 'fas fa-bell'}></i>
            {showServiceMenu && <span className="btn-close-hint">Close</span>}
          </button>

          {showServiceMenu && (
            <div className="service-dropdown-menu">
              <div className="dropdown-header">Request Service</div>
              <button onClick={() => handleRequestService('Waiter')} disabled={serviceLoading}>
                <i className="fas fa-user-tie"></i> <span>Call Waiter</span>
              </button>
              <button onClick={() => handleRequestService('Water')} disabled={serviceLoading}>
                <i className="fas fa-tint"></i> <span>Water</span>
              </button>
              <button onClick={() => handleRequestService('Cutlery')} disabled={serviceLoading}>
                <i className="fas fa-utensils"></i> <span>Cutlery</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="immersive-header" style={{ height: `${250 - (scrollProgress * 100)}px` }}>
        <div
          className="header-banner"
          style={{
            backgroundImage: `url(${restaurantInfo?.bannerImage || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=100&w=1500'})`,
            transform: `scale(${1 + scrollProgress * 0.2})`,
            filter: `blur(${scrollProgress * 5}px)`
          }}
        >
          <div className="header-overlay" style={{ opacity: 0.4 + scrollProgress * 0.4 }}></div>
        </div>
        <div className="brand-bar" style={{ transform: `translateY(${-scrollProgress * 20}px)` }}>
          <div className="brand-logo-wrapper" style={{
            transform: `scale(${1 - scrollProgress * 0.3})`,
            opacity: 1 - scrollProgress * 0.5
          }}>
            {restaurantInfo?.profilePicture ? (
              <img src={restaurantInfo.profilePicture} alt="logo" className="brand-logo" loading="lazy" />
            ) : (
              <div className="brand-logo-placeholder">{restaurantInfo.restaurantName.charAt(0)}</div>
            )}
          </div>
          <div className="brand-info">
            <h1 style={{ fontSize: `${1.8 - scrollProgress * 0.4}rem` }}>{restaurantInfo.restaurantName}</h1>
            <div className="brand-meta" style={{ opacity: 1 - scrollProgress }}>
              <span>📍 {tableNumber ? `Table ${tableNumber}` : 'Digital Menu'}</span>
              <span className="dot">•</span>
              <span>⭐ Premium Dining</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`sticky-nav-wrapper ${scrollProgress > 0.8 ? 'docked' : ''}`}>
        <div className="search-bar-wrapper">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search specialties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="categories-scroll-wrapper">
          <button
            className={`cat-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => scrollToSection('all')}
          >
            All Items
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`cat-tab ${activeCategory === category ? 'active' : ''}`}
              onClick={() => scrollToSection(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="menu-sections-container">
        {searchQuery ? (
          <div className="search-results">
            <div className="menu-grid-premium">
              {menuItems
                .filter(item =>
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(renderProductCard)
              }
            </div>
          </div>
        ) : (
          categories.map(category => (
            <div key={category} id={`section-${category}`} className="category-section">
              <h2 className="section-title">{category}</h2>
              <div className="menu-grid-premium">
                {menuItems
                  .filter(item => item.category === category)
                  .map(renderProductCard)
                }
              </div>
            </div>
          ))
        )}

        {!searchQuery && menuItems.length === 0 && (
          <div className="no-results-premium">
            <i className="fas fa-utensils"></i>
            <p>Menu is coming soon!</p>
          </div>
        )}

        {searchQuery && menuItems.filter(item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        ).length === 0 && (
            <div className="no-results-premium">
              <i className="fas fa-search"></i>
              <p>No matches for "{searchQuery}"</p>
            </div>
          )}
      </div>

      {showBackToTop && (
        <button className="back-to-top" onClick={() => scrollToSection('all')}>
          <i className="fas fa-arrow-up"></i>
        </button>
      )}

      {cart.length > 0 && (
        <div className="floating-cart-bar" onClick={() => setShowCartSheet(true)}>
          <div className="cart-bar-info">
            <span className="cart-count-badge">{cart.length} Items</span>
            <span className="cart-bar-total">₹{cartTotal.toFixed(2)}</span>
          </div>
          <button className="view-cart-trigger">
            View Cart <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {showCartSheet && (
        <div className="cart-sheet-overlay" onClick={() => setShowCartSheet(false)}>
          <div className="cart-sheet-content" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <div className="sheet-header">
              <h2>My Order</h2>
              <button className="clear-all-btn" onClick={() => {
                setCart([]);
                setShowCustomerForm(false);
              }}>Clear All</button>
            </div>

            {!showCustomerForm ? (
              <>
                <div className="sheet-items-list">
                  {[...new Set(cart.map(i => i._id))].map(id => {
                    const item = cart.find(i => i._id === id);
                    const qty = cart.filter(i => i._id === id).length;
                    return (
                      <div key={id} className="sheet-item-row">
                        <div className="sheet-item-info">
                          <span className="item-name">{item.name}</span>
                          <span className="item-price">₹{item.price * qty}</span>
                        </div>
                        <div className="sheet-qty-ctrl">
                          <button className="qty-btn-minus" onClick={() => removeFromCart(item._id)}>
                            <i className="fas fa-minus"></i>
                          </button>
                          <span className="qty-badge">{qty}</span>
                          <button className="qty-btn-plus" onClick={() => addToCart(item)}>
                            <i className="fas fa-plus"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {cart.length === 0 && (
                    <div className="empty-cart-msg">
                      <i className="fas fa-shopping-basket"></i>
                      <p>Your cart is empty. Add some delicious items to get started!</p>
                    </div>
                  )}
                </div>
                <div className="sheet-footer">
                  <div className="sheet-total-row">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <button
                    className="checkout-btn"
                    onClick={() => setShowCustomerForm(true)}
                    disabled={cart.length === 0}
                  >
                    Continue to Order
                  </button>
                </div>
              </>
            ) : (
              <div className="checkout-form-sheet">
                <h3>Final Details</h3>
                <div className="form-group-sheet">
                  <label>Your Name</label>
                  <input
                    type="text"
                    placeholder="E.g. John Doe"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="form-group-sheet">
                  <label>Table Number</label>
                  <select
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                  >
                    <option value="">Select Table</option>
                    {restaurantInfo?.tables?.map(num => (
                      <option key={num} value={num}>Table {num}</option>
                    ))}
                    {!restaurantInfo?.tables && [1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>Table {num}</option>
                    ))}
                  </select>
                </div>
                <div className="sheet-multi-actions">
                  <button className="btn-back-sheet" onClick={() => setShowCustomerForm(false)}>Back</button>
                  <button className="btn-confirm-sheet" onClick={placeOrder}>Place Order • ₹{cartTotal}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeOrders.length > 0 && !showOrderModal && (
        <div className="floating-order-tracking" onClick={() => setShowOrderModal(true)}>
          <div className="tracking-wave"></div>
          <div className="tracking-content">
            <div className="tracking-status-icon-wrapper">
              <span className="tracking-status-icon">
                {activeOrders.length > 1 ? '🛍️' :
                  activeOrders[0].status === 'pending' ? '🕒' :
                    activeOrders[0].status === 'process' ? '🔥' :
                      activeOrders[0].status === 'ready' ? '🍽️' :
                        activeOrders[0].status === 'billed' ? '🧾' : '⭐'}
              </span>
              <div className="pulse-indicator"></div>
            </div>
            <div className="tracking-text">
              <span className="tracking-label">
                {activeOrders.length > 1 ? `${activeOrders.length} Orders Tracking` : 'Live Order Tracking'}
              </span>
              <span className="tracking-status-text">
                {activeOrders.length > 1 ? 'Tap to view all orders' :
                  activeOrders[0].status === 'pending' ? 'Order Received' :
                    activeOrders[0].status === 'process' ? 'Chef is Cooking' :
                      activeOrders[0].status === 'ready' ? 'Ready to Serve' :
                        activeOrders[0].status === 'billed' ? 'Bill Generated' :
                          activeOrders[0].status === 'complete' ? 'Order Completed' :
                            activeOrders[0].status === 'cancelled' ? 'Order Cancelled' : 'Updating...'}
              </span>
            </div>
            <div className="tracking-arrow">
              <i className="fas fa-chevron-up"></i>
            </div>
          </div>
        </div>
      )}

      {activeOrders.length > 0 && showOrderModal && (
        <OrderSuccessModal
          orders={activeOrders}
          restaurantInfo={restaurantInfo}
          menuItems={menuItems}
          onQuickOrder={(item) => {
            // Simplified order placement for quick-adds
            addToCart(item);
            setShowCartSheet(true);
            setShowOrderModal(false);
          }}
          onClose={() => setShowOrderModal(false)}
          onClearOrder={(id) => {
            const updated = activeOrders.filter(o => o._id !== id);
            setActiveOrders(updated);
            localStorage.setItem('activeOrderIds', JSON.stringify(updated.map(o => o._id)));
            if (updated.length === 0) setShowOrderModal(false);
          }}
        />
      )}

      {/* Item Detail Modal */}
      {itemDetail && (
        <div className="item-detail-overlay" onClick={() => setItemDetail(null)}>
          <div className="item-detail-card" onClick={e => e.stopPropagation()}>
            <button className="close-detail" onClick={() => setItemDetail(null)}>&times;</button>
            <div className="detail-img-box">
              <img src={itemDetail.image || 'https://via.placeholder.com/600x400?text=Delicious+Food'} alt={itemDetail.name} />
            </div>
            <div className="detail-info">
              <div className="detail-header">
                <h2>{itemDetail.name}</h2>
                <span className="detail-price">₹{itemDetail.price}</span>
              </div>
              <div className="detail-badges">
                <span className={`badge ${itemDetail.category.toLowerCase().includes('veg') ? 'veg' : 'non-veg'}`}>
                  {itemDetail.category}
                </span>
                <span className="badge-premium">⭐ Best Seller</span>
              </div>

              <div className="special-notes-box">
                <label><i className="fas fa-pen-nib"></i> Special Instructions (Optional)</label>
                <textarea
                  placeholder="E.g. Extra spicy, No cilantro, etc."
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                />
              </div>

              <p className="detail-desc">{itemDetail.description}</p>

              <div className="detail-footer">
                <button
                  className="add-btn-premium detail-add"
                  onClick={(e) => {
                    addToCart(itemDetail, e, specialNote);
                  }}
                  disabled={!itemDetail.available}
                >
                  ADD TO CART • ₹{itemDetail.price}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Service Confirmation Toast */}
      {serviceConfirmation && (
        <div className="service-confirmation-toast">
          <div className="toast-content">
            <div className="toast-icon animate-pop">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="toast-text">
              <h3>Request Sent!</h3>
              <p>{serviceConfirmation.type} is on the way to Table {serviceConfirmation.table}</p>
            </div>
          </div>
          <div className="toast-progress"></div>
        </div>
      )}
    </div>
  );
};

export default Menu;
