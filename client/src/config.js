// App-wide configuration. Override the URLs with VITE_* variables (see .env.example).
export const APP_NAME = 'QR Menu';

const trimSlash = (url) => url.replace(/\/+$/, '');

const API_BASE_URL = trimSlash(import.meta.env.VITE_API_URL || 'http://localhost:5000');
export const SOCKET_URL = trimSlash(import.meta.env.VITE_SOCKET_URL || API_BASE_URL);

export default API_BASE_URL;
