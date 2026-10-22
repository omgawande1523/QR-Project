import { pushTarget, olderThan, rotatesFreely } from './AppShell';
import { deviceLabel } from '../native/boot';
import { confirmsDelete } from '../features/owner/AccountSections';
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

describe('iPhone and iPad', () => {
  test('the devices list names the device without its personal name', () => {
    expect(deviceLabel({ platform: 'ios', manufacturer: 'Apple', model: 'iPhone17,2', name: "Asha's iPhone" })).toBe('Apple iPhone');
    expect(deviceLabel({ platform: 'ios', manufacturer: 'Apple', model: 'iPad16,6' })).toBe('Apple iPad');
    expect(deviceLabel({ platform: 'ios', model: '' })).toBe('Apple iPhone');
    expect(deviceLabel({ platform: 'android', manufacturer: 'samsung', model: 'SM-X200' })).toBe('samsung SM-X200');
    expect(deviceLabel({ platform: 'android' })).toBe('Android app');
  });

  test('only the kitchen display turns to landscape on an iPhone', () => {
    expect(rotatesFreely('/kitchen')).toBe(true);
    expect(rotatesFreely('/kitchen/')).toBe(true);
    for (const path of ['/dashboard', '/dashboard/orders', '/login', '/kitchenette']) expect(rotatesFreely(path)).toBe(false);
  });

  test('deleting a restaurant needs DELETE typed out', () => {
    expect(confirmsDelete('DELETE')).toBe(true);
    expect(confirmsDelete(' delete ')).toBe(true);
    for (const text of ['', 'DELET', 'delete it', 'yes']) expect(confirmsDelete(text)).toBe(false);
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
