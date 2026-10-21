import { useState } from 'react';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button, TextField, EmptyState } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/users/forgot-password', { email: email.trim() });
      setSent(res.data.message);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the reset code'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We will email you an 8-character reset code."
      footer={<><Link to="/login">Back to log in</Link></>}
    >
      {sent ? (
        <EmptyState icon={<MailCheck size={30} />} title="Check your email" action={<Button to={`/reset-password?email=${encodeURIComponent(email.trim())}`}>Enter the code</Button>}>
          {sent}
        </EmptyState>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          {error && <div className="notice notice-danger" role="alert">{error}</div>}
          <Button type="submit" size="lg" block loading={loading} disabled={!email.trim()}>Send reset code</Button>
          <Link to="/reset-password" className="text-sm bold tap-link" style={{ alignSelf: 'center' }}>I already have a code</Link>
        </form>
      )}
    </AuthLayout>
  );
}
