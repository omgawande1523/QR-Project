import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Monitor, Smartphone, LogOut, BellRing, Trash2, ShieldCheck, ExternalLink } from 'lucide-react';
import { Section } from './SettingsSection';
import { Badge, Button, Skeleton, Switch, TextField, useToast } from '../../components/ui';
import { PasswordField } from '../auth/PasswordField';
import { api, errorMessage } from '../../lib/api';
import { setSession, clearSession } from '../../lib/session';
import { signOut } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { NOTIFICATIONS } from '../../lib/roles';
import { APP_VERSION, IS_APP, isIOS, isNative, openExternal, siteOrigin } from '../../lib/platform';

const PLATFORM_LABEL = { ios: ' (iPhone/iPad)', android: ' (Android)', web: '' };

// Every browser and phone signed in to this login, with "Sign out" per device and "Sign out everywhere".
export function DevicesSection() {
  const toast = useToast();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => api.get('/api/sessions').then((res) => setSessions(res.data)).catch(() => setSessions([])), []);
  useEffect(() => { load(); }, [load]);

  const signOutDevice = async (session) => {
    if (session.current) {
      await signOut();
      navigate('/login', { replace: true });
      return;
    }
    setBusy(session.id);
    try {
      await api.delete(`/api/sessions/${session.id}`);
      toast.success(`${session.deviceName} signed out`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not sign out that device'));
    } finally {
      setBusy(null);
    }
  };

  const signOutEverywhere = async () => {
    if (!window.confirm('Sign out every other browser and phone? This device stays signed in.')) return;
    setBusy('all');
    try {
      const res = await api.post('/api/sessions/sign-out-everywhere');
      setSession({ token: res.data.token });
      toast.success('Signed out everywhere else');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not sign out the other devices'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Signed-in devices" description="Browsers and phones signed in to this login. Sign out any you do not recognise.">
      {!sessions ? <Skeleton height={120} /> : (
        <ul className="device-list">
          {sessions.map((s) => (
            <li key={s.id} className="device-row">
              <span className="device-icon" aria-hidden="true">{s.client === 'app' ? <Smartphone size={20} /> : <Monitor size={20} />}</span>
              <div className="grow">
                <p className="row" style={{ gap: 'var(--space-2)' }}>
                  <strong className="truncate">{s.deviceName}</strong>
                  {s.current && <Badge tone="accent">This device</Badge>}
                </p>
                <p className="muted text-xs">{s.client === 'app' ? `Staff app${PLATFORM_LABEL[s.platform] || ''}` : 'Website'} · active {timeAgo(s.lastActiveAt)}{s.notifications ? ' · notifications on' : ''}</p>
              </div>
              <Button size="sm" variant="secondary" icon={<LogOut size={16} />} onClick={() => signOutDevice(s)} loading={busy === s.id} aria-label={`Sign out ${s.deviceName}${s.current ? ' (this device)' : ''}`}>Sign out</Button>
            </li>
          ))}
        </ul>
      )}
      <div><Button variant="secondary" onClick={signOutEverywhere} loading={busy === 'all'} disabled={!sessions || sessions.length < 2}>Sign out everywhere else</Button></div>
    </Section>
  );
}

// Where to turn notifications back on after saying no to the permission question.
const notificationSettingsHint = () => (isIOS()
  ? 'Notifications are off for QR Menu Staff. Turn them on in Settings > Notifications > QR Menu Staff.'
  : 'Notifications are off for QR Menu Staff. Turn them on in Android Settings > Apps > QR Menu Staff > Notifications.');

// App only: the notification permission and a switch per notification type for this phone.
export function AppNotificationsSection({ role }) {
  const toast = useToast();
  const [permission, setPermission] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const types = NOTIFICATIONS.filter((n) => n.roles.includes(role));

  const refresh = useCallback(async () => {
    if (!IS_APP) return;
    const { pushPermission } = await import('../../native/push');
    setPermission(await pushPermission());
    const res = await api.get('/api/sessions').catch(() => null);
    setPrefs(res?.data.find((s) => s.current)?.prefs || {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (!isNative() || permission === 'unavailable' || !types.length) return null;

  const turnOn = async () => {
    if (!IS_APP) return;
    const { registerPush } = await import('../../native/push');
    const result = await registerPush();
    if (result !== 'granted') toast.error(notificationSettingsHint());
    refresh();
  };

  const toggle = async (type, on) => {
    setPrefs((p) => ({ ...p, [type]: on }));
    try {
      await api.put('/api/sessions/current/push', { prefs: { [type]: on } });
    } catch (err) {
      setPrefs((p) => ({ ...p, [type]: !on }));
      toast.error(errorMessage(err, 'Could not save'));
    }
  };

  return (
    <Section title="Notifications on this phone" description="Alerts arrive even when the app is closed or the phone is locked, each type with its own sound.">
      {permission !== 'granted' ? (
        <>
          <p className="text-sm">Notifications are off for this phone.</p>
          <div><Button icon={<BellRing size={18} />} onClick={turnOn}>Turn on notifications</Button></div>
        </>
      ) : (
        types.map((n) => (
          <Switch key={n.type} checked={prefs?.[n.type] !== false} onChange={(on) => toggle(n.type, on)} label={n.label} disabled={!prefs} />
        ))
      )}
    </Section>
  );
}

// The privacy policy (required in the app by the App Store) and the app version.
export function AboutSection() {
  return (
    <Section title="Privacy and about" description={IS_APP ? `QR Menu Staff ${APP_VERSION}` : undefined}>
      <p className="text-sm">How QR Menu handles your restaurant's data and your guests' orders.</p>
      <div>
        <Button variant="secondary" icon={<ShieldCheck size={18} />} onClick={() => openExternal(`${siteOrigin()}/privacy`)}>
          Privacy policy <ExternalLink size={14} aria-hidden="true" />
        </Button>
      </div>
    </Section>
  );
}

// Deletes the account from inside the website or the app (the App Store requires the app to offer it): the
// password, and for an owner, who deletes the whole restaurant, the word DELETE typed out as well.
export const confirmsDelete = (text) => text.trim().toUpperCase() === 'DELETE';
export function DeleteAccountSection({ isStaff }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (isStaff && !window.confirm('Delete your login? You will be signed out and will need a new invitation from the owner.')) return;
    setBusy(true);
    try {
      await api.post('/api/users/delete-account', isStaff ? { password } : { password, confirm: typed });
      clearSession();
      toast.success(isStaff ? 'Your login has been deleted' : 'Your restaurant account has been deleted');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the account'));
      setBusy(false);
    }
  };

  return (
    <Section
      title="Delete account"
      className="settings-danger"
      description={isStaff
        ? 'Deletes your own login. The restaurant and its orders stay.'
        : 'Deletes the restaurant with its menu, orders, bills, guest ratings, staff logins and photos. Download any bills you need first.'}
    >
      <PasswordField label="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      {!isStaff && (
        <TextField
          label="Type DELETE to confirm"
          hint="The restaurant and everything in it is deleted for good. This cannot be undone."
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      )}
      <div><Button variant="danger" icon={<Trash2 size={18} />} onClick={remove} loading={busy} disabled={!password || (!isStaff && !confirmsDelete(typed))}>{isStaff ? 'Delete my login' : 'Delete restaurant account'}</Button></div>
    </Section>
  );
}
