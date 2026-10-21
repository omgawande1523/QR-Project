import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router';
import { QrCode } from 'lucide-react';
import { local } from '../../lib/storage';
import { APP_NAME } from '../../config';
import { usePageTitle } from '../../lib/usePageTitle';
import { Home, Search, ShoppingBag, ClipboardList, ConciergeBell, RefreshCw } from 'lucide-react';
import { CustomerProvider, useCustomer } from './CustomerContext';
import { BottomNav, Button, EmptyState } from '../../components/ui';
import { CallWaiterSheet } from './CallWaiterSheet';
import './customer.css';

// Screen readers hear "Cart: 2 items" whenever the cart changes (adding from the grid has no other message).
function useCartAnnouncement(cartCount) {
  const [text, setText] = useState('');
  const previous = useRef(cartCount);
  useEffect(() => {
    if (previous.current === cartCount) return;
    previous.current = cartCount;
    setText(cartCount ? `Cart: ${cartCount} ${cartCount === 1 ? 'item' : 'items'}` : 'Cart is empty');
  }, [cartCount]);
  return text;
}

function CustomerShell() {
  const { restaurantId, restaurant, status, error, reload, cartCount, activeOrders } = useCustomer();
  usePageTitle(restaurant?.restaurantName);
  const location = useLocation();
  const [waiterOpen, setWaiterOpen] = useState(false);
  const cartAnnouncement = useCartAnnouncement(cartCount);
  const base = `/menu/${restaurantId}`;
  const path = location.pathname.replace(/\/+$/, '');
  // The welcome screen and item detail have their own bottom actions instead of the nav.
  const showNav = path !== base && !path.includes('/item/');

  if (status === 'error') {
    return (
      <main className="customer-app">
        <EmptyState heading="h1" icon={<RefreshCw size={28} />} title="Menu unavailable" action={<Button onClick={reload}>Try again</Button>}>
          {error}
        </EmptyState>
      </main>
    );
  }

  return (
    <div className={`customer-app ${showNav ? 'has-nav' : ''}`}>
      <p className="sr-only" role="status">{cartAnnouncement}</p>
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

const LAST_MENU = 'qr.lastMenu';

// While a guest is on a menu, "Install app" installs the menu (start page /menu/) instead of the dashboard.
function useMenuManifest(restaurantId) {
  useEffect(() => {
    local.set(LAST_MENU, restaurantId);
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return undefined;
    const previous = link.getAttribute('href');
    link.setAttribute('href', '/menu.webmanifest');
    return () => link.setAttribute('href', previous);
  }, [restaurantId]);
}

// /menu/ is the installed menu app's start page: reopen the restaurant the guest last visited.
export function MenuLauncher() {
  const last = local.get(LAST_MENU, null);
  if (last) return <Navigate to={`/menu/${last}/browse`} replace />;
  return (
    <main className="customer-app">
      <EmptyState heading="h1" icon={<QrCode size={28} />} title="Scan the QR code on your table" action={<Button to="/">About {APP_NAME}</Button>}>
        Each table has a QR code that opens the restaurant's menu.
      </EmptyState>
    </main>
  );
}

// Route element for /menu/:restaurantId/* (opened by scanning a table QR code).
export default function CustomerApp() {
  const { restaurantId } = useParams();
  useMenuManifest(restaurantId);
  return (
    <CustomerProvider key={restaurantId} restaurantId={restaurantId}>
      <CustomerShell />
    </CustomerProvider>
  );
}
