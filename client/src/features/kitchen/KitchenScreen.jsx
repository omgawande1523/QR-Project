import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { Maximize, Minimize, Sun, SunDim, Undo2, Volume2, VolumeX, ArrowLeft, StickyNote, ChefHat } from 'lucide-react';
import { OwnerProvider, useOwner } from '../owner/OwnerContext';
import { isLoggedIn } from '../../lib/session';
import { useNow } from '../../lib/useNow';
import './kitchen.css';

// The kitchen only works on orders that are new or being cooked.
const KITCHEN_STATUSES = ['pending', 'process'];
const NEXT = { pending: 'process', process: 'ready' };
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'New' },
  { value: 'process', label: 'Cooking' }
];

const shortId = (id) => String(id).slice(-4).toUpperCase();

function elapsed(createdAt, now) {
  const seconds = Math.max(0, Math.floor((now - new Date(createdAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return { minutes, label: `${minutes}:${String(seconds % 60).padStart(2, '0')}` };
}

// Green under 10 minutes, amber under 20, red after that.
const ageClass = (minutes) => (minutes >= 20 ? 'is-late' : minutes >= 10 ? 'is-warm' : 'is-fresh');

function Ticket({ order, now, onBump, busy }) {
  const age = elapsed(order.createdAt, now);
  const isNew = order.status === 'pending';
  return (
    <article className={`ticket ${ageClass(age.minutes)} ${isNew ? 'is-new' : ''}`} aria-label={`Table ${order.tableNumber}, ${isNew ? 'new' : 'cooking'}`}>
      <header className="ticket-head">
        <span className="ticket-table">T{order.tableNumber}</span>
        <div className="ticket-meta">
          <span className="ticket-status">{isNew ? 'NEW' : 'COOKING'}</span>
          <span>#{shortId(order._id)}{order.customerName ? ` · ${order.customerName}` : ''}</span>
        </div>
        <span className="ticket-timer" aria-label={`Waiting ${age.minutes} minutes`}>{age.label}</span>
      </header>
      <ul className="ticket-items">
        {order.items.map((item, i) => (
          <li key={item._id || i}>
            <span className="ticket-qty">{item.quantity}</span>
            <span className="ticket-name">
              {item.menuItemName}
              {(item.variant?.name || item.addOns?.length > 0) && (
                <span className="ticket-options">{[item.variant?.name, ...(item.addOns || []).map((a) => `+ ${a.name}`)].filter(Boolean).join('  ')}</span>
              )}
              {item.notes && <span className="ticket-note"><StickyNote size={16} aria-hidden="true" /> {item.notes}</span>}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className={`ticket-bump ${isNew ? 'is-start' : ''}`} onClick={() => onBump(order)} disabled={busy}>
        {busy ? '…' : isNew ? 'Start cooking' : 'Bump · Ready'}
      </button>
    </article>
  );
}

function Kitchen() {
  const { orders, ordersLoaded, setOrderStatus, profile, connected, alerts, setAlerts } = useOwner();
  const now = useNow(1000);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [lastBumped, setLastBumped] = useState(null); // { order, from }
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [awake, setAwake] = useState(false);
  const wakeLock = useRef(null);

  const tickets = useMemo(() => orders
    .filter((o) => KITCHEN_STATUSES.includes(o.status))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [orders]);
  const shown = filter === 'all' ? tickets : tickets.filter((o) => o.status === filter);
  const counts = { pending: tickets.filter((o) => o.status === 'pending').length, process: tickets.filter((o) => o.status === 'process').length };

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keep the screen awake while the kitchen display is open (re-acquired when the tab is shown again).
  useEffect(() => {
    if (!awake || !('wakeLock' in navigator)) return undefined;
    let cancelled = false;
    const acquire = async () => {
      try {
        wakeLock.current = await navigator.wakeLock.request('screen');
      } catch {
        if (!cancelled) setAwake(false);
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && acquire();
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [awake]);

  const bump = async (order) => {
    setBusy(order._id);
    try {
      await setOrderStatus(order._id, NEXT[order.status]);
      setLastBumped({ order, from: order.status });
    } catch { /* toast shown */ } finally { setBusy(null); }
  };

  const recall = async () => {
    if (!lastBumped) return;
    setBusy(lastBumped.order._id);
    try {
      await setOrderStatus(lastBumped.order._id, lastBumped.from);
      setLastBumped(null);
    } catch { /* toast shown */ } finally { setBusy(null); }
  };

  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  return (
    <div className="kitchen">
      <header className="kitchen-bar">
        <Link to="/dashboard" className="kitchen-icon" aria-label="Back to the dashboard"><ArrowLeft size={22} /></Link>
        <div className="kitchen-title">
          <strong><ChefHat size={22} aria-hidden="true" /> Kitchen</strong>
          <span>{profile?.restaurantName}</span>
        </div>
        <div className="kitchen-counts" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}<span>{f.value === 'all' ? tickets.length : counts[f.value]}</span>
            </button>
          ))}
        </div>
        <span className={`kitchen-live ${connected ? 'is-live' : ''}`}>{connected ? 'Live' : 'Reconnecting…'}</span>
        <time className="kitchen-clock">{new Date(now).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</time>
        <button type="button" className="kitchen-icon" onClick={recall} disabled={!lastBumped || Boolean(busy)} aria-label={lastBumped ? `Recall table ${lastBumped.order.tableNumber}` : 'Nothing to recall'} title="Recall the last bumped ticket">
          <Undo2 size={22} />
        </button>
        <button type="button" className="kitchen-icon" onClick={() => setAlerts({ sound: !alerts.sound })} aria-label={alerts.sound ? 'Mute new-ticket sound' : 'Turn on new-ticket sound'} aria-pressed={alerts.sound}>
          {alerts.sound ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
        {'wakeLock' in navigator && (
          <button type="button" className="kitchen-icon" onClick={() => setAwake((v) => !v)} aria-label={awake ? 'Let the screen sleep' : 'Keep the screen on'} aria-pressed={awake}>
            {awake ? <Sun size={22} /> : <SunDim size={22} />}
          </button>
        )}
        <button type="button" className="kitchen-icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
          {fullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
        </button>
      </header>

      <main className="kitchen-board">
        {!ordersLoaded && <p className="kitchen-empty">Loading orders…</p>}
        {ordersLoaded && shown.length === 0 && (
          <div className="kitchen-empty">
            <ChefHat size={56} aria-hidden="true" />
            <p>No tickets. New orders appear here instantly.</p>
          </div>
        )}
        {shown.map((order) => (
          <Ticket key={order._id} order={order} now={now} onBump={bump} busy={busy === order._id} />
        ))}
      </main>
    </div>
  );
}

// Route element for /kitchen (full screen, no sidebar). Requires a login.
export default function KitchenScreen() {
  const location = useLocation();
  if (!isLoggedIn()) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return (
    <OwnerProvider>
      <Kitchen />
    </OwnerProvider>
  );
}
