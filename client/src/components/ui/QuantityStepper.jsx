import { Minus, Plus, Trash2 } from 'lucide-react';

// − n + control. With `removable`, the minus button becomes a bin at quantity 1 and calls onChange(0).
export function QuantityStepper({ value, onChange, min = 1, max = 50, size = 'md', tone, removable = false, label = 'Quantity', className = '' }) {
  const atMin = value <= min;
  const showBin = removable && value <= 1;
  const classes = ['stepper', size === 'sm' && 'stepper-sm', tone === 'on-primary' && 'stepper-on-primary', className].filter(Boolean).join(' ');
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <div className={classes} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(showBin ? 0 : value - 1)}
        disabled={atMin && !showBin}
        aria-label={showBin ? 'Remove' : 'Decrease'}
      >
        {showBin ? <Trash2 size={iconSize} /> : <Minus size={iconSize} />}
      </button>
      <span className="stepper-value" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase">
        <Plus size={iconSize} />
      </button>
    </div>
  );
}
