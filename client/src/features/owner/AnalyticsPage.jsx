import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { PageHeader } from './OwnerLayout';
import { ChartCard, ColumnChart, BarList, Heatmap } from './charts';
import { EmptyState, Skeleton, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatCompactPrice, formatPrice } from '../../lib/format';
import { PAYMENT_LABEL } from '../../lib/invoice';
import './analytics.css';

// India dates as YYYY-MM-DD (the API counts days in India time).
const indiaDate = (date = new Date()) => new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 10);
const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const shortDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const PRESETS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 }
];
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day] }));
const plural = (n, word) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

function Delta({ current, previous, days }) {
  if (!previous) return <span className="muted text-xs">No sales in the previous {days === 1 ? 'day' : `${days} days`}</span>;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.0005) return <span className="muted text-xs">No change vs previous {days === 1 ? 'day' : `${days} days`}</span>;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`kpi-delta ${up ? 'is-up' : 'is-down'}`}>
      <Icon size={14} aria-hidden="true" />
      {up ? '+' : '−'}{Math.abs(change * 100).toFixed(Math.abs(change) < 0.1 ? 1 : 0)}%
      <span className="muted"> vs previous {days === 1 ? 'day' : `${days} days`}</span>
    </span>
  );
}

function Kpi({ label, value, children }) {
  return (
    <div className="card kpi">
      <span className="stat-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {children}
    </div>
  );
}

