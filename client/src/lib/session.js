import { IS_APP } from './platform';

// The logged-in session (owner or staff). Keys match what the app stored before the redesign,
// so existing logins keep working. userId is always the restaurant; role says who is acting.
//
// Website: localStorage, as always. Staff app: the values live in memory, loaded at start-up from secure
// storage (Android Keystore) by initSession(), and every change is written back there; the token never
// touches localStorage in the app.
const TOKEN_KEY = 'token';
const USER_KEY = 'userId';
const ROLE_KEY = 'role';
const KEYS = [TOKEN_KEY, USER_KEY, ROLE_KEY];

const memory = new Map();
let backend = null; // app: { get(key), set(key, value), remove(key) }, all async

const read = (key) => {
  if (IS_APP) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  if (IS_APP) {
    if (value == null) memory.delete(key);
    else memory.set(key, value);
    const done = value == null ? backend?.remove(key) : backend?.set(key, value);
    Promise.resolve(done).catch(() => {});
    return;
  }
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: the user will need to log in again next visit
  }
};

// App only: loads the saved session from `store` before the first screen renders.
export async function initSession(store) {
  backend = store;
  const values = await Promise.all(KEYS.map((key) => store.get(key).catch(() => null)));
  KEYS.forEach((key, i) => { if (values[i] != null) memory.set(key, values[i]); });
}

export const getToken = () => read(TOKEN_KEY);
export const getUserId = () => read(USER_KEY);
// Older sessions have no stored role: they were owner logins.
export const getRole = () => read(ROLE_KEY) || 'owner';
export const isLoggedIn = () => Boolean(getToken() && getUserId());

export function setSession({ token, userId, role }) {
  write(TOKEN_KEY, token);
  if (userId) write(USER_KEY, userId);
  if (role) write(ROLE_KEY, role);
}

export function clearSession() {
  KEYS.forEach((key) => write(key, null));
}
