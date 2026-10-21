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

// No service worker for now: remove any worker an earlier build registered.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}
