import { initSession, getToken, setSession, isLoggedIn } from '../lib/session';
import { api, setDeviceName } from '../lib/api';
import { isNative, notifyAppResume } from '../lib/platform';
import { sessionStore } from './secureStorage';

const DAY_MS = 24 * 60 * 60 * 1000;

// App tokens last 30 days; renew once a day while the app is used, so staff stay signed in.
async function renewToken() {
  const token = getToken();
  if (!token || !isLoggedIn()) return;
  try {
    const { iat } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (Date.now() - iat * 1000 < DAY_MS) return;
    const res = await api.post('/api/sessions/refresh');
    setSession({ token: res.data.token });
  } catch {
    // offline or an old token: it keeps working until it expires, then the app asks to sign in
  }
}

// Runs before the first screen: loads the saved sign-in, and on a phone wires up the native side.
export async function boot() {
  await initSession(await sessionStore());
  if (!isNative()) return;

  const [{ App }, { Network }, { Device }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/network'),
    import('@capacitor/device')
  ]);
  // "Samsung SM-X200": shown in the signed-in devices list (the owner's own phone name may be personal).
  const info = await Device.getInfo().catch(() => null);
  if (info) setDeviceName(`${info.manufacturer || ''} ${info.model || ''}`.trim() || 'Android app');

  // Back in the foreground or back online: screens reconnect their live updates and refetch.
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    notifyAppResume('foreground');
    renewToken();
  });
  Network.addListener('networkStatusChange', ({ connected }) => { if (connected) notifyAppResume('online'); });
  renewToken();
}

// After the first screen has rendered: hide the splash screen.
export async function afterFirstRender() {
  if (!isNative()) return;
  const { SplashScreen } = await import('@capacitor/splash-screen');
  SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
}
