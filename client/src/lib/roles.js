// Which dashboard areas each role can use. The server enforces the same rules (server/src/middleware/auth.js);
// this only decides what the UI shows.
export const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', waiter: 'Waiter', kitchen: 'Kitchen' };

const ACCESS = {
  home: ['owner', 'manager'],
  orders: ['owner', 'manager', 'waiter'],
  menu: ['owner', 'manager'],
  tables: ['owner', 'manager'],
  analytics: ['owner', 'manager'],
  staff: ['owner'],
  settings: ['owner', 'manager', 'waiter', 'kitchen'], // staff only see their own password
  restaurantSettings: ['owner', 'manager'],
  requests: ['owner', 'manager', 'waiter'],
  accepting: ['owner', 'manager'],
  kitchen: ['owner', 'manager', 'waiter', 'kitchen']
};

export const can = (role, area) => Boolean(role && ACCESS[area]?.includes(role));

// Where each role lands after logging in (or when it opens a page it cannot use).
export const homeFor = (role) => (role === 'kitchen' ? '/kitchen' : role === 'waiter' ? '/dashboard/orders' : '/dashboard');
