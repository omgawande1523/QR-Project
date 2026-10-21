import { useState } from 'react';
import { LegalLayout, ContactLine } from './LegalLayout';
import { Button, TextField } from '../../components/ui';
import { PasswordField } from '../auth/PasswordField';
import { api, errorMessage } from '../../lib/api';
import { APP_NAME } from '../../config';

// Public account deletion (the Play Store asks for a web page as well as the in-app option). Signs in with
// the email and password, then deletes the account with the same password.
export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const login = await api.post('/api/users/login', { identifier: email.trim(), password });
      const res = await api.post('/api/users/delete-account', { password }, { headers: { Authorization: `Bearer ${login.data.token}` } });
      setDone(res.data.message);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the account'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LegalLayout title="Delete your account">
      <p>
        You can delete your {APP_NAME} account here, or in <strong>Settings &gt; Delete account</strong> on the website
        or in the {APP_NAME} Staff app.
      </p>
      <ul>
        <li><strong>Restaurant owners</strong>: the restaurant is deleted with everything in it: menu and photos, orders and bills, guest ratings, staff logins and every signed-in device. This cannot be undone. Download any bills you need to keep first.</li>
        <li><strong>Staff</strong>: only your own login is deleted. The restaurant and its orders stay.</li>
      </ul>
      <p>Prefer to ask? Write to <ContactLine /> from the account&apos;s email address and we will delete it within 7 days.</p>

      {done ? (
        <div className="notice notice-info" role="status">{done}.</div>
      ) : (
        <form className="stack legal-form" onSubmit={submit} noValidate>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          <label className="row" style={{ alignItems: 'flex-start', minHeight: 'var(--tap)' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
            <span>I understand that this permanently deletes my account and its data.</span>
          </label>
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <Button type="submit" variant="danger" size="lg" loading={busy} disabled={!email.trim() || !password || !confirmed}>Delete my account</Button>
        </form>
      )}
    </LegalLayout>
  );
}
