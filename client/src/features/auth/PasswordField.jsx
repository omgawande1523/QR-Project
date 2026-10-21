import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from '../../components/ui';

export function PasswordField({ label = 'Password', hint, error, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {(a11y) => (
        <div className="password-input">
          <input className="input" type={visible ? 'text' : 'password'} {...a11y} {...inputProps} />
          <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      )}
    </Field>
  );
}
