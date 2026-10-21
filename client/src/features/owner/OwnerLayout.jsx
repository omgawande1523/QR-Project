import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, ClipboardList, UtensilsCrossed, QrCode, Settings, LogOut, Menu as MenuIcon, X, ExternalLink, Bell, Wifi, WifiOff, ChefHat, Users, BarChart3 } from 'lucide-react';
import { OwnerProvider, useOwner } from './OwnerContext';
import { Brand } from '../auth/AuthLayout';
import { BottomSheet, Button, EmptyState, IconButton, Switch } from '../../components/ui';
import { isLoggedIn, clearSession } from '../../lib/session';
import { timeAgo } from '../../lib/format';
import { can, ROLE_LABEL } from '../../lib/roles';
import './owner.css';

const NAV = [
  { to: '/dashboard', label: 'Home', Icon: LayoutDashboard, end: true, area: 'home' },
  { to: '/dashboard/orders', label: 'Orders', Icon: ClipboardList, badge: 'orders', area: 'orders' },
  { to: '/dashboard/menu', label: 'Menu', Icon: UtensilsCrossed, area: 'menu' },
  { to: '/dashboard/tables', label: 'Tables & QR', Icon: QrCode, area: 'tables' },
  { to: '/dashboard/analytics', label: 'Analytics', Icon: BarChart3, area: 'analytics' },
  { to: '/dashboard/staff', label: 'Staff', Icon: Users, area: 'staff' },
  { to: '/dashboard/settings', label: 'Settings', Icon: Settings, area: 'settings' }
];

function Sidebar({ open, onClose }) {
  const { userId, orders, role, me } = useOwner();
  const navigate = useNavigate();
  const newOrders = orders.filter((o) => o.status === 'pending').length;
  const logout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };
  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Dashboard navigation">
        <div className="sidebar-head">
          <Brand light />
          <IconButton label="Close menu" className="sidebar-close" onClick={onClose}><X size={20} /></IconButton>
        </div>
        <nav className="sidebar-nav">
          {NAV.filter((item) => can(role, item.area)).map(({ to, label, Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
              <Icon size={20} aria-hidden="true" />
              <span className="grow">{label}</span>
              {badge === 'orders' && newOrders > 0 && <span className="sidebar-badge" aria-label={`${newOrders} new`}>{newOrders}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="sidebar-user"><strong className="truncate">{me.name || ' '}</strong><span>{ROLE_LABEL[role]}</span></p>
          <NavLink to="/kitchen" className="sidebar-link">
            <ChefHat size={20} aria-hidden="true" /><span>Kitchen display</span>
          </NavLink>
          <a className="sidebar-link" href={`/menu/${userId}?table=1`} target="_blank" rel="noreferrer">
            <ExternalLink size={20} aria-hidden="true" /><span>Customer menu</span>
          </a>
          <button type="button" className="sidebar-link" onClick={logout}>
            <LogOut size={20} aria-hidden="true" /><span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function RequestsSheet({ open, onClose }) {
  const { requests, markRequestHandled } = useOwner();
  return (
    <BottomSheet open={open} onClose={onClose} title="Table requests">
      {requests.length === 0 ? (
        <EmptyState icon={<Bell size={28} />} title="All caught up">No tables are waiting for anything.</EmptyState>
      ) : (
        <ul className="request-list">
          {requests.map((r) => (
            <li key={r._id} className="request-row">
              <span className="request-table">T{r.tableNumber}</span>
              <div className="grow">
                <strong>{r.type === 'Bill' ? 'Asked for the bill' : r.type}</strong>
                <p className="muted text-xs">{r.customerName || 'Guest'} · {timeAgo(r.timestamp)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => markRequestHandled(r._id)}>Done</Button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}

function Topbar({ onMenu }) {
  const { profile, saveProfile, requests, connected, role } = useOwner();
  const [requestsOpen, setRequestsOpen] = useState(false);
  return (
    <header className="topbar no-print">
      <IconButton label="Open menu" className="topbar-menu" onClick={onMenu}><MenuIcon size={20} /></IconButton>
      <div className="grow topbar-title">
        <strong className="truncate">{profile?.restaurantName || ' '}</strong>
        <span className={`live-dot ${connected ? 'is-live' : ''}`}>
          {connected ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
          {connected ? 'Live' : 'Reconnecting'}
        </span>
      </div>
      {profile && can(role, 'accepting') && (
        <div className="topbar-accepting">
          <Switch
            checked={profile.acceptingOrders !== false}
            onChange={(on) => saveProfile({ acceptingOrders: on }, { silent: true })}
            label={<span className="hide-sm">{profile.acceptingOrders !== false ? 'Accepting orders' : 'Orders paused'}</span>}
          />
        </div>
      )}
      {can(role, 'requests') && (
        <>
          <IconButton label="Table requests" count={requests.length} onClick={() => setRequestsOpen(true)}><Bell size={20} /></IconButton>
          <RequestsSheet open={requestsOpen} onClose={() => setRequestsOpen(false)} />
        </>
      )}
    </header>
  );
}

function Shell() {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);
  return (
    <div className="owner">
      <Sidebar open={drawer} onClose={() => setDrawer(false)} />
      <div className="owner-main">
        <Topbar onMenu={() => setDrawer(true)} />
        <main className="owner-content page-enter" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Route element for /dashboard/*: requires a login.
export default function OwnerLayout() {
  const location = useLocation();
  if (!isLoggedIn()) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return (
    <OwnerProvider>
      <Shell />
    </OwnerProvider>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="owner-page-header">
      <div className="grow">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}
