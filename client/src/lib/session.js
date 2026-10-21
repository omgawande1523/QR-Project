// The logged-in owner's session. Keys match what the app stored before the redesign,
// so existing logins keep working.
const TOKEN_KEY = 'token';
const USER_KEY = 'userId';

const read = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getToken = () => read(TOKEN_KEY);
export const getUserId = () => read(USER_KEY);
export const isLoggedIn = () => Boolean(getToken() && getUserId());

export function setSession({ token, userId }) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    if (userId) window.localStorage.setItem(USER_KEY, userId);
  } catch {
    // storage blocked: the owner will need to log in again next visit
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}
