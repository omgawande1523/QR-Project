import { useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router';
import { Home, Search, ShoppingBag, ClipboardList, ConciergeBell, RefreshCw } from 'lucide-react';
import { CustomerProvider, useCustomer } from './CustomerContext';
import { BottomNav, Button, EmptyState } from '../../components/ui';
import { CallWaiterSheet } from './CallWaiterSheet';
import './customer.css';

function CustomerShell() {
  const { restaurantId, status, error, reload, cartCount, activeOrders } = useCustomer();
  const location = useLocation();
  const [waiterOpen, setWaiterOpen] = useState(false);
  const base = `/menu/${restaurantId}`;
  const path = location.pathname.replace(/\/+$/, '');
  // The welcome screen and item detail have their own bottom actions instead of the nav.
  const showNav = path !== base && !path.includes('/item/');

  if (status === 'error') {
    return (
      <main className="customer-app">
        <EmptyState icon={<RefreshCw size={28} />} title="Menu unavailable" action={<Button onClick={reload}>Try again</Button>}>
          {error}
        </EmptyState>
      </main>
    );
  }

  return (
    <div className={`customer-app ${showNav ? 'has-nav' : ''}`}>
      <Outlet context={{ openWaiter: () => setWaiterOpen(true) }} />
      {showNav && (
        <BottomNav
          label="Menu navigation"
          items={[
            { to: `${base}/browse`, label: 'Home', icon: <Home size={22} />, end: true },
            { to: `${base}/browse?focus=search`, label: 'Search', icon: <Search size={22} /> },
            { to: `${base}/orders`, label: activeOrders.length ? `Orders (${activeOrders.length})` : 'Orders', icon: <ClipboardList size={22} /> },
            { label: 'Waiter', icon: <ConciergeBell size={22} />, onClick: () => setWaiterOpen(true) }
          ]}
          center={{ to: `${base}/cart`, label: 'Cart', icon: <ShoppingBag size={26} />, count: cartCount }}
        />
      )}
      <CallWaiterSheet open={waiterOpen} onClose={() => setWaiterOpen(false)} />
    </div>
  );
}

// Route element for /menu/:restaurantId/* (opened by scanning a table QR code).
export default function CustomerApp() {
  const { restaurantId } = useParams();
  return (
    <CustomerProvider key={restaurantId} restaurantId={restaurantId}>
      <CustomerShell />
    </CustomerProvider>
  );
}
