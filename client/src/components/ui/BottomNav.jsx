import { NavLink } from 'react-router';

// Dark rounded navigation bar with a raised centre action (the cart in the customer app).
// items: [{ to, label, icon, end?, onClick? }] - two on each side of `center`.
export function BottomNav({ items, center, label = 'Main' }) {
  const half = Math.ceil(items.length / 2);
  const renderItem = (item) => {
    if (item.onClick) {
      return (
        <button key={item.label} type="button" className="bottom-nav-item" onClick={item.onClick}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      );
    }
    return (
      <NavLink key={item.label} to={item.to} end={item.end} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        {item.icon}
        <span>{item.label}</span>
      </NavLink>
    );
  };
  return (
    <nav className="bottom-nav no-print" aria-label={label}>
      {items.slice(0, half).map(renderItem)}
      <NavLink to={center.to} className="bottom-nav-center" aria-label={center.count ? `${center.label} (${center.count})` : center.label}>
        {center.icon}
        {center.count > 0 && <span key={center.count} className="count pop" aria-hidden="true">{center.count}</span>}
      </NavLink>
      {items.slice(half).map(renderItem)}
    </nav>
  );
}
