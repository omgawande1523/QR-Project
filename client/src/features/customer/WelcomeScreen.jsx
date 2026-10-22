import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ArrowRight, ChevronsRight, MapPin, Clock, ClipboardList } from 'lucide-react';
import { useCustomer } from './CustomerContext';
import { Badge, Button, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { session } from '../../lib/storage';
import { openStatus } from '../../lib/hours';
import { APP_NAME } from '../../config';
import { responsiveImage } from '../../lib/srcset';
import { VisitBillCard, useVisitBill } from './VisitBill';

// First screen after scanning a table QR code: hero image, restaurant, table, "View Menu".
export default function WelcomeScreen() {
  const { restaurantId, restaurant, status, table, setTable, activeOrders } = useCustomer();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tableParam = Number(params.get('table')) || null;
  const bill = useVisitBill();

  useEffect(() => {
    if (!tableParam || !restaurant) return;
    if (!restaurant.tables.includes(tableParam)) return;
    setTable(tableParam);
    // Count one scan per table per browser session (owner analytics).
    const scanKey = `qr.scanned.${restaurantId}.${tableParam}`;
    if (!session.get(scanKey)) {
      session.set(scanKey, true);
      api.post(`/api/users/${restaurantId}/scan/${tableParam}`).catch(() => {});
    }
  }, [tableParam, restaurant, restaurantId, setTable]);

  if (status === 'loading' || !restaurant) {
    return (
      <main className="welcome" aria-busy="true">
        <Skeleton height="52vh" radius="0 0 var(--radius-lg) var(--radius-lg)" />
        <div className="welcome-body"><Skeleton height={32} width="70%" /><Skeleton height={18} width="90%" /></div>
      </main>
    );
  }

  const hours = openStatus(restaurant.openingHours);
  const shownTable = tableParam && restaurant.tables.includes(tableParam) ? tableParam : table;

  return (
    <main className="welcome page-enter">
      <div className="welcome-hero">
        {restaurant.bannerImage
          // React 18 passes fetchpriority through only in lowercase; the camelCase prop arrives in React 19.
          // eslint-disable-next-line react/no-unknown-property
          ? <img {...responsiveImage(restaurant.bannerImage, { widths: [480, 640, 960], sizes: '(min-width: 480px) 480px, 100vw' })} alt="" fetchpriority="high" width="960" height="720" />
          : <div className="welcome-hero-fallback" />}
        {shownTable && <Badge tone="accent" className="welcome-table">Table {shownTable}</Badge>}
      </div>

      <div className="welcome-body">
        {restaurant.profilePicture && (
          <img className="welcome-logo" {...responsiveImage(restaurant.profilePicture, { widths: [160, 320], sizes: '88px' })} alt={`${restaurant.restaurantName} logo`} width="88" height="88" />
        )}
        <h1 className="welcome-title">{restaurant.restaurantName}</h1>
        {restaurant.tagline && <p className="welcome-tagline">{restaurant.tagline}</p>}
        <div className="welcome-meta">
          {hours && (
            <span className={hours.open ? 'is-open' : 'is-closed'}><Clock size={15} aria-hidden="true" /> {hours.label}</span>
          )}
          {restaurant.address && <span><MapPin size={15} aria-hidden="true" /> {restaurant.address}</span>}
        </div>

        <button type="button" className="welcome-cta" onClick={() => navigate(`/menu/${restaurantId}/browse`)}>
          <span className="welcome-cta-icon" aria-hidden="true"><ArrowRight size={22} /></span>
          <span className="welcome-cta-label">View Menu</span>
          <ChevronsRight size={22} className="welcome-cta-hint" aria-hidden="true" />
        </button>

        {activeOrders.length > 0 && (
          <Button variant="ghost" to={`/menu/${restaurantId}/orders`} icon={<ClipboardList size={18} />}>
            Track your order{activeOrders.length > 1 ? 's' : ''}
          </Button>
        )}
        {bill && <VisitBillCard bill={bill} />}
        <p className="welcome-powered">Powered by {APP_NAME}</p>
      </div>
    </main>
  );
}
