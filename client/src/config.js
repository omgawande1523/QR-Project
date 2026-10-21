// App-wide configuration. Override the URLs with VITE_* variables (see .env.example).
export const APP_NAME = 'QR Menu';

const trimSlash = (url) => url.replace(/\/+$/, '');

// The staff app build defaults to 10.0.2.2, which is the PC itself as seen from the Android emulator.
const DEFAULT_API = import.meta.env.VITE_APP === 'true' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
const API_BASE_URL = trimSlash(import.meta.env.VITE_API_URL || DEFAULT_API);
export const SOCKET_URL = trimSlash(import.meta.env.VITE_SOCKET_URL || API_BASE_URL);

export default API_BASE_URL;
