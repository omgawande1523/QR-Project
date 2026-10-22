import { useEffect, useState } from 'react';
import { BellRing, Copy } from 'lucide-react';
import { useOwner } from './OwnerContext';
import { PageHeader } from './OwnerLayout';
import { Button, Skeleton, Switch, TextField, SelectField, useToast } from '../../components/ui';
import { Section } from './SettingsSection';
import { DevicesSection, AppNotificationsSection, AboutSection, DeleteAccountSection } from './AccountSections';
import { IS_APP } from '../../lib/platform';
import { PasswordField } from '../auth/PasswordField';
import { api, errorMessage } from '../../lib/api';
import { setSession } from '../../lib/session';
import { ImagePicker } from '../../components/ImagePicker';
import { computeBill } from '../../lib/pricing';
import { formatPrice } from '../../lib/format';
import { DAY_NAMES } from '../../lib/hours';
import { can, ROLE_LABEL } from '../../lib/roles';

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const defaultHours = () => WEEK.map((day) => ({ day, open: '09:00', close: '22:00', closed: false }));

export default function SettingsPage() {
  const { profile, saveProfile, alerts, setAlerts, role, me } = useOwner();
  const isStaff = role !== 'owner';
  const manages = can(role, 'restaurantSettings');
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [billing, setBilling] = useState(null);
  const [hours, setHours] = useState(null);
  const [saving, setSaving] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  useEffect(() => {
    if (!profile || info) return;
    setInfo({ restaurantName: profile.restaurantName || '', tagline: profile.tagline || '', address: profile.address || '', profilePicture: profile.profilePicture || '', bannerImage: profile.bannerImage || '' });
    setBilling({ gstin: profile.gstin || '', upiId: profile.upiId || '', taxPercent: String(profile.taxPercent ?? 0), serviceChargePercent: String(profile.serviceChargePercent ?? 0) });
    const byDay = new Map((profile.openingHours || []).map((h) => [h.day, h]));
    setHours(profile.openingHours?.length ? WEEK.map((day) => byDay.get(day) || { day, open: '09:00', close: '22:00', closed: true }) : defaultHours());
  }, [profile, info]);

  if (!profile || !info) return <Skeleton height={500} radius="var(--radius-card)" />;

  const save = async (key, patch, message = 'Saved') => {
    setSaving(key);
    try {
      await saveProfile(patch, { silent: true });
      toast.success(message);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(null);
    }
  };

  const example = computeBill([{ unitPaise: 100000, quantity: 1 }], { taxPercent: Number(billing.taxPercent) || 0, serviceChargePercent: Number(billing.serviceChargePercent) || 0 });
  const setHour = (day, field, value) => setHours((list) => list.map((h) => (h.day === day ? { ...h, [field]: value } : h)));
  const copyMonday = () => {
    const monday = hours.find((h) => h.day === 1);
    setHours((list) => list.map((h) => ({ ...h, open: monday.open, close: monday.close, closed: monday.closed })));
  };

  const enableBrowserAlerts = async (on) => {
    if (!on) return setAlerts({ browser: false });
    if (!('Notification' in window)) return toast.error('This browser does not support notifications');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return toast.error('Notifications are blocked for this site in your browser settings');
    setAlerts({ browser: true });
    return toast.success('You will be notified of new orders when this tab is in the background');
  };

  const changePassword = async () => {
    if (passwords.newPassword.length < 8) return toast.error('Use at least 8 characters');
    if (passwords.newPassword !== passwords.confirm) return toast.error('The new passwords do not match');
    setSaving('password');
    try {
      // Staff change their own login; the owner changes the restaurant account's password.
      const body = { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword };
      const res = isStaff ? await api.post('/api/staff/me/password', body) : await api.post(`/api/users/${profile._id}/change-password`, body);
      setSession({ token: res.data.token });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the password'));
    } finally {
      setSaving(null);
    }
    return undefined;
  };

  return (
    <>
      <PageHeader title="Settings" subtitle={manages ? 'What customers see, how bills are calculated, and your account.' : 'Alerts on this device and your password.'} />
      <div className="settings-grid">
        {manages && (
        <>
        <Section title="Restaurant profile" description="Shown on the welcome screen when customers scan a table QR code." onSave={() => save('info', { ...info, restaurantName: info.restaurantName.trim() })} saving={saving === 'info'}>
          <TextField label="Restaurant name" value={info.restaurantName} onChange={(e) => setInfo({ ...info, restaurantName: e.target.value })} maxLength={100} />
          <TextField label="Tagline" value={info.tagline} onChange={(e) => setInfo({ ...info, tagline: e.target.value })} maxLength={120} hint="One short line, e.g. Fresh South Indian breakfasts" />
          <TextField label="Address" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} maxLength={200} />
          <div className="row wrap" style={{ alignItems: 'flex-start', gap: 'var(--space-6)' }}>
            <div style={{ width: 170 }}>
              <ImagePicker kind="profile" label="Logo" value={info.profilePicture} onChange={(url) => setInfo({ ...info, profilePicture: url })} />
            </div>
            <div className="grow" style={{ minWidth: 220 }}>
              <ImagePicker kind="banner" label="Banner photo" value={info.bannerImage} onChange={(url) => setInfo({ ...info, bannerImage: url })} />
            </div>
          </div>
        </Section>

        <Section title="Billing and tax" description="Used by the server to price every order." onSave={() => save('billing', { gstin: billing.gstin.trim(), upiId: billing.upiId.trim(), taxPercent: Number(billing.taxPercent) || 0, serviceChargePercent: Number(billing.serviceChargePercent) || 0 })} saving={saving === 'billing'}>
          <TextField label="GSTIN" value={billing.gstin} onChange={(e) => setBilling({ ...billing, gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="27ABCDE1234F1Z5" hint="Printed on invoices. Leave empty if you are not GST registered." />
          <TextField label="UPI ID" value={billing.upiId} onChange={(e) => setBilling({ ...billing, upiId: e.target.value })} maxLength={60} placeholder="restaurant@okaxis" hint="Unpaid bills show a QR code guests can scan with any UPI app." />
          <div className="form-grid">
            <SelectField label="GST rate" value={billing.taxPercent} onChange={(e) => setBilling({ ...billing, taxPercent: e.target.value })}
              options={['0', '5', '12', '18'].map((v) => ({ value: v, label: v === '0' ? 'No GST' : `${v}%` }))} hint="Most restaurants charge 5%" />
            <TextField label="Service charge %" type="number" min="0" max="20" step="0.5" value={billing.serviceChargePercent} onChange={(e) => setBilling({ ...billing, serviceChargePercent: e.target.value })} hint="Optional; must be voluntary for guests" />
            <SelectField label="Currency" value="INR" onChange={() => {}} options={[{ value: 'INR', label: 'Indian Rupee (₹)' }]} disabled />
          </div>
          <div className="bill-preview">
            <p className="field-label">Example bill for a ₹1,000 order</p>
            <div className="kv"><span>Subtotal</span><span>{formatPrice(example.subtotal)}</span></div>
            {example.serviceCharge > 0 && <div className="kv"><span>Service charge ({example.serviceChargePercent}%)</span><span>{formatPrice(example.serviceCharge)}</span></div>}
            {example.tax > 0 && <div className="kv"><span>GST ({example.taxPercent}%)</span><span>{formatPrice(example.tax)}</span></div>}
            <div className="kv kv-total"><span>Total</span><span>{formatPrice(example.total)}</span></div>
          </div>
        </Section>

        <Section title="Opening hours" description="Customers see whether you are open now." onSave={() => save('hours', { openingHours: hours })} saving={saving === 'hours'}>
          <ul className="hours-list">
            {hours.map((h) => (
              <li key={h.day} className="hours-row">
                <span className="hours-day">{DAY_NAMES[h.day]}</span>
                <Switch checked={!h.closed} onChange={(open) => setHour(h.day, 'closed', !open)} label={<span className="text-sm">{h.closed ? 'Closed' : 'Open'}</span>} />
                <input type="time" className="input" value={h.open} disabled={h.closed} onChange={(e) => setHour(h.day, 'open', e.target.value)} aria-label={`${DAY_NAMES[h.day]} opening time`} />
                <span className="muted" aria-hidden="true">to</span>
                <input type="time" className="input" value={h.close} disabled={h.closed} onChange={(e) => setHour(h.day, 'close', e.target.value)} aria-label={`${DAY_NAMES[h.day]} closing time`} />
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" icon={<Copy size={16} />} onClick={copyMonday}>Copy Monday to every day</Button>
        </Section>

        </>
        )}

        <Section title={manages ? 'Orders and alerts' : 'Alerts'}>
          {manages && (
            <>
              <Switch checked={profile.acceptingOrders !== false} onChange={(on) => save('accepting', { acceptingOrders: on }, on ? 'Accepting orders' : 'Orders paused')} label={profile.acceptingOrders !== false ? 'Accepting orders' : 'Orders paused (customers can still browse)'} />
              <hr className="divider" />
            </>
          )}
          <p className="muted text-sm">Alerts on this device:</p>
          <Switch checked={alerts.sound} onChange={(on) => setAlerts({ sound: on })} label="Sound for new orders and table requests" />
          <Switch checked={alerts.voice} onChange={(on) => setAlerts({ voice: on })} label="Read new orders aloud" />
          {!IS_APP && <Switch checked={alerts.browser} onChange={enableBrowserAlerts} label={<span className="row" style={{ gap: 6 }}><BellRing size={16} aria-hidden="true" /> Browser notifications when this tab is hidden</span>} />}
          <Button variant="secondary" size="sm" onClick={() => new Audio('/notification.wav').play().catch(() => toast.error('Click anywhere on the page first, then try again'))}>Play test sound</Button>
        </Section>

        <Section title={isStaff ? 'Your password' : 'Account'} description={isStaff ? `Signed in as ${me.name || 'staff'} (${ROLE_LABEL[role]})` : `Signed in as ${profile.email}${profile.phoneNumber ? ` · ${profile.phoneNumber}` : ''}`}>
          <PasswordField label="Current password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} autoComplete="current-password" />
          <div className="form-grid">
            <PasswordField label="New password" hint="At least 8 characters" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} autoComplete="new-password" />
            <PasswordField label="Confirm new password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} autoComplete="new-password" />
          </div>
          <div><Button variant="secondary" onClick={changePassword} loading={saving === 'password'} disabled={!passwords.currentPassword || !passwords.newPassword}>Change password</Button></div>
        </Section>

        <AppNotificationsSection role={role} />
        <DevicesSection />
        <AboutSection />
        <DeleteAccountSection isStaff={isStaff} />
      </div>
    </>
  );
}
