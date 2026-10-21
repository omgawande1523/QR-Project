import axios from 'axios';
import API_BASE_URL from '../config';
import { getToken, clearSession } from './session';

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

api.interceptors.request.use((request) => {
  const token = getToken();
  if (token && !request.headers.Authorization) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

// An expired or revoked session on an owner page sends the owner back to the login screen.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    const onOwnerPage = window.location.pathname.startsWith('/dashboard');
    if (error.response?.status === 401 && ['INVALID_TOKEN', 'NO_TOKEN'].includes(code) && onOwnerPage) {
      clearSession();
      window.location.assign('/login?expired=1');
    }
    return Promise.reject(error);
  }
);

// The server sends { message, code, details }; fall back for network errors.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  return fallback;
}
