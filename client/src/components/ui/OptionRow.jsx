import { Check } from 'lucide-react';

// A radio or checkbox row with the label on the left and the price on the right
// (the "Add Extra Additional" rows in the reference).
export function OptionRow({ type = 'checkbox', name, label, price, checked, onChange, disabled }) {
  return (
    <label className={`option-row ${type === 'radio' ? 'is-radio' : 'is-check'}`}>
      <input type={type} name={name} checked={checked} onChange={onChange} disabled={disabled} />
      <span className="option-mark" aria-hidden="true">
        <Check size={14} strokeWidth={3} />
      </span>
      <span className="option-label">{label}</span>
      {price !== undefined && <span className="option-price">{price}</span>}
    </label>
  );
}

export function OptionGroup({ title, hint, children }) {
  return (
    <fieldset className="option-group" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="option-group-title">
        {title}
        {hint && <span className="muted text-sm" style={{ fontWeight: 500, marginLeft: 8 }}>{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}
