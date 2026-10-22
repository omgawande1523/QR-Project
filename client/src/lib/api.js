import axios from 'axios';
import API_BASE_URL from '../config';
import { getToken, clearSession } from './session';
import { IS_APP, isNative, platformName } from './platform';

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

// The staff app identifies itself, so its logins show up as "app" sessions with the platform and device name.
if (IS_APP) api.defaults.headers.common['X-Client'] = 'app';
if (IS_APP && isNative()) api.defaults.headers.common['X-Platform'] = platformName();
export function setDeviceName(name) {
  if (name) api.defaults.headers.common['X-Device-Name'] = name.slice(0, 60);
}

api.interceptors.request.use((request) => {
  const token = getToken();
  if (token && !request.headers.Authorization) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

// An expired or revoked session on an owner page sends the owner back to the login screen.
// (In the app every screen but the sign-in pages is a staff screen.)
const STAFF_PAGE = IS_APP ? /^\/(dashboard|kitchen)(\/|$)/ : /^\/dashboard/;
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    const onOwnerPage = STAFF_PAGE.test(window.location.pathname);
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
