import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { Button, TextField } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: params.get('email') || '', token: params.get('token') || '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const mismatch = form.confirm && form.confirm !== form.newPassword;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) return setError('Use at least 8 characters for the new password');
    if (mismatch) return setError('The passwords do not match');
    setLoading(true);
    try {
      await api.post('/api/users/reset-password', { email: form.email.trim(), token: form.token.trim(), newPassword: form.newPassword });
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not reset your password'));
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Enter the code from your email." footer={<Link to="/login">Back to log in</Link>}>
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        <TextField label="Reset code" value={form.token} onChange={set('token')} autoComplete="one-time-code" placeholder="8 characters" style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }} required />
        <PasswordField label="New password" value={form.newPassword} onChange={set('newPassword')} hint="At least 8 characters" autoComplete="new-password" required />
        <PasswordField label="Confirm new password" value={form.confirm} onChange={set('confirm')} error={mismatch ? 'Passwords do not match' : undefined} autoComplete="new-password" required />
        {error && <div className="notice notice-danger" role="alert">{error}</div>}
        <Button type="submit" size="lg" block loading={loading} disabled={!form.email || !form.token || !form.newPassword}>Reset password</Button>
      </form>
    </AuthLayout>
  );
}
