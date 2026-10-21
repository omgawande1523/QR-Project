import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
// Hindi / Marathi dish names; the browser only downloads it when Devanagari text is on screen.
import '@fontsource-variable/noto-sans-devanagari';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable app with an offline page (public/sw.js). Earlier builds registered /service-worker.js,
// which now only cleans itself up; remove it here too.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations
        .filter((r) => (r.active || r.waiting || r.installing)?.scriptURL.endsWith('/service-worker.js'))
        .forEach((r) => r.unregister()))
      .catch(() => {});
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
