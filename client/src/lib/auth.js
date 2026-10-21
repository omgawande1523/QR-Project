import { api } from './api';
import { clearSession, getToken } from './session';

// Things to undo on this device when someone signs out (the app removes its push registration).
const signOutHooks = new Set();
export const onSignOut = (fn) => {
  signOutHooks.add(fn);
  return () => signOutHooks.delete(fn);
};

// Signs out this device: ends the session on the server (which also stops its push notifications and
// drops it from the signed-in devices list), then forgets it locally. Works offline too.
export async function signOut() {
  if (getToken()) {
    await Promise.allSettled([...signOutHooks].map((fn) => fn()));
    await api.delete('/api/sessions/current', { timeout: 5000 }).catch(() => {});
  }
  clearSession();
}
