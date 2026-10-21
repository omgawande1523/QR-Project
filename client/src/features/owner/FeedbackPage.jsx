import { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { PageHeader } from './OwnerLayout';
import { BarList, ChartCard } from './charts';
import { Button, EmptyState, FilterChips, Skeleton, Stars, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { FEEDBACK_TAG_LABEL } from '../../lib/feedback';
import './analytics.css';

const indiaDate = (date = new Date()) => new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 10);
const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const PRESETS = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }];
const PAGE = 20;
const FILTERS = [{ value: 'all', label: 'All' }, { value: 'happy', label: '4–5 stars' }, { value: 'unhappy', label: '1–3 stars' }];

function DataTable({ head, rows }) {
  return (
    <table className="data-table">
      <thead><tr>{head.map((h, i) => <th key={h} className={i > 0 ? 'num' : undefined}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((cells) => <tr key={cells[0]}>{cells.map((c, i) => <td key={i} className={i > 0 ? 'num' : undefined}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

export default function FeedbackPage() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => setShown(PAGE), [days, filter]);

  useEffect(() => {
    let cancelled = false;
    const to = indiaDate();
    setLoading(true);
    api.get('/api/analytics/feedback', { params: { from: shiftDate(to, -(days - 1)), to } })
      .then((res) => !cancelled && setReport(res.data))
      .catch((err) => !cancelled && toast.error(errorMessage(err, 'Could not load feedback')))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [days, toast]);

  const happy = report ? report.distribution[4] + report.distribution[5] : 0;
  const entries = (report?.entries || []).filter((e) => (filter === 'happy' ? e.rating >= 4 : filter === 'unhappy' ? e.rating <= 3 : true));
  const tagRows = Object.entries(report?.tags || {});

  return (
    <>
      <PageHeader title="Feedback" subtitle="Guests rate their meal from the order page once it is served." />

      <div className="analytics-filters" role="group" aria-label="Date range">
        <div className="segmented">
          {PRESETS.map((p) => <button key={p.days} type="button" aria-pressed={days === p.days} onClick={() => setDays(p.days)}>{p.label}</button>)}
        </div>
      </div>

      {!report && <div className="kpi-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={112} radius="var(--radius-card)" />)}</div>}

      {report && report.count === 0 && (
        <EmptyState icon={<MessageSquareText size={28} />} title="No ratings in this period">
          After an order is served, the guest&apos;s order page asks how the meal was.
        </EmptyState>
      )}

      {report && report.count > 0 && (
        <div className={`analytics-body ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
          <div className="kpi-grid">
            <div className="card kpi">
              <span className="stat-label">Average rating</span>
              <span className="kpi-value">{report.average.toFixed(1)}<span className="kpi-unit"> / 5</span></span>
              <Stars rating={Math.round(report.average)} />
            </div>
            <div className="card kpi">
              <span className="stat-label">Ratings</span>
              <span className="kpi-value">{report.count.toLocaleString('en-IN')}</span>
              <span className="muted text-xs">in the last {days} days</span>
            </div>
            <div className="card kpi">
              <span className="stat-label">Happy guests</span>
              <span className="kpi-value">{Math.round((happy / report.count) * 100)}%</span>
              <span className="muted text-xs">rated 4 or 5 stars</span>
            </div>
            <div className="card kpi">
              <span className="stat-label">Needs attention</span>
              <span className="kpi-value">{(report.count - happy).toLocaleString('en-IN')}</span>
              <span className="muted text-xs">rated 1 to 3 stars</span>
            </div>
          </div>

          <div className="analytics-grid">
            <ChartCard
              title="Ratings"
              subtitle="Number of guests per star rating"
              table={<DataTable head={['Stars', 'Guests']} rows={[5, 4, 3, 2, 1].map((r) => [`${r} star${r === 1 ? '' : 's'}`, report.distribution[r]])} />}
            >
              <BarList rows={[5, 4, 3, 2, 1].map((r) => ({ key: r, label: `${r} star${r === 1 ? '' : 's'}`, value: report.distribution[r], valueLabel: report.distribution[r].toLocaleString('en-IN') }))} />
            </ChartCard>
            <ChartCard
              title="What guests mention"
              subtitle="Quick tags picked with a rating"
              table={tagRows.length > 0 && <DataTable head={['Tag', 'Guests']} rows={tagRows.map(([tag, n]) => [FEEDBACK_TAG_LABEL[tag] || tag, n])} />}
            >
              {tagRows.length === 0 ? <p className="muted text-sm">No tags yet.</p> : (
                <BarList rows={tagRows.map(([tag, n]) => ({ key: tag, label: FEEDBACK_TAG_LABEL[tag] || tag, value: n, valueLabel: n.toLocaleString('en-IN') }))} />
              )}
            </ChartCard>

            <section className="card span-2 feedback-list-card" aria-label="Comments">
              <div className="chart-card-head">
                <h2 className="card-title grow">Latest ratings</h2>
              </div>
              <FilterChips options={FILTERS} value={filter} onChange={setFilter} label="Show ratings" />
              {entries.length === 0 ? <p className="muted text-sm">Nothing here for this filter.</p> : (
                <ul className="feedback-list">
                  {entries.slice(0, shown).map((e) => (
                    <li key={e.orderId}>
                      <div className="row-between wrap" style={{ gap: 'var(--space-2)' }}>
                        <Stars rating={e.rating} />
                        <span className="muted text-xs">Table {e.tableNumber}{e.customerName ? ` · ${e.customerName}` : ''} · {formatDateTime(e.createdAt)}</span>
                      </div>
                      {e.comment ? <p className="feedback-comment">“{e.comment}”</p> : <p className="muted text-sm">No comment</p>}
                      {e.tags?.length > 0 && <div className="feedback-tag-row">{e.tags.map((t) => <span key={t} className="feedback-tag">{FEEDBACK_TAG_LABEL[t] || t}</span>)}</div>}
                      <p className="muted text-xs truncate">{e.items.join(', ')}</p>
                    </li>
                  ))}
                </ul>
              )}
              {entries.length > shown && (
                <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)} style={{ alignSelf: 'center' }}>
                  Show more ({entries.length - shown} left)
                </Button>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
