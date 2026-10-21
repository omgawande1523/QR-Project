import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { WifiOff, Download } from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { api } from '../lib/api';
import { popBack } from '../lib/backStack';
import { getRole, isLoggedIn } from '../lib/session';
import { homeFor } from '../lib/roles';
import { APP_VERSION, isNative, openExternal, onAppResume } from '../lib/platform';
import './app.css';

// Where a tapped notification leads: the kitchen to its display, everyone else to the order on the board
// (or the table requests).
export function pushTarget(data, role) {
  if (data.type === 'tableRequest') return '/dashboard/orders?requests=1';
  if (role === 'kitchen') return '/kitchen';
  return data.orderId ? `/dashboard/orders?order=${data.orderId}` : '/dashboard/orders';
}

// 1.10.0 > 1.9.3
export function olderThan(version, than) {
  const a = String(version).split('.').map(Number);
  const b = String(than).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  }
  return false;
}

// Android back button: close the open dialog or drawer, else go back, else leave the app from a home screen.
function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!isNative()) return undefined;
    let handle;
    import('@capacitor/app').then(({ App }) => App.addListener('backButton', () => {
      if (popBack()) return;
      const home = isLoggedIn() ? homeFor(getRole()) : '/login';
      if (location.pathname === home || location.pathname === '/login') App.exitApp();
      else if (window.history.state?.idx > 0) navigate(-1);
      else navigate(home, { replace: true });
    })).then((h) => { handle = h; });
    return () => { handle?.remove(); };
  }, [location.pathname, navigate]);
}

// Notifications: channels and listeners once, then register this device whenever someone is signed in.
function usePush() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!isNative()) return;
    import('../native/push').then(({ setupPush }) => setupPush((data) => navigate(pushTarget(data, getRole())))).catch(() => {});
  }, [navigate]);
  useEffect(() => {
    if (!isNative() || !isLoggedIn()) return;
    import('../native/push').then(({ registerPush }) => registerPush()).catch(() => {});
  }, [location.pathname]);
}

// Brand colours behind the status bar: cream on most screens, dark on the kitchen display.
function useStatusBar() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isNative()) return;
    const dark = pathname.startsWith('/kitchen');
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: dark ? '#1e2112' : '#faf6ee' }).catch(() => {});
    });
  }, [pathname]);
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let handle;
    if (isNative()) {
      import('@capacitor/network').then(async ({ Network }) => {
        setOnline((await Network.getStatus()).connected);
        handle = await Network.addListener('networkStatusChange', (s) => setOnline(s.connected));
      });
    }
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      handle?.remove();
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="app-offline" role="status">
      <WifiOff size={16} aria-hidden="true" /> No internet connection. Orders will update when you are back online.
    </div>
  );
}

// "Update available" (dismissible) or "Update required" (when this version is below the server's minimum).
function UpdatePrompt() {
  const [info, setInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const check = () => api.get('/api/app-version').then((res) => setInfo(res.data)).catch(() => {});
    check();
    return onAppResume(check);
  }, []);
  if (!info) return null;
  const required = olderThan(APP_VERSION, info.minVersion);
  const available = olderThan(APP_VERSION, info.latestVersion);
  if (!required && (!available || dismissed)) return null;
  return (
    <Modal
      open
      onClose={required ? undefined : () => setDismissed(true)}
      title={required ? 'Update required' : 'Update available'}
      footer={(
        <>
          {!required && <Button variant="secondary" onClick={() => setDismissed(true)}>Later</Button>}
          <Button icon={<Download size={18} />} onClick={() => openExternal(info.updateUrl)}>Update</Button>
        </>
      )}
    >
      <p>
        {required
          ? `This version of the app (${APP_VERSION}) no longer works with your restaurant's server. Please update to keep taking orders.`
          : `A new version of the app is ready (${info.latestVersion}; you have ${APP_VERSION}).`}
      </p>
    </Modal>
  );
}

// Everything the staff app adds around the shared screens.
export function AppShell({ children }) {
  useBackButton();
  usePush();
  useStatusBar();
  return (
    <>
      <OfflineBanner />
      {children}
      <UpdatePrompt />
    </>
  );
}
