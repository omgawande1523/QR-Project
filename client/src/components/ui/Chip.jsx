// A toggleable pill. `active` maps to aria-pressed so screen readers announce the state.
export function Chip({ active = false, icon, className = '', children, ...rest }) {
  return (
    <button type="button" className={`chip ${className}`} aria-pressed={active} {...rest}>
      {icon}
      {children}
    </button>
  );
}

// A horizontal, scrollable row of filter chips with single selection.
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {options.map((option) => (
        <Chip key={option.value} active={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
