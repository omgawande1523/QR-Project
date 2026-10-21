import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import QRCode from 'react-qr-code';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import API_BASE_URL, { SOCKET_URL } from '../config';
import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('orders'); // orders, menu, service, settings
  const [kitchenMode, setKitchenMode] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add, edit
  const [currentItem, setCurrentItem] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') !== 'false';
  });
  const [restaurantData, setRestaurantData] = useState(null);
  const [tableInput, setTableInput] = useState('');
  const [printOrder, setPrintOrder] = useState(null);
  const [currentTableCard, setCurrentTableCard] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [qrColor, setQrColor] = useState('#000000');
  const [qrLogo, setQrLogo] = useState('');
  const [tableStats, setTableStats] = useState({});
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: ''
  });

  // Fetch initial data
  useEffect(() => {
    const userId = localStorage.getItem('userId');

    // Socket Setup
    const socket = io(SOCKET_URL);
    socket.emit('join', userId);

    socket.on('newOrder', (order) => {
      addNotification(`🎉 New Order! Table ${order.tableNumber}`, 'success');
      setOrders(prev => [order, ...prev]);
      if (soundEnabled) {
        playNotificationSound();
        speak(`New order received from Table ${order.tableNumber}`);
      }
    });

    socket.on('orderUpdated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
    });

    socket.on('serviceRequest', (data) => {
      const { type, tableNumber, customerName } = data;
      addNotification(`🛎️ ${type} Requested! Table ${tableNumber} (${customerName})`, 'warning');
      setServiceRequests(prev => [{ ...data, id: data._id || Date.now() }, ...prev]);
      if (soundEnabled) {
        playNotificationSound();
        speak(`${type} requested for Table ${tableNumber}`);
      }
    });

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
        const [menuRes, ordersRes, userRes, serviceRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/menu/${userId}`),
          axios.get(`${API_BASE_URL}/api/orders`, { headers }),
          axios.get(`${API_BASE_URL}/api/users/${userId}`, { headers }),
          axios.get(`${API_BASE_URL}/api/service-requests`, { headers })
        ]);
        setMenuItems(menuRes.data);
        setOrders(ordersRes.data);
        setRestaurantData(userRes.data);
        setServiceRequests(serviceRes.data);
        // Initialize branding states from user data
        if (userRes.data) {
          setQrColor(userRes.data.qrColor || '#000000');
          setQrLogo(userRes.data.qrLogo || '');
          setTableStats(userRes.data.tableStats || {});
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();

    return () => socket.disconnect();
  }, [soundEnabled]);

  const addNotification = (message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => { });
  };

  const speak = (text) => {
    if (!soundEnabled) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  // Menu Actions
  const handleOpenModal = (mode, item = null) => {
    setModalMode(mode);
    setCurrentItem(item);
    if (item) {
      setFormData({
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        image: item.image
      });
    } else {
      setFormData({ name: '', description: '', price: '', category: '', image: '' });
    }
    setShowModal(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    const userId = localStorage.getItem('userId');

    try {
      if (modalMode === 'add') {
        const res = await axios.post(`${API_BASE_URL}/api/menu`, { ...formData, owner: userId }, { headers });
        setMenuItems([...menuItems, res.data]);
        addNotification('Item added successfully!');
      } else {
        const res = await axios.put(`${API_BASE_URL}/api/menu/${currentItem._id}`, formData, { headers });
        setMenuItems(menuItems.map(i => i._id === currentItem._id ? res.data : i));
        addNotification('Item updated successfully!');
      }
      setShowModal(false);
    } catch (error) {
      addNotification(error.response?.data?.message || 'Error saving item', 'error');
    }
  };

  const generateTableCard = async (tableNum) => {
    setCurrentTableCard(tableNum);
    addNotification(`Generating card for Table ${tableNum}...`, 'success');

    // Wait for DOM to render the hidden template
    setTimeout(async () => {
      const element = document.getElementById('printable-table-card');
      if (!element) return;

      try {
        const canvas = await html2canvas(element, {
          scale: 3, // Higher scale for printing quality
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        // 4x6 inches is roughly 101.6 x 152.4 mm
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [101.6, 152.4]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, 101.6, 152.4);
        pdf.save(`${restaurantData?.restaurantName || 'Restaurant'}_Table_${tableNum}.pdf`);
        setCurrentTableCard(null);
        addNotification('Table card downloaded!', 'success');
      } catch (error) {
        console.error('Error generating PDF:', error);
        addNotification('Failed to generate card.', 'error');
        setCurrentTableCard(null);
      }
    }, 500);
  };

  const toggleAvailability = async (item) => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await axios.put(`${API_BASE_URL}/api/menu/${item._id}`,
        { available: !item.available },
        { headers }
      );
      setMenuItems(menuItems.map(i => i._id === item._id ? res.data : i));
      addNotification(`Item marked as ${!item.available ? 'Available' : 'Unavailable'}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      await axios.delete(`${API_BASE_URL}/api/menu/${id}`, { headers });
      setMenuItems(menuItems.filter(i => i._id !== id));
      addNotification('Item deleted');
    } catch (error) {
      console.error(error);
    }
  };

  // Order Actions
  const updateOrderStatus = async (orderId, status) => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await axios.put(`${API_BASE_URL}/api/orders/${orderId}`, { status }, { headers });

      setOrders(prevOrders => prevOrders.map(o => o._id === orderId ? res.data : o));

      if (status === 'complete' || status === 'cancelled') {
        addNotification(`Order ${status === 'complete' ? 'Completed' : 'Cancelled'}`, 'success');
      }
    } catch (error) {
      console.error('Error updating order status:', error.response?.data || error.message);
      addNotification(`Error: ${error.response?.data?.message || 'Update failed'}`, 'error');
    }
  };

  const handleGenerateBill = (order) => {
    if (order.status !== 'billed' && order.status !== 'complete') {
      updateOrderStatus(order._id, 'billed');
      addNotification(`Bill generated for Table ${order.tableNumber}`, 'success');
    }
  };

  const clearServiceRequest = async (id) => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      await axios.delete(`${API_BASE_URL}/api/service-requests/${id}`, { headers });
      setServiceRequests(prev => prev.filter(r => r._id !== id && r.id !== id));
      addNotification('Service request handled');
    } catch (err) {
      console.error('Error clearing service request:', err);
      addNotification('Error clearing request', 'error');
    }
  };

  const getServiceIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'water': return 'fa-tint';
      case 'waiter': return 'fa-user-tie';
      case 'cutlery': return 'fa-utensils';
      default: return 'fa-bell';
    }
  };

  const handleDownloadBill = async (order) => {
    setPrintOrder(order);

    // Give state time to render the printable-bill-template
    setTimeout(async () => {
      const element = document.querySelector('.printable-bill-template');
      if (!element) return;

      // Temporarily show the template for capturing
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
        pdf.save(`Bill-T${order.tableNumber}-${order._id.slice(-6).toUpperCase()}.pdf`);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Could not generate receipt.');
      } finally {
        if (element) {
          element.style.display = 'none';
          element.style.position = 'absolute';
          element.style.left = '0';
        }
        setPrintOrder(null);
      }
    }, 500);

    // Trigger billed status update
    if (order.status !== 'billed' && order.status !== 'complete') {
      updateOrderStatus(order._id, 'billed');
    }
  };

  // Restaurant Actions
  const handleUpdateTables = async (newTables) => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId');
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await axios.put(`${API_BASE_URL}/api/users/${userId}`, {
        restaurantName: restaurantData.restaurantName,
        tables: newTables
      }, { headers });
      setRestaurantData(res.data);
      setQrColor(res.data.qrColor || '#000000');
      setQrLogo(res.data.qrLogo || '');
      setTableStats(res.data.tableStats || {});
      setLoading(false);
      addNotification('Tables updated successfully', 'success');
    } catch (error) {
      console.error(error);
      addNotification('Error updating tables', 'error');
      setLoading(false);
    }
  };

  const handleUpdateBranding = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId');
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await axios.put(`${API_BASE_URL}/api/users/${userId}`, {
        restaurantName: restaurantData.restaurantName,
        qrColor,
        qrLogo
      }, { headers });
      setRestaurantData(res.data);
      addNotification('Branding updated successfully!', 'success');
    } catch (error) {
      console.error(error);
      addNotification('Failed to update branding', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addTable = () => {
    const num = parseInt(tableInput);
    if (!num || isNaN(num)) return;
    if (restaurantData.tables.includes(num)) {
      addNotification('Table already exists', 'error');
      return;
    }
    const newTables = [...restaurantData.tables, num].sort((a, b) => a - b);
    handleUpdateTables(newTables);
    setTableInput('');
  };

  const removeTable = (num) => {
    const newTables = restaurantData.tables.filter(t => t !== num);
    handleUpdateTables(newTables);
  };
  const downloadQRCode = () => {
    const svg = document.querySelector('.settings-qr-container svg');
    if (!svg) {
      alert('QR code not found');
      return;
    }
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = png;
      link.download = 'restaurant-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  };

  const bulkDownloadQRs = async () => {
    if (!restaurantData?.tables || restaurantData.tables.length === 0) {
      addNotification('No tables to export', 'error');
      return;
    }

    setIsExporting(true);
    addNotification('Preparing bulk export...', 'success');

    // Wait for the hidden QRs to render
    setTimeout(async () => {
      try {
        const zip = new JSZip();
        const exportContainer = document.getElementById('qr-bulk-export-container');
        const qrElements = exportContainer.querySelectorAll('.qr-bulk-item');

        for (let i = 0; i < qrElements.length; i++) {
          const el = qrElements[i];
          const tableNum = el.getAttribute('data-table');

          const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
          });

          const imgData = canvas.toDataURL('image/png').split(',')[1];
          zip.file(`Table_${tableNum}_QR.png`, imgData, { base64: true });
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${restaurantData.restaurantName || 'Restaurant'}_ALL_QRs.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setIsExporting(false);
        addNotification('Bulk export complete!', 'success');
      } catch (err) {
        console.error('Bulk export error:', err);
        addNotification('Failed to generate ZIP', 'error');
        setIsExporting(false);
      }
    }, 1000);
  };


  const renderServiceBoard = () => (
    <div className="service-board-premium">
      <div className="board-header">
        <h3>🛎️ Live Service Alerts</h3>
        <span className="request-count">{serviceRequests.length} Pending</span>
      </div>
      <div className="service-grid">
        {serviceRequests.map((req) => (
          <div key={req._id || req.id} className={`service-card-alert ${req.type.toLowerCase()}`}>
            <div className="alert-icon">
              <i className={`fas ${getServiceIcon(req.type)}`}></i>
            </div>
            <div className="alert-info">
              <span className="alert-type">{req.type}</span>
              <span className="alert-table">Table {req.tableNumber}</span>
              <span className="alert-customer">guest: {req.customerName}</span>
            </div>
            <button className="handled-btn" onClick={() => clearServiceRequest(req._id || req.id)}>
              Handled
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // Render Functions
  const renderOrders = () => {
    // Only show orders that are NOT complete or cancelled in the live board
    const liveOrders = orders.filter(o => o.status !== 'complete' && o.status !== 'cancelled');

    const columns = {
      pending: liveOrders.filter(o => o.status === 'pending'),
      process: liveOrders.filter(o => o.status === 'process'),
      ready: liveOrders.filter(o => o.status === 'ready' || o.status === 'billed')
    };

    return (
      <>
        <div className="kanban-board">
          {/* Pending Column */}
          <div className="kanban-column status-pending">
            <h3>🕒 New Orders <span className="count">{columns.pending.length}</span></h3>
            {columns.pending.map(order => (
              <OrderCard key={order._id} order={order}
                onNext={() => updateOrderStatus(order._id, 'process')}
                onCancel={() => updateOrderStatus(order._id, 'cancelled')}
                nextLabel="Accept"
                cancelLabel="Reject"
              />
            ))}
          </div>

          {/* Processing Column */}
          <div className="kanban-column status-process">
            <h3>🔥 Preparing <span className="count">{columns.process.length}</span></h3>
            {columns.process.map(order => (
              <OrderCard key={order._id} order={order}
                onPrev={() => updateOrderStatus(order._id, 'pending')}
                onNext={() => updateOrderStatus(order._id, 'ready')}
                onGenerateBill={() => handleGenerateBill(order)}
                onDownload={() => handleDownloadBill(order)}
                nextLabel="Ready"
                prevLabel="Back"
              />
            ))}
          </div>

          {/* Completed/Ready Column */}
          <div className="kanban-column status-complete">
            <h3>✅ Ready <span className="count">{columns.ready.length}</span></h3>
            {columns.ready.map(order => (
              <OrderCard key={order._id} order={order}
                onPrev={() => updateOrderStatus(order._id, 'process')}
                onNext={() => updateOrderStatus(order._id, 'complete')}
                onGenerateBill={() => handleGenerateBill(order)}
                onDownload={() => handleDownloadBill(order)}
                nextLabel="Serve"
                prevLabel="Back"
                isReady
              />
            ))}
          </div>
        </div>
      </>
    );
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredMenuItems = menuItems.filter(item =>
    (item.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (item.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (item.category?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const renderMenu = () => (
    <div>
      <div className="menu-toolbar">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search menu..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="add-btn" onClick={() => handleOpenModal('add')}>
          <span className="btn-icon">+</span> Add Item
        </button>
      </div>

      <div className="menu-grid">
        {filteredMenuItems.map(item => (
          <div key={item._id} className="menu-card">
            <div className={`availability-badge ${item.available ? 'available' : 'unavailable'}`}>
              {item.available ? 'In Stock' : 'Sold Out'}
            </div>
            <div className="menu-img-container">
              <img src={item.image || 'https://via.placeholder.com/300'} alt={item.name} />
            </div>
            <div className="menu-content">
              <div className="menu-header">
                <span className="menu-title">{item.name}</span>
                <span className="menu-price">₹{item.price}</span>
              </div>
              <p className="menu-desc">{item.description}</p>
              <div className="menu-actions">
                <button className="menu-btn btn-edit" onClick={() => handleOpenModal('edit', item)}>Edit</button>
                <button className="menu-btn btn-toggle" onClick={() => toggleAvailability(item)}>
                  {item.available ? 'Sold Out' : 'Restock'}
                </button>
                <button className="menu-btn btn-delete" onClick={() => handleDeleteItem(item._id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {filteredMenuItems.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#666' }}>
            <p>No menu items found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="settings-container">
      {/* 1. QR Code Center */}
      <div className="settings-card qr-section">
        <div className="card-header-main">
          <h2>📱 QR Code Center</h2>
          <p>Scan to view your digital menu</p>
        </div>
        <div className="qr-preview-wrapper">
          <div className="settings-qr-container" style={{ borderColor: qrColor }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <QRCode
                value={`${window.location.origin}/menu/${localStorage.getItem('userId')}`}
                size={180}
                fgColor={qrColor}
                level="H"
              />
              {qrLogo && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  padding: '5px',
                  borderRadius: '4px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                  <img src={qrLogo} alt="Logo" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
                </div>
              )}
            </div>
          </div>
          <div className="qr-actions-grid">
            <a className="qr-action-tile" href={`/menu/${localStorage.getItem('userId')}`} target="_blank" rel="noreferrer">
              <span className="tile-icon">🌐</span>
              <span className="tile-text">Live Menu</span>
            </a>
            <button className="qr-action-tile" onClick={downloadQRCode}>
              <span className="tile-icon">📥</span>
              <span className="tile-text">Download</span>
            </button>
            <button className="qr-action-tile" onClick={bulkDownloadQRs}>
              <span className="tile-icon">📦</span>
              <span className="tile-text">Get All (ZIP)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Premium Branding */}
      <div className="settings-card branding-section">
        <div className="card-header-main">
          <h2>🎨 Premium Branding</h2>
          <p>Customize your QR code theme</p>
        </div>
        <div className="branding-controls">
          <div className="control-group">
            <label>QR Theme Color</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                value={qrColor}
                onChange={(e) => setQrColor(e.target.value)}
              />
              <span className="color-hex">{qrColor.toUpperCase()}</span>
            </div>
          </div>
          <div className="control-group">
            <label>Center Logo URL</label>
            <input
              type="text"
              className="interactive-input"
              placeholder="https://example.com/logo.png"
              value={qrLogo}
              onChange={(e) => setQrLogo(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={handleUpdateBranding} style={{ marginTop: '10px' }}>
            Save Theme Settings
          </button>
        </div>
      </div>

      {/* 2. Table Management */}
      <div className="settings-card table-section">
        <div className="card-header-main">
          <h2>🪑 Table Management</h2>
          <p>Configure your restaurant layout</p>
        </div>
        <div className="table-manager-content">
          <div className="table-add-group">
            <input
              type="number"
              placeholder="Table No."
              value={tableInput}
              onChange={(e) => setTableInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTable()}
            />
            <button className="add-table-btn" onClick={addTable}>Add</button>
          </div>
          <div className="tables-list">
            {restaurantData?.tables.map(num => (
              <div key={num} className="table-chip">
                <span>Table {num}</span>
                <div className="table-actions-inline">
                  <button className="table-card-btn" onClick={() => generateTableCard(num)} title="Generate Branded Table Card">🎴</button>
                  <a href={`${window.location.origin}/menu/${localStorage.getItem('userId')}?table=${num}`} target="_blank" rel="noreferrer" title="Open table menu">🔗</a>
                  <button className="remove-table" onClick={() => removeTable(num)}>&times;</button>
                </div>
              </div>
            ))}
            {(!restaurantData?.tables || restaurantData.tables.length === 0) && (
              <div className="empty-state">No tables added yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Table Engagement Analytics */}
      <div className="settings-card analytics-section">
        <div className="card-header-main">
          <h2>📊 Table Engagement</h2>
          <p>Real-time scan analytics by table</p>
        </div>
        <div className="analytics-content">
          <div className="stats-grid">
            {restaurantData?.tables && restaurantData.tables.length > 0 ? (
              restaurantData.tables.map(num => {
                const count = tableStats ? (tableStats[num] || 0) : 0;
                const statsArray = tableStats ? Object.values(tableStats) : [0];
                const maxCount = Math.max(...statsArray, 1);
                const percentage = (count / maxCount) * 100;

                return (
                  <div key={num} className="stat-row">
                    <div className="stat-info">
                      <span className="stat-label">Table {num}</span>
                      <span className="stat-value">{count} scans</span>
                    </div>
                    <div className="stat-bar-outer">
                      <div
                        className="stat-bar-inner"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: qrColor
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">No tables configured for analytics.</div>
            )}
          </div>
        </div>
      </div>

      {/* 3. System Preferences */}
      <div className="settings-card pref-section">
        <div className="card-header-main">
          <h2>🛠️ System Preferences</h2>
        </div>
        <div className="pref-item">
          <div className="pref-info">
            <span className="pref-title">🔔 Order Sound Alerts</span>
            <span className="pref-desc">Play sound when new orders arrive</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => {
                setSoundEnabled(e.target.checked);
                localStorage.setItem('soundEnabled', e.target.checked);
              }}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="restaurant-info-footer">
          <div className="info-row">
            <span className="info-label">Restaurant ID:</span>
            <span className="info-val">{restaurantData?._id}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Restaurant Name:</span>
            <span className="info-val">{restaurantData?.restaurantName}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`dashboard-container ${kitchenMode ? 'kitchen-mode-active' : ''}`}>
      {/* Notifications */}
      <div className="notification-container">
        {notifications.map(n => (
          <div key={n.id} className={`notification notification-${n.type}`}>
            {n.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="dashboard-header">
        <h1>Restaurant Dashboard</h1>
        <div className="dashboard-tabs">
          <button
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📋 Live Orders
          </button>
          <button
            className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            🍔 Menu Manager
          </button>
          <button
            className={`tab-btn ${activeTab === 'service' ? 'active' : ''}`}
            onClick={() => setActiveTab('service')}
          >
            🛎️ Hospitality {serviceRequests.length > 0 && <span className="tab-badge">{serviceRequests.length}</span>}
          </button>
          <button
            className={`tab-btn kitchen-mode-btn ${kitchenMode ? 'active' : ''}`}
            onClick={() => setKitchenMode(!kitchenMode)}
            title="Toggle High Contrast Kitchen Mode"
          >
            {kitchenMode ? '☀️ Normal' : '🌑 Kitchen Mode'}
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="dashboard-content">
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'menu' && renderMenu()}
        {activeTab === 'service' && renderServiceBoard()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? '✨ Add New Item' : '✏️ Edit Item'}</h2>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Left Column: textual inputs */}
                <div>
                  <div className="input-group">
                    <input
                      type="text"
                      className="interactive-input"
                      placeholder=" "
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <label>Item Name</label>
                  </div>

                  <div className="input-group">
                    <textarea
                      className="interactive-input"
                      placeholder=" "
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      style={{ height: '120px', resize: 'none' }}
                    />
                    <label>Description</label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="input-group">
                      <input
                        type="number"
                        className="interactive-input"
                        placeholder=" "
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                      <label>Price (₹)</label>
                    </div>
                    <div className="input-group">
                      <select
                        className="interactive-input"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        required
                        style={{ appearance: 'none' }}
                      >
                        <option value="" disabled hidden></option>
                        <option value="Veg">Veg</option>
                        <option value="Non-Veg">Non-Veg</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Desserts">Desserts</option>
                      </select>
                      <label>Category</label>
                    </div>
                  </div>
                </div>

                {/* Right Column: Image inputs */}
                <div>
                  <div className="input-group">
                    <input
                      type="text"
                      className="interactive-input"
                      placeholder=" "
                      value={formData.image}
                      onChange={e => setFormData({ ...formData, image: e.target.value })}
                    />
                    <label>Paste Image URL</label>
                  </div>

                  <div className="file-input-wrapper">
                    <label>Or Upload Image</label>
                    <input type="file" className="file-input" onChange={handleImageUpload} accept="image/*" />
                  </div>

                  {formData.image && (
                    <div className="img-preview">
                      <img src={formData.image} alt="Preview" onError={(e) => e.target.src = 'https://via.placeholder.com/300?text=Invalid+URL'} />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DEDICATED PRINTABLE BILL TEMPLATE (Hidden by default) */}
      {printOrder && (
        <div id="printable-bill-container" style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
          <div className="printable-bill-template">
            <div className="bill-header">
              <h1>{restaurantData?.restaurantName || 'RESTAURANT'}</h1>
              <p className="bill-subtitle">Restaurant-Bill Receipt</p>
              <div className="bill-divider"></div>
            </div>

            <div className="bill-info">
              <p><span>Order ID:</span> <span>#{printOrder._id.slice(-6).toUpperCase()}</span></p>
              <p><span>Date:</span> <span>{new Date(printOrder.createdAt).toLocaleString()}</span></p>
              <p><span>Customer:</span> <span>{printOrder.customerName || 'Guest'}</span></p>
              <p><span>Table No:</span> <span>{printOrder.tableNumber}</span></p>
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
                {printOrder.items.map((item, index) => (
                  <tr key={index}>
                    <td className="text-left">
                      {item.menuItemName}
                      {item.notes && <div style={{ fontSize: '10px', color: '#666', fontStyle: 'italic', marginTop: '2px' }}>Note: {item.notes}</div>}
                    </td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">₹{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bill-divider"></div>

            <div className="bill-total-row">
              <span>Total Amount</span>
              <span>₹{printOrder.totalAmount?.toFixed(2)}</span>
            </div>

            <div className="bill-footer">
              <p>Restaurant Copy</p>
              <p>Generated by QR Menu Pro</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. DEDICATED PRINTABLE TABLE CARD (Hidden) */}
      {currentTableCard && (
        <div id="printable-table-card" className="table-card-print-template">
          <div className="table-card-logo">
            {restaurantData?.restaurantName || 'RESTAURANT'}
          </div>
          <div className="table-card-qr-box">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <QRCode
                value={`${window.location.origin}/menu/${localStorage.getItem('userId')}?table=${currentTableCard}`}
                size={250}
                fgColor={qrColor}
                level="H"
              />
              {qrLogo && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  padding: '8px',
                  borderRadius: '6px'
                }}>
                  <img src={qrLogo} alt="Logo" style={{ width: '45px', height: '45px', objectFit: 'contain' }} />
                </div>
              )}
            </div>
          </div>
          <div className="table-card-table-num">
            Table No. {currentTableCard}
          </div>
          <div className="table-card-instructions">
            Scan to view our menu & order directly from your phone
          </div>
          <div className="table-card-footer">
            Generated by QR Menu Pro
          </div>
        </div>
      )}

      {/* 5. HIDDEN BULK EXPORT CONTAINER */}
      {isExporting && (
        <div id="qr-bulk-export-container" style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
          {restaurantData?.tables.map(num => (
            <div key={num} className="qr-bulk-item" data-table={num} style={{ background: 'white', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>Table {num}</div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <QRCode
                  value={`${window.location.origin}/menu/${localStorage.getItem('userId')}?table=${num}`}
                  size={200}
                  fgColor={qrColor}
                  level="H"
                />
                {qrLogo && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'white',
                    padding: '5px',
                    borderRadius: '4px'
                  }}>
                    <img src={qrLogo} alt="Logo" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
                  </div>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>{restaurantData.restaurantName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper Component for Order Card
const OrderCard = ({ order, onNext, onPrev, onCancel, onGenerateBill, onDownload, isReady, isCompleted, nextLabel, prevLabel, cancelLabel }) => {
  const [elapsed, setElapsed] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const start = new Date(order.createdAt);
      const now = new Date();
      const diffInMins = Math.floor((now - start) / 60000);
      const diffInSecs = Math.floor(((now - start) / 1000) % 600);

      setElapsed(`${diffInMins}m ${diffInSecs % 60}s`);
      if (diffInMins >= 10 && order.status === 'pending') {
        setIsUrgent(true);
      } else {
        setIsUrgent(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [order.createdAt, order.status]);

  return (
    <div className={`kanban-card ${isReady ? 'ready-card' : ''} ${isUrgent ? 'urgent-border' : ''}`}>
      <div className="card-header">
        <div className="header-top">
          <span className="table-badge">T-{order.tableNumber}</span>
          <div className="time-badge">
            <span className={`urgency-timer ${isUrgent ? 'urgency-urgent' : ''}`}>
              <i className="far fa-clock"></i> {elapsed}
            </span>
          </div>
        </div>
        <div className="customer-info-compact">
          <span className="customer-name-small">{order.customerName || 'Guest'}</span>
        </div>
      </div>
      <div className="card-items-compact">
        {order.items.map((item, i) => (
          <div key={i} className="card-item-compact">
            <div className="item-main-compact">
              <span className="item-qty-compact">{item.quantity}x</span>
              <span className="item-name-compact">{item.menuItemName}</span>
            </div>
            {item.notes && (
              <div className="item-notes-compact">
                <i className="fas fa-pen-nib"></i> {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="card-footer-compact">
        <div className="total-section-compact">
          <span className="total-price-compact">₹{order.totalAmount}</span>
          {order.status === 'billed' && <span className="billed-indicator">Billed</span>}
        </div>
        {!isCompleted && (
          <div className="card-actions-compact">
            {onCancel && (
              <button className="compact-action-btn btn-cancel-wide" onClick={onCancel} title="Reject">
                <i className="fas fa-times"></i> {cancelLabel || 'Reject'}
              </button>
            )}

            {onPrev && (
              <button className="compact-action-btn btn-prev" onClick={onPrev} title="Back">
                <i className="fas fa-arrow-left"></i>
              </button>
            )}

            {onGenerateBill && (
              <button
                className={`compact-action-btn ${order.status === 'billed' ? 'btn-billed' : 'btn-gen-bill'}`}
                onClick={onGenerateBill}
                title="Generate Bill"
              >
                BILL
              </button>
            )}

            {onDownload && (
              <button
                className={`compact-action-btn ${order.status === 'billed' ? 'btn-billed' : 'btn-print'}`}
                onClick={onDownload}
                title="Download Receipt"
              >
                📥
              </button>
            )}

            {onNext && (
              <button className={`compact-action-btn btn-next-wide ${isReady ? 'btn-serve' : ''}`} onClick={onNext} title={nextLabel}>
                {nextLabel || 'Next'} <i className={`fas ${isReady ? 'fa-check-double' : 'fa-arrow-right'}`}></i>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
