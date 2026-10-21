import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';
import API_BASE_URL from '../config';
import './Demo.css';

const Demo = () => {
  const [view, setView] = useState('owner'); // 'owner' or 'customer'
  const [menuItems, setMenuItems] = useState([
    {
      id: 1,
      name: 'Signature Margherita',
      price: 299,
      description: 'Hand-stretched dough, San Marzano tomatoes, fresh mozzarella, and basil.',
      image: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&q=80&w=1500',
      category: 'Wood-fired Pizza'
    },
    {
      id: 2,
      name: 'Truffle Mushroom Risotto',
      price: 450,
      description: 'Creamy Arborio rice with wild mushrooms and white truffle oil.',
      image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&q=80&w=1500',
      category: 'Main Course'
    }
  ]);

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    description: '',
    category: '',
    image: ''
  });

  const [cart, setCart] = useState([]);
  const [totalTables, setTotalTables] = useState(10);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    tableNumber: ''
  });
  const [restaurantIdForDemo, setRestaurantIdForDemo] = useState('');
  const [restaurantIdFromQr, setRestaurantIdFromQr] = useState('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const tableParam = params.get('table');
      const restParam = params.get('restaurantId');
      if (viewParam === 'customer') setView('customer');
      if (tableParam) setCustomerInfo(prev => ({ ...prev, tableNumber: tableParam }));
      if (restParam) setRestaurantIdFromQr(restParam);
    } catch (err) {
      console.log('Param error', err);
    }
  }, []);

  const handleAddItem = (e) => {
    e.preventDefault();
    setMenuItems([...menuItems, { ...newItem, id: Date.now() }]);
    setNewItem({ name: '', price: '', description: '', category: '', image: '' });
  };

  const addToCart = (item) => {
    setCart([...cart, item]);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + parseFloat(item.price), 0).toFixed(2);
  };

  const placeOrder = async () => {
    if (!customerInfo.name || !customerInfo.tableNumber) {
      alert('Please enter your name and table number');
      return;
    }

    const itemsMap = {};
    cart.forEach((item) => {
      const key = item.id || item._id || item.name;
      if (!itemsMap[key]) {
        itemsMap[key] = { name: item.name, price: parseFloat(item.price) || 0, quantity: 0 };
      }
      itemsMap[key].quantity += 1;
    });

    const items = Object.values(itemsMap).map(i => ({
      menuItemName: i.name,
      price: i.price,
      quantity: i.quantity
    }));

    const payload = {
      items,
      tableNumber: parseInt(customerInfo.tableNumber, 10),
      customerName: customerInfo.name,
      totalAmount: parseFloat(getCartTotal()),
      restaurantId: restaurantIdFromQr || restaurantIdForDemo || null
    };

    try {
      // Note: In demo we try to call the real API if it's there
      await axios.post(`${API_BASE_URL}/api/orders`, payload);
      alert(`🎉 Order Placed Successfully!\nTotal: ₹${getCartTotal()}`);
      setCart([]);
      setCustomerInfo({ name: '', tableNumber: '' });
    } catch (err) {
      console.error('Order error:', err);
      // Fallback for visual demo if API fails
      alert(`Visual Demo: Order Simulated Successfully!\n(API was not reachable but the flow works!)`);
      setCart([]);
    }
  };

  return (
    <div className="demo-page-wrapper">
      <div className="demo-container-premium">

        {/* 1. Interactive Hero */}
        <div className="demo-hero">
          <h1>Experience QR Menu</h1>
          <p>The future of dining is interactive. Switch between views below.</p>

          <div className="view-segment-control">
            <button
              className={`segment-btn ${view === 'owner' ? 'active' : ''}`}
              onClick={() => setView('owner')}
            >
              <i className="fas fa-store"></i> Restaurant Owner
            </button>
            <button
              className={`segment-btn ${view === 'customer' ? 'active' : ''}`}
              onClick={() => setView('customer')}
            >
              <i className="fas fa-user-tie"></i> Guest Customer
            </button>
          </div>
        </div>

        {view === 'owner' ? (
          <div className="owner-workspace">
            {/* Left: Management Form */}
            <div className="workspace-card">
              <h2><i className="fas fa-plus-circle"></i> Item Management</h2>
              <form onSubmit={handleAddItem} className="premium-form">
                <div className="input-group-modern">
                  <label>Item Name</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    required
                    placeholder="e.g. Avocado Toast"
                  />
                </div>
                <div className="owner-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group-modern">
                    <label>Price (₹)</label>
                    <input
                      type="number"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      required
                      placeholder="299"
                    />
                  </div>
                  <div className="input-group-modern">
                    <label>Category</label>
                    <input
                      type="text"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      required
                      placeholder="Main Course"
                    />
                  </div>
                </div>
                <div className="input-group-modern">
                  <label>Description</label>
                  <textarea
                    rows="3"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Describe the flavors..."
                  />
                </div>
                <div className="input-group-modern">
                  <label>Image URL</label>
                  <input
                    type="url"
                    value={newItem.image}
                    onChange={(e) => setNewItem({ ...newItem, image: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
                <button type="submit" className="btn-add-modern">
                  <i className="fas fa-save"></i> Save to Live Menu
                </button>
              </form>
            </div>

            {/* Right: Preview & QR */}
            <div className="owner-right-column">
              <div className="workspace-card" style={{ marginBottom: '2rem' }}>
                <h2><i className="fas fa-qrcode"></i> QR Integration</h2>
                <div className="config-grid">
                  <div className="input-group-modern">
                    <label>Simulated Restaurant ID</label>
                    <input
                      type="text"
                      placeholder="Paste your ID from Dashboard"
                      value={restaurantIdForDemo}
                      onChange={(e) => setRestaurantIdForDemo(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn-add-modern"
                    style={{ background: '#22c55e' }}
                    onClick={() => setQrGenerated(true)}
                  >
                    Generate Smart QR
                  </button>
                </div>

                {qrGenerated && (
                  <div className="qr-demo-card" style={{ marginTop: '2rem' }}>
                    <div className="qr-wrapper-premium">
                      <QRCode
                        value={`${window.location.origin}/demo?view=customer${restaurantIdForDemo ? `&restaurantId=${restaurantIdForDemo}` : ''}`}
                        size={160}
                      />
                    </div>
                    <p style={{ color: '#000', fontWeight: '500' }}>Scan to enter Customer Mode</p>
                  </div>
                )}
              </div>

              <div className="workspace-card">
                <h2><i className="fas fa-list"></i> Menu Review</h2>
                <div className="menu-grid-demo">
                  {menuItems.map((item) => (
                    <div key={item.id} className="demo-item-card">
                      <div className="item-badge">{item.category}</div>
                      <img src={item.image || 'https://via.placeholder.com/300'} alt={item.name} className="demo-item-img" />
                      <div className="demo-item-content">
                        <h3>{item.name}</h3>
                        <span className="price-tag">₹{item.price}</span>
                        <button
                          className="btn-delete-demo"
                          onClick={() => setMenuItems(menuItems.filter(i => i.id !== item.id))}
                        >
                          <i className="fas fa-trash"></i> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CUSTOMER VIEW FLOW */
          <div className="customer-demo-flow">
            <div className="customer-card-header">
              <span style={{ color: '#a855f7', fontWeight: 'bold', textTransform: 'uppercase' }}>Now Viewing</span>
              <h2 style={{ fontSize: '2.5rem', margin: '10px 0' }}>Restaurant Menu</h2>
              <div className="customer-meta-row" style={{ display: 'flex', justifyContent: 'center', gap: '20px', opacity: 0.8 }}>
                <span><i className="fas fa-map-marker-alt"></i> New York, NY</span>
                <span><i className="fas fa-star"></i> 4.9 (Demo)</span>
              </div>
            </div>

            <div className="menu-grid-demo">
              {menuItems.map((item) => (
                <div key={item.id} className="demo-item-card">
                  <img src={item.image || 'https://via.placeholder.com/300'} alt={item.name} className="demo-item-img" />
                  <div className="demo-item-content">
                    <h3>{item.name}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>{item.description}</p>
                    <span className="price-tag">₹{item.price}</span>
                    <button className="btn-cart-premium" onClick={() => addToCart(item)}>
                      <i className="fas fa-plus"></i> Add to Order
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="floating-cart-demo">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 800 }}>🛒 Order Sheet</h3>
                  <button onClick={() => setCart([])} style={{ border: 'none', background: 'transparent', color: '#6366f1', fontWeight: 600, cursor: 'pointer' }}>Clear All</button>
                </div>

                <div className="cart-list-demo" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {cart.map((item, idx) => (
                    <div key={idx} className="cart-item-demo">
                      <img src={item.image} alt={item.name} />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{item.name}</h4>
                        <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>₹{item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="checkout-fields" style={{ marginTop: '1.5rem', borderTop: '1px solid #efefef', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="Name"
                      style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }}
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Table"
                      style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }}
                      value={customerInfo.tableNumber}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, tableNumber: e.target.value })}
                    />
                  </div>
                  <button className="btn-place-order" onClick={placeOrder}>
                    Confirm Order • ₹{getCartTotal()}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Demo;
