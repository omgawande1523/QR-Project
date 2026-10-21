import { pushTarget, olderThan } from './AppShell';
import { pushBack, popBack } from '../lib/backStack';
import { setSession, getToken, getRole, isLoggedIn, clearSession } from '../lib/session';
import { IS_APP, siteOrigin } from '../lib/platform';

describe('tapped notifications', () => {
  test('open the order on the board, the kitchen display for the kitchen, or the table requests', () => {
    expect(pushTarget({ type: 'newOrder', orderId: 'o1' }, 'owner')).toBe('/dashboard/orders?order=o1');
    expect(pushTarget({ type: 'orderReady', orderId: 'o2' }, 'waiter')).toBe('/dashboard/orders?order=o2');
    expect(pushTarget({ type: 'newOrder', orderId: 'o3' }, 'kitchen')).toBe('/kitchen');
    expect(pushTarget({ type: 'tableRequest', requestId: 'r1' }, 'manager')).toBe('/dashboard/orders?requests=1');
    expect(pushTarget({}, 'owner')).toBe('/dashboard/orders');
  });
});

describe('app versions', () => {
  test('compares x.y.z numerically', () => {
    expect(olderThan('1.0.0', '1.0.1')).toBe(true);
    expect(olderThan('1.9.3', '1.10.0')).toBe(true);
    expect(olderThan('2.0.0', '1.99.99')).toBe(false);
    expect(olderThan('1.2.0', '1.2.0')).toBe(false);
  });
});

describe('back button stack', () => {
  test('closes the newest open dialog first, and forgets closed ones', () => {
    const closed = [];
    const removeDrawer = pushBack(() => closed.push('drawer'));
    pushBack(() => closed.push('dialog'));
    expect(popBack()).toBe(true);
    removeDrawer();
    expect(popBack()).toBe(false);
    expect(closed).toEqual(['dialog']);
  });
});

describe('website build', () => {
  test('keeps the session in localStorage, as before', () => {
    expect(IS_APP).toBe(false);
    setSession({ token: 't1', userId: 'u1', role: 'waiter' });
    expect(localStorage.getItem('token')).toBe('t1');
    expect([getToken(), getRole(), isLoggedIn()]).toEqual(['t1', 'waiter', true]);
    clearSession();
    expect(localStorage.getItem('token')).toBeNull();
    expect(isLoggedIn()).toBe(false);
  });

  test('links point to the site it is served from', () => {
    expect(siteOrigin()).toBe(window.location.origin);
  });
});
