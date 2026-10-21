import { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router';
import { AuthLayout } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { Button, TextField } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { setSession, isLoggedIn, getRole } from '../../lib/session';
import { homeFor } from '../../lib/roles';

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoggedIn()) return <Navigate to={homeFor(getRole())} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/users/login', { identifier: identifier.trim(), password });
      setSession(res.data);
      const next = params.get('next') || '';
      // Pages a role cannot use send it on to its own start page (see RoleGate).
      navigate(/^\/(dashboard|kitchen)(\/|$)/.test(next) ? next : homeFor(res.data.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not log in'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage orders and your menu."
      footer={<>New here? <Link to="/register">Create your restaurant</Link></>}
    >
      {params.get('expired') && <div className="notice notice-info" role="status">Your session ended. Please log in again.</div>}
      {params.get('reset') && <div className="notice notice-info" role="status">Password changed. Log in with your new password.</div>}
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="Email or phone" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoFocus />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <div className="row-between">
          <span />
          <Link to="/forgot-password" className="text-sm bold tap-link">Forgot password?</Link>
        </div>
        {error && <div className="notice notice-danger" role="alert">{error}</div>}
        <Button type="submit" size="lg" block loading={loading} disabled={!identifier || !password}>Log in</Button>
        <Button variant="ghost" to="/demo">Just looking? Try the live demo</Button>
      </form>
    </AuthLayout>
  );
}
