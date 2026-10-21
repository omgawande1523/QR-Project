import React from 'react';
import QRCode from 'react-qr-code';

const QRCodeGenerator = () => {
  const menuUrl = window.location.origin + '/menu';

  return (
    <div className="qr-code-container">
      <h1>Scan QR Code to View Menu</h1>
      <div style={{ margin: '20px' }}>
        <QRCode value={menuUrl} size={256} />
      </div>
      <p>Scan this code to view our menu on your device</p>
    </div>
  );
};

export default QRCodeGenerator;