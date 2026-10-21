import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { formatCompactPrice } from '../../lib/format';

// Small, dependency-free charts for the analytics page. Marks use the olive tokens (validated with the
// dataviz palette checks: single-series olive-600 at 3.64:1 on white, heatmap ramp olive-400..900).
// Every chart has a table view, and tooltips appear on hover and on keyboard focus (arrow keys).

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Round axis steps: 1, 2, 2.5 or 5 x 10^n, about four ticks.
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// Column with a 4px rounded data end and a square base.
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Card with a title, an optional subtitle and a chart / table switch. */
export function ChartCard({ title, subtitle, table, children, className = '' }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`card chart-card ${className}`} aria-label={title}>
      <header className="chart-card-head">
        <div className="grow">
          <h2 className="card-title">{title}</h2>
          {subtitle && <p className="muted text-sm">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" className="chart-view-toggle" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
            {showTable ? <BarChart3 size={16} aria-hidden="true" /> : <Table2 size={16} aria-hidden="true" />}
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </header>
      {showTable ? <div className="table-scroll chart-table">{table}</div> : children}
    </section>
  );
}

/**
 * Columns over time (one series). points: [{ key, label, longLabel, value, detail }]
 */
export function ColumnChart({ points, formatValue = formatCompactPrice, formatTooltip, height = 220, ariaLabel }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const axisW = 48;
  const bandH = 28;
  const plotW = Math.max(0, width - axisW);
  const max = Math.max(0, ...points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const band = points.length ? plotW / points.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v) => 12 + (height - 12) * (1 - v / top);
  const peak = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0);
  // Show as many x labels as fit (about 56px each), always including the last.
  const every = Math.max(1, Math.ceil(56 / Math.max(band, 1)));

  const onKey = (e) => {
    if (!points.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? (delta > 0 ? -1 : points.length)) + delta)));
    }
  };

  const tip = active != null ? points[active] : null;
  const tipX = active != null ? axisW + band * active + band / 2 : 0;

  return (
    <div ref={ref} className="chart-frame">
      {width > 0 && (
        <svg
          width={width}
          height={height + bandH}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="chart-svg"
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const i = Math.floor((e.clientX - box.left - axisW) / band);
            setActive(i >= 0 && i < points.length ? i : null);
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={axisW} x2={width} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={axisW - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">{formatValue(t)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const h = Math.max(0, y(0) - y(p.value));
            const x = axisW + band * i + (band - barW) / 2;
            return (
              <g key={p.key}>
                {h > 0 && <path d={columnPath(x, y(p.value), barW, h)} className={`chart-bar ${active === i ? 'is-active' : ''}`} />}
                {(i % every === 0 || i === points.length - 1) && (i === points.length - 1 || points.length - 1 - i >= every) && (
                  <text x={axisW + band * i + band / 2} y={height + 18} className="chart-tick" textAnchor="middle">{p.label}</text>
                )}
              </g>
            );
          })}
          {max > 0 && active == null && (
            <text x={axisW + band * peak + band / 2} y={y(points[peak].value) - 6} className="chart-peak" textAnchor="middle">{formatValue(points[peak].value)}</text>
          )}
          {tip && <line x1={tipX} x2={tipX} y1={12} y2={y(0)} className="chart-crosshair" />}
        </svg>
      )}
      {tip && (
        <div className="chart-tooltip" role="status" style={{ left: Math.min(Math.max(tipX, 80), width - 80), top: 0 }}>
          {formatTooltip ? formatTooltip(tip) : <><strong>{formatValue(tip.value)}</strong><span>{tip.longLabel || tip.label}</span></>}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars with the value at the tip. rows: [{ key, label, value, valueLabel, note }] */
export function BarList({ rows, max: forcedMax }) {
  const max = forcedMax ?? Math.max(0, ...rows.map((r) => r.value));
  return (
    <ol className="bar-list">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="bar-list-text">
            <span className="truncate">{row.label}</span>
            <span className="bar-list-value">{row.valueLabel}</span>
          </div>
          <div className="bar-list-track" aria-hidden="true">
            <span className="bar-list-fill" style={{ width: `${max > 0 ? Math.max(row.value > 0 ? 1.5 : 0, (row.value / max) * 100) : 0}%` }} />
          </div>
          {row.note && <span className="muted text-xs">{row.note}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Weekday x hour grid, five sequential bins plus "none". cells: [{ day (0 = Sun), hour, value, detail }]
 */
export function Heatmap({ cells, days, hours, formatTooltip, ariaLabel }) {
  const [active, setActive] = useState(null); // [dayIndex, hourIndex]
  const byKey = new Map(cells.map((c) => [`${c.day}:${c.hour}`, c]));
  const max = Math.max(0, ...cells.map((c) => c.value));
  const bin = (v) => (v <= 0 || max <= 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)));
  const bounds = [1, 2, 3, 4, 5].map((b) => Math.ceil((max * b) / 5));
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    wrapRef.current?.querySelector(`[data-cell="${active[0]}:${active[1]}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const onKey = (e) => {
    const moves = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (!moves[e.key]) return;
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    setActive(([r, c] = [0, -1]) => [Math.min(days.length - 1, Math.max(0, r + dr)), Math.min(hours.length - 1, Math.max(0, c + dc))]);
  };

  const activeCell = active ? byKey.get(`${days[active[0]].day}:${hours[active[1]]}`) || { day: days[active[0]].day, hour: hours[active[1]], value: 0 } : null;

  return (
    <div className="heatmap-wrap" ref={wrapRef}>
      <div
        className="heatmap"
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        style={{ gridTemplateColumns: `36px repeat(${hours.length}, minmax(12px, 32px))` }}
      >
        <span />
        {hours.map((h) => <span key={h} className="heatmap-hour">{h % 3 === 0 ? `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` : ''}</span>)}
        {days.map((d, r) => (
          <div key={d.day} className="heatmap-row">
            <span className="heatmap-day">{d.label}</span>
            {hours.map((h, c) => {
              const cell = byKey.get(`${d.day}:${h}`);
              const isActive = active && active[0] === r && active[1] === c;
              return (
                <span
                  key={h}
                  data-cell={`${r}:${c}`}
                  className={`heatmap-cell bin-${bin(cell?.value || 0)} ${isActive ? 'is-active' : ''}`}
                  onPointerEnter={() => setActive([r, c])}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-readout" role="status">{activeCell ? formatTooltip(activeCell) : <span className="muted">Point at a square, or focus the grid and use the arrow keys</span>}</div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Fewer</span>
        {[0, 1, 2, 3, 4, 5].map((b) => <span key={b} className={`heatmap-cell bin-${b}`} title={b === 0 ? 'None' : `Up to ${bounds[b - 1]}`} />)}
        <span>More orders</span>
      </div>
    </div>
  );
}
