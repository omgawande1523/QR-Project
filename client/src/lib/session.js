// The logged-in session (owner or staff). Keys match what the app stored before the redesign,
// so existing logins keep working. userId is always the restaurant; role says who is acting.
const TOKEN_KEY = 'token';
const USER_KEY = 'userId';
const ROLE_KEY = 'role';

const read = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getToken = () => read(TOKEN_KEY);
export const getUserId = () => read(USER_KEY);
// Older sessions have no stored role: they were owner logins.
export const getRole = () => read(ROLE_KEY) || 'owner';
export const isLoggedIn = () => Boolean(getToken() && getUserId());

export function setSession({ token, userId, role }) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    if (userId) window.localStorage.setItem(USER_KEY, userId);
    if (role) window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    // storage blocked: the user will need to log in again next visit
  }
}

export function clearSession() {
  try {
    [TOKEN_KEY, USER_KEY, ROLE_KEY].forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
