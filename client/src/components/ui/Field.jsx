import { useId } from 'react';

// Label + control + hint/error, wired with ids for screen readers.
export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const control = typeof children === 'function'
    ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
    : children;
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      {control}
      {hint && !error && <span id={hintId} className="field-hint">{hint}</span>}
      {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export function TextField({ label, hint, error, multiline = false, className, ...inputProps }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(a11y) => (multiline
        ? <textarea className="textarea" {...a11y} {...inputProps} />
        : <input className="input" {...a11y} {...inputProps} />)}
    </Field>
  );
}

export function SelectField({ label, hint, error, options, className, ...selectProps }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(a11y) => (
        <select className="select" {...a11y} {...selectProps}>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

// `ariaLabel` names the switch when the visible label can be hidden (e.g. on small screens).
export function Switch({ checked, onChange, label, disabled, ariaLabel }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} aria-label={ariaLabel} />
      <span className="switch-track" aria-hidden="true" />
      {label}
    </label>
  );
}
