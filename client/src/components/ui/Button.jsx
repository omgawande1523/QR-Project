import { Link } from 'react-router';

// variant: primary | accent | secondary | ghost | danger | dark; size: sm | md | lg.
// Pass `to` for a router link, `href` for a plain link.
export function Button({ variant = 'primary', size = 'md', block = false, loading = false, icon, iconRight, to, href, className = '', children, disabled, ...rest }) {
  const classes = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" style={{ width: 18, height: 18 }} /> : icon}
      {children}
      {iconRight}
    </>
  );
  if (to) return <Link to={to} className={classes} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={classes} {...rest}>{content}</a>;
  return (
    <button type="button" className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}

// Round icon button; `label` is required because there is no visible text.
export function IconButton({ label, variant, count, className = '', children, to, ...rest }) {
  const classes = ['icon-btn', variant, className].filter(Boolean).join(' ');
  const badge = count > 0 ? <span className="count" aria-hidden="true">{count > 99 ? '99+' : count}</span> : null;
  if (to) {
    return (
      <Link to={to} className={classes} aria-label={count > 0 ? `${label} (${count})` : label} {...rest}>
        {children}
        {badge}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-label={count > 0 ? `${label} (${count})` : label} title={label} {...rest}>
      {children}
      {badge}
    </button>
  );
}
