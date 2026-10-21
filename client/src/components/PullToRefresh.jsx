import { useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { IS_APP } from '../lib/platform';
import { Spinner } from './ui';

const THRESHOLD = 70; // px of (damped) pull that triggers a refresh

function Puller({ onRefresh, children }) {
  const start = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e) => {
    // Only from the very top of the page, and not while a dialog is open.
    start.current = window.scrollY <= 0 && !document.querySelector('[aria-modal="true"]') ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e) => {
    if (start.current == null || refreshing) return;
    const dy = e.touches[0].clientY - start.current;
    setPull(dy > 0 ? Math.min(dy * 0.5, THRESHOLD * 1.4) : 0);
  };
  const onTouchEnd = async () => {
    if (start.current == null) return;
    start.current = null;
    if (pull < THRESHOLD) { setPull(0); return; }
    setRefreshing(true);
    setPull(48);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  return (
    <div className="pull-area" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div className={`pull-indicator ${pull >= THRESHOLD ? 'is-ready' : ''}`} style={{ height: pull }} aria-hidden={!refreshing}>
        {refreshing ? <Spinner /> : pull > 8 && <ArrowDown size={22} aria-hidden="true" />}
      </div>
      {refreshing && <span className="sr-only" role="status">Refreshing</span>}
      {children}
    </div>
  );
}

// Pull down at the top of a screen to reload it (staff app only; the website renders the children as they are).
export function PullToRefresh({ onRefresh, children }) {
  if (!IS_APP) return children;
  return <Puller onRefresh={onRefresh}>{children}</Puller>;
}
