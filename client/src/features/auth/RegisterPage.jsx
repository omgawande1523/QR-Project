import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router';
import { AuthLayout } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { Button, TextField } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { setSession, isLoggedIn } from '../../lib/session';
import { isIOS } from '../../lib/platform';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ restaurantName: '', email: '', phoneNumber: '', password: '', tableCount: '5' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoggedIn()) return <Navigate to="/dashboard" replace />;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.restaurantName.trim()) next.restaurantName = 'Enter your restaurant name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (form.password.length < 8) next.password = 'Use at least 8 characters';
    const tables = Number(form.tableCount);
    if (!Number.isInteger(tables) || tables < 1 || tables > 200) next.tableCount = 'Between 1 and 200 tables';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post('/api/users/register', {
        restaurantName: form.restaurantName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim() || undefined,
        password: form.password,
        tables: Array.from({ length: Number(form.tableCount) }, (_, i) => i + 1)
      });
      setSession(res.data);
      navigate('/dashboard?welcome=1', { replace: true });
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(Object.fromEntries(details.map((d) => [d.field, d.message])));
      setError(errorMessage(err, 'Could not create your account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your restaurant"
      subtitle="Set up your digital menu in a few minutes. No card needed."
      footer={<>Already have an account? <Link to="/login">Log in</Link></>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="Restaurant name" value={form.restaurantName} onChange={set('restaurantName')} error={errors.restaurantName} autoComplete="organization" required autoFocus={!isIOS()} />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" required />
        <TextField label="Mobile number" hint="Optional. You can log in with it too." type="tel" inputMode="tel" value={form.phoneNumber} onChange={set('phoneNumber')} error={errors.phoneNumber} autoComplete="tel" />
        <PasswordField value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters" autoComplete="new-password" required />
        <TextField label="Number of tables" type="number" min="1" max="200" inputMode="numeric" value={form.tableCount} onChange={set('tableCount')} error={errors.tableCount} hint="You can add or remove tables later" />
        {error && <div className="notice notice-danger" role="alert">{error}</div>}
        <Button type="submit" size="lg" block loading={loading}>Create account</Button>
      </form>
    </AuthLayout>
  );
}
