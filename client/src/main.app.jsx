import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
// Hindi / Marathi dish names in the menu manager; only downloaded when Devanagari text is on screen.
import '@fontsource-variable/noto-sans-devanagari';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import StaffApp from './StaffApp';
import { boot, afterFirstRender } from './native/boot';

// Entry point of the staff app build (vite build --mode app). Unlike main.jsx there is no service worker:
// the app's files are already on the phone.
boot().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <StaffApp />
    </React.StrictMode>
  );
  requestAnimationFrame(() => afterFirstRender());
});