function DataTable({ head, rows }) {
  return (
    <table className="data-table">
      <thead><tr>{head.map((h, i) => <th key={h} className={i > 0 ? 'num' : undefined}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((cells) => <tr key={cells[0]}>{cells.map((c, i) => <td key={i} className={i > 0 ? 'num' : undefined}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const today = indiaDate();
  const [range, setRange] = useState({ preset: '7', from: shiftDate(today, -6), to: today });
  const [grouping, setGrouping] = useState('auto');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/api/analytics', { params: { from: range.from, to: range.to } })
      .then((res) => !cancelled && setReport(res.data))
      .catch((err) => !cancelled && toast.error(errorMessage(err, 'Could not load analytics')))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [range.from, range.to, toast]);

  const choosePreset = (preset) => setRange({ preset: preset.key, from: shiftDate(today, -(preset.days - 1)), to: today });
  const setCustom = (field) => (e) => e.target.value && setRange((r) => ({ ...r, preset: 'custom', [field]: e.target.value }));

  const weekly = grouping === 'week' || (grouping === 'auto' && report?.range.days > 31);
  const salesPoints = useMemo(() => {
    if (!report) return [];
    return weekly
      ? report.weeks.map((w) => ({ key: w.weekStart, label: shortDate(w.weekStart), longLabel: `Week of ${longDate(w.weekStart)}`, value: w.revenue, orders: w.orders }))
      : report.days.map((d) => ({ key: d.date, label: report.range.days <= 7 ? new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }) : shortDate(d.date), longLabel: longDate(d.date), value: d.revenue, orders: d.orders }));
  }, [report, weekly]);

  const hours = useMemo(() => {
    const used = (report?.hours || []).map((h) => h.hour);
    const first = Math.min(8, ...used);
    const last = Math.max(23, ...used);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [report]);

  const paidTotal = (report?.payments || []).reduce((s, p) => s + p.revenue, 0);
  const empty = report && report.totals.orders === 0;
  const days = report?.range.days || 7;

  return (
    <>
      <PageHeader title="Analytics" subtitle="Sales in India time. Cancelled orders are left out." />

      <div className="analytics-filters" role="group" aria-label="Date range">
        <div className="segmented">
          {PRESETS.map((p) => <button key={p.key} type="button" aria-pressed={range.preset === p.key} onClick={() => choosePreset(p)}>{p.label}</button>)}
        </div>
        <label className="analytics-date"><span>From</span><input type="date" className="input" value={range.from} max={range.to} onChange={setCustom('from')} /></label>
        <label className="analytics-date"><span>To</span><input type="date" className="input" value={range.to} min={range.from} max={today} onChange={setCustom('to')} /></label>
      </div>

      {!report && <div className="kpi-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={112} radius="var(--radius-card)" />)}</div>}

      {report && (
        <div className={`analytics-body ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
          <div className="kpi-grid">
            <Kpi label="Sales" value={formatPrice(report.totals.revenue)}><Delta current={report.totals.revenue} previous={report.previous.revenue} days={days} /></Kpi>
            <Kpi label="Orders" value={report.totals.orders.toLocaleString('en-IN')}><Delta current={report.totals.orders} previous={report.previous.orders} days={days} /></Kpi>
            <Kpi label="Average order" value={formatPrice(report.totals.averageOrder)}><Delta current={report.totals.averageOrder} previous={report.previous.averageOrder} days={days} /></Kpi>
            <Kpi label="Dishes sold" value={report.totals.itemsSold.toLocaleString('en-IN')}>
              <span className="muted text-xs">{report.totals.cancelled ? `${plural(report.totals.cancelled, 'order')} cancelled` : 'No cancelled orders'}</span>
            </Kpi>
          </div>

          {empty ? (
            <EmptyState icon={<BarChart3 size={28} />} title="No sales in this period">Pick a longer range, or check back once orders come in.</EmptyState>
          ) : (
            <div className="analytics-grid">
              <ChartCard
                className="span-2"
                title={weekly ? 'Sales by week' : 'Sales by day'}
                subtitle={`${longDate(report.range.from)} to ${longDate(report.range.to)}`}
                table={<DataTable head={[weekly ? 'Week of' : 'Day', 'Orders', 'Sales']} rows={salesPoints.map((p) => [p.longLabel, p.orders.toLocaleString('en-IN'), formatPrice(p.value)])} />}
              >
                {report.range.days > 1 && (
                  <div className="segmented chart-grouping" role="group" aria-label="Group sales by">
                    {[['auto', 'Auto'], ['day', 'Day'], ['week', 'Week']].map(([key, label]) => <button key={key} type="button" aria-pressed={grouping === key} onClick={() => setGrouping(key)}>{label}</button>)}
                  </div>
                )}
                <ColumnChart
                  points={salesPoints}
                  ariaLabel={`Sales ${weekly ? 'per week' : 'per day'}. Use the arrow keys to read each ${weekly ? 'week' : 'day'}, or switch to the table.`}
                  formatTooltip={(p) => <><strong>{formatPrice(p.value)}</strong><span>{p.longLabel}</span><span>{plural(p.orders, 'order')}</span></>}
                />
              </ChartCard>

              <ChartCard
                title="Top dishes"
                subtitle="By sales; quantity sold underneath"
                table={<DataTable head={['Dish', 'Qty', 'Sales']} rows={report.items.map((i) => [i.name, i.quantity, formatPrice(i.revenue)])} />}
              >
                <BarList rows={report.items.slice(0, 8).map((i) => ({ key: i.name, label: i.name, value: i.revenue, valueLabel: formatPrice(i.revenue), note: `${i.quantity} sold · ${i.category}` }))} />
                {report.items.length > 8 && <p className="muted text-xs chart-foot">{report.items.length - 8} more in the table view</p>}
              </ChartCard>

              <ChartCard
                title="Sales by category"
                subtitle="Share of sales"
                table={<DataTable head={['Category', 'Qty', 'Sales']} rows={report.categories.map((c) => [c.category, c.quantity, formatPrice(c.revenue)])} />}
              >
                <BarList rows={report.categories.map((c) => {
                  const total = report.categories.reduce((s, x) => s + x.revenue, 0);
                  return { key: c.category, label: c.category, value: c.revenue, valueLabel: `${formatPrice(c.revenue)} · ${total ? Math.round((c.revenue / total) * 100) : 0}%` };
                })} />
              </ChartCard>

              <ChartCard
                className="span-2"
                title="Busiest hours"
                subtitle="Orders by weekday and hour"
                table={<DataTable head={['Day and hour', 'Orders', 'Sales']} rows={[...report.hours].sort((a, b) => b.orders - a.orders).map((h) => [`${WEEK.find((w) => w.day === h.day).label} ${String(h.hour).padStart(2, '0')}:00`, h.orders, formatPrice(h.revenue)])} />}
              >
                <Heatmap
                  cells={report.hours.map((h) => ({ ...h, value: h.orders }))}
                  days={WEEK}
                  hours={hours}
                  ariaLabel="Orders by weekday and hour. Focus and use the arrow keys to read each hour, or switch to the table."
                  formatTooltip={(c) => (
                    <>
                      <strong>{plural(c.value, 'order')}</strong>
                      <span>{WEEK.find((w) => w.day === c.day).label} {String(c.hour).padStart(2, '0')}:00–{String((c.hour + 1) % 24).padStart(2, '0')}:00</span>
                      {c.revenue > 0 && <span>{formatPrice(c.revenue)}</span>}
                    </>
                  )}
                />
              </ChartCard>

              <ChartCard
                title="Tables"
                subtitle="Orders per table; QR scans are all-time"
                table={<DataTable head={['Table', 'Orders', 'Sales', 'QR scans']} rows={report.tables.map((t) => [`Table ${t.table}`, t.orders, formatPrice(t.revenue), t.scans])} />}
              >
                <BarList rows={report.tables.map((t) => ({ key: t.table, label: `Table ${t.table}`, value: t.orders, valueLabel: plural(t.orders, 'order'), note: `${formatCompactPrice(t.revenue)} sales · ${plural(t.scans, 'scan')}` }))} />
              </ChartCard>

              <ChartCard
                title="Payments"
                subtitle="Paid bills in this period"
                table={<DataTable head={['Method', 'Bills', 'Amount']} rows={report.payments.map((p) => [PAYMENT_LABEL[p.method] || p.method, p.orders, formatPrice(p.revenue)])} />}
              >
                {report.payments.length === 0 ? <p className="muted text-sm">No paid bills yet.</p> : (
                  <BarList rows={[...report.payments].sort((a, b) => b.revenue - a.revenue).map((p) => ({ key: p.method, label: PAYMENT_LABEL[p.method] || p.method, value: p.revenue, valueLabel: `${formatPrice(p.revenue)} · ${paidTotal ? Math.round((p.revenue / paidTotal) * 100) : 0}%`, note: plural(p.orders, 'bill') }))} />
                )}
              </ChartCard>
            </div>
          )}
        </div>
      )}
    </>
  );
}
