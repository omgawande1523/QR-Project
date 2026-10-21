import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Printer, Volume2, VolumeX } from 'lucide-react';
import { useOwner } from './OwnerContext';
import { PageHeader } from './OwnerLayout';
import { OrderCard, OrderItems } from './OrderCard';
import { BillModal } from './BillModal';
import { Badge, Button, Card, EmptyState, IconButton, SelectField, Skeleton, Stars, useToast } from '../../components/ui';
import { BOARD_COLUMNS, STATUS_LABEL, STATUS_TONE } from '../../lib/orderStatus';
import { api, errorMessage } from '../../lib/api';
import { formatPrice, formatTime } from '../../lib/format';
import { PAYMENT_LABEL } from '../../lib/invoice';
import { useNow } from '../../lib/useNow';

const todayInput = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

function History({ table, onPrint }) {
  const [date, setDate] = useState(todayInput);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(`${date}T23:59:59.999`);
    setOrders(null);
    api.get('/api/orders', { params: { from: from.toISOString(), to: to.toISOString(), limit: 1000 } })
      .then((res) => !cancelled && setOrders(res.data))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => { cancelled = true; };
  }, [date]);

  const shown = (orders || []).filter((o) => (table === 'all' || o.tableNumber === Number(table)));
  const revenue = shown.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);

  return (
    <Card className="stack">
      <div className="row wrap">
        <label className="field" style={{ maxWidth: 220 }}>
          <span className="field-label">Date</span>
          <input type="date" className="input" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {orders && <p className="muted" style={{ alignSelf: 'flex-end', paddingBottom: 12 }}>{shown.length} orders · {formatPrice(revenue)} (excl. cancelled)</p>}
      </div>
      {error && <div className="notice notice-danger">{error}</div>}
      {!orders && !error && <Skeleton height={200} />}
      {orders && shown.length === 0 && <EmptyState title="No orders on this day" />}
      {shown.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Time</th><th>Table</th><th>Items</th><th>Status</th><th>Invoice</th><th className="num">Total</th><th><span className="sr-only">Bill</span></th></tr></thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o._id}>
                  <td>{formatTime(o.createdAt)}</td>
                  <td>T{o.tableNumber}</td>
                  <td><OrderItems items={o.items} compact /></td>
                  <td>
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    {o.payment?.paidAt && <span className="muted text-xs" style={{ display: 'block', marginTop: 2 }}>{PAYMENT_LABEL[o.payment.method]}</span>}
                    {o.feedback?.rating && <span style={{ display: 'block', marginTop: 2 }}><Stars rating={o.feedback.rating} size={12} /></span>}
                  </td>
                  <td className="text-xs" style={{ whiteSpace: 'nowrap' }}>{o.invoiceNumber || <span className="muted">-</span>}</td>
                  <td className="num price">{formatPrice(o.totalAmount)}</td>
                  <td><IconButton label="Open bill" variant="flat" onClick={() => onPrint(o)}><Printer size={18} /></IconButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function OrdersBoard() {
  const { orders, ordersLoaded, setOrderStatus, replaceOrder, profile, alerts, setAlerts } = useOwner();
  const toast = useToast();
  const now = useNow();
  const [view, setView] = useState('board');
  const [table, setTable] = useState('all');
  const [busy, setBusy] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [receipt, setReceipt] = useState(null);
  // ?order=<id> (a tapped notification): show that order on the board, scrolled into view and highlighted.
  const [params, setParams] = useSearchParams();
  const [focused, setFocused] = useState(null);
  const focusId = params.get('order');
  useEffect(() => {
    if (!focusId || !ordersLoaded) return undefined;
    setView('board');
    setTable('all');
    setFocused(focusId);
    const next = new URLSearchParams(params);
    next.delete('order');
    setParams(next, { replace: true });
    requestAnimationFrame(() => document.getElementById(`order-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
    const timer = setTimeout(() => setFocused(null), 4000);
    return () => clearTimeout(timer);
  }, [focusId, ordersLoaded, params, setParams]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.status, []]));
    orders
      .filter((o) => map[o.status] && (table === 'all' || o.tableNumber === Number(table)))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((o) => map[o.status].push(o));
    return map;
  }, [orders, table]);

  // "Bill" assigns the invoice number and opens the bill; "Mark paid" opens it to take payment.
  const bill = async (order) => {
    setBusy(order._id);
    try {
      const res = await api.post(`/api/orders/${order._id}/invoice`);
      replaceOrder(res.data);
      setReceipt(res.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not make the bill'));
    } finally {
      setBusy(null);
    }
  };

  const change = async (order, status) => {
    if (status === 'billed') return bill(order);
    if (status === 'complete') return setReceipt(order);
    if (status === 'cancelled' && order.payment?.paidAt && !window.confirm(`Table ${order.tableNumber} has already paid. Cancel anyway? Refund them separately.`)) return;
    if (status === 'cancelled' && !order.payment?.paidAt && !window.confirm(`Cancel the order for table ${order.tableNumber}?`)) return;
    setBusy(order._id);
    try { await setOrderStatus(order._id, status); } catch { /* toast shown */ } finally { setBusy(null); }
  };

  const drop = (status) => (e) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/order-id');
    const order = orders.find((o) => o._id === id);
    if (order && order.status !== status) change(order, status);
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Tap the button on a card to move it along, or drag it to a column."
        actions={(
          <>
            <IconButton label={alerts.sound ? 'Mute new-order sound' : 'Turn on new-order sound'} onClick={() => setAlerts({ sound: !alerts.sound })}>
              {alerts.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </IconButton>
            <div className="segmented" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>Board</button>
              <button type="button" aria-pressed={view === 'history'} onClick={() => setView('history')}>History</button>
            </div>
          </>
        )}
      />

      <div className="row wrap board-toolbar">
        <SelectField
          label="Table"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          options={[{ value: 'all', label: 'All tables' }, ...(profile?.tables || []).map((t) => ({ value: String(t), label: `Table ${t}` }))]}
        />
      </div>

      {view === 'history' ? <History table={table} onPrint={setReceipt} /> : (
        <div className="board">
          {BOARD_COLUMNS.map((column) => (
            <section
              key={column.status}
              data-status={column.status}
              className={`board-column ${dragOver === column.status ? 'is-over' : ''}`}
              aria-label={`${column.label} (${byStatus[column.status].length})`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(column.status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={drop(column.status)}
            >
              <header className="board-column-head">
                <span className={`board-dot dot-${column.status}`} aria-hidden="true" />
                <h2>{column.label}</h2>
                <span className="board-count">{byStatus[column.status].length}</span>
              </header>
              <div className="board-cards">
                {!ordersLoaded && <Skeleton height={140} radius="var(--radius-card)" />}
                {ordersLoaded && byStatus[column.status].length === 0 && <p className="board-empty">No orders</p>}
                {byStatus[column.status].map((order) => (
                  <OrderCard key={order._id} order={order} now={now} draggable busy={busy === order._id} onStatus={change} onPrint={setReceipt} focused={focused === order._id} onDragOverColumn={setDragOver} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {receipt && <BillModal order={receipt} onClose={() => setReceipt(null)} />}
      {view === 'board' && ordersLoaded && Object.values(byStatus).every((list) => list.length === 0) && (
        <p className="muted text-sm" style={{ marginTop: 'var(--space-4)' }}>
          Completed and cancelled orders are under <Button variant="ghost" size="sm" onClick={() => setView('history')}>History</Button>.
        </p>
      )}
    </>
  );
}
