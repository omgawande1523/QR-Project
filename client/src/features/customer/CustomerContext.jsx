import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { local, session } from '../../lib/storage';
import { availableLanguages, localizeItem } from '../../lib/menuLanguage';
import { unitPricePaise, computeBill } from '../../lib/pricing';
import { isActiveOrder } from '../../lib/orderStatus';
import { takePrefetched } from '../../lib/prefetch';

const CustomerContext = createContext(null);

// GET a public endpoint, using the response index.html already started fetching if there is one.
// A failed prefetch is retried through axios, so errors keep their usual shape (err.response.status).
const getJson = (path) => {
  const viaApi = () => api.get(path).then((res) => res.data);
  return takePrefetched(path)?.catch(viaApi) ?? viaApi();
};

export const lineKey = ({ itemId, variantId = '', addOnIds = [], notes = '' }) =>
  [itemId, variantId, [...addOnIds].sort().join('+'), notes.trim().toLowerCase()].join('|');

const keys = (rid) => ({
  cart: `qr.cart.${rid}`,
  orders: `qr.orders.${rid}`,
  favourites: `qr.fav.${rid}`,
  table: `qr.table.${rid}`,
  customer: 'qr.customer',
  language: 'qr.language' // the guest's menu language, kept across restaurants
});

// Everything a customer screen needs: restaurant, live menu, cart, tracked orders, favourites, table.
export function CustomerProvider({ restaurantId, children }) {
  const k = keys(restaurantId);
  const [restaurant, setRestaurant] = useState(null);
  const [rawMenu, setMenu] = useState([]);
  const [chosenLanguage, setChosenLanguage] = useState(() => local.get(k.language, 'en'));
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [lines, setLines] = useState(() => local.get(k.cart, []));
  const [tracked, setTracked] = useState(() => local.get(k.orders, []));
  const [orders, setOrders] = useState({}); // id -> order (with trackingToken)
  const [favourites, setFavourites] = useState(() => new Set(local.get(k.favourites, [])));
  const [table, setTableState] = useState(() => session.get(k.table, null));
  const [cartBump, setCartBump] = useState(0);
  const socketRef = useRef(null);
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;

  // ---------- Load restaurant + menu ----------
  const load = useCallback(async () => {
    try {
      setError(null);
      const [profile, items] = await Promise.all([
        getJson(`/api/users/${restaurantId}/public`),
        getJson(`/api/menu/${restaurantId}`)
      ]);
      setRestaurant(profile);
      setMenu(items);
      setStatus('ready');
    } catch (err) {
      setError(err.response?.status === 404 || err.response?.status === 400
        ? 'We could not find this restaurant. Please scan the QR code on your table again.'
        : 'Could not load the menu. Check your connection and try again.');
      setStatus('error');
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  // ---------- Persist ----------
  useEffect(() => local.set(k.cart, lines), [k.cart, lines]);
  useEffect(() => local.set(k.orders, tracked), [k.orders, tracked]);
  useEffect(() => local.set(k.favourites, [...favourites]), [k.favourites, favourites]);

  // ---------- Live updates ----------
  // socket.io-client is loaded after the menu has started rendering, so it never delays the first screen.
  useEffect(() => {
    let socket = null;
    let cancelled = false;
    import('../../lib/socket').then(({ connectSocket }) => {
      if (cancelled) return;
      socket = connectSocket();
      socketRef.current = socket;
      const trackAll = () => trackedRef.current.forEach((t) => socket.emit('trackOrder', { orderId: t.id, token: t.token }));
      socket.on('connect', () => {
        socket.emit('joinMenu', restaurantId);
        trackAll();
      });
      socket.on('menuUpdated', (item) => {
        setMenu((list) => (list.some((i) => i._id === item._id) ? list.map((i) => (i._id === item._id ? item : i)) : [...list, item]));
      });
      socket.on('menuItemDeleted', ({ _id }) => setMenu((list) => list.filter((i) => i._id !== _id)));
      socket.on('orderUpdated', (order) => {
        setOrders((map) => (map[order._id] ? { ...map, [order._id]: { ...order, trackingToken: map[order._id].trackingToken } } : map));
      });
    }).catch(() => {}); // offline while loading: the menu still works, just without live updates
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [restaurantId]);

  // Fetch tracked orders (their token proves they are ours) and drop ones that no longer exist.
  const refreshOrders = useCallback(async () => {
    const list = trackedRef.current;
    const results = await Promise.all(list.map((t) =>
      api.get(`/api/orders/status/${t.id}`, { params: { token: t.token } })
        .then((res) => ({ ...res.data, trackingToken: t.token }))
        .catch((err) => (err.response?.status === 404 ? null : undefined))));
    setOrders((map) => {
      const next = { ...map };
      results.forEach((order) => { if (order) next[order._id] = order; });
      return next;
    });
    const missing = new Set(list.filter((_, i) => results[i] === null).map((t) => t.id));
    if (missing.size) setTracked((t) => t.filter((o) => !missing.has(o.id)));
  }, []);

  useEffect(() => { refreshOrders(); }, [refreshOrders]);

  // ---------- Table ----------
  const setTable = useCallback((value) => {
    const n = Number(value) || null;
    setTableState(n);
    session.set(k.table, n);
  }, [k.table]);

  // ---------- Menu language ----------
  const languages = useMemo(() => availableLanguages(rawMenu), [rawMenu]);
  const language = languages.some((l) => l.code === chosenLanguage) ? chosenLanguage : 'en';
  const setLanguage = useCallback((code) => {
    setChosenLanguage(code);
    local.set(k.language, code);
  }, [k.language]);
  const menu = useMemo(() => rawMenu.map((item) => localizeItem(item, language)), [rawMenu, language]);

  // ---------- Cart ----------
  const menuById = useMemo(() => new Map(menu.map((i) => [i._id, i])), [menu]);

  const addLine = useCallback(({ itemId, variantId, addOnIds = [], notes = '', quantity = 1 }) => {
    const line = { itemId, variantId: variantId || undefined, addOnIds, notes: notes.trim(), quantity };
    const key = lineKey(line);
    setLines((list) => {
      const existing = list.find((l) => l.key === key);
      if (existing) return list.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l));
      return [...list, { ...line, key }];
    });
    setCartBump((n) => n + 1);
    if (navigator.vibrate) navigator.vibrate(12);
  }, []);

  const setLineQuantity = useCallback((key, quantity) => {
    setLines((list) => (quantity <= 0 ? list.filter((l) => l.key !== key) : list.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l))));
  }, []);

  const setLineNotes = useCallback((key, notes) => {
    setLines((list) => {
      const target = list.find((l) => l.key === key);
      if (!target) return list;
      const updated = { ...target, notes: notes.slice(0, 200) };
      updated.key = lineKey(updated);
      return list.filter((l) => l.key !== key && l.key !== updated.key).concat(updated);
    });
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  // Lines enriched with the live menu: current prices, names, and whether they can still be ordered.
  const cartLines = useMemo(() => lines.map((line) => {
    const item = menuById.get(line.itemId);
    const unitPaise = unitPricePaise(item, line.variantId, line.addOnIds);
    const variant = item?.variants?.find((v) => v._id === line.variantId);
    const addOns = (line.addOnIds || []).map((id) => item?.addOns?.find((a) => a._id === id)).filter(Boolean);
    let problem = null;
    if (!item) problem = 'No longer on the menu';
    else if (!item.available) problem = 'Sold out';
    else if (unitPaise === null) problem = 'Options changed - please re-add';
    return { ...line, item, variant, addOns, unitPaise: unitPaise ?? 0, problem };
  }), [lines, menuById]);

  const cartCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const bill = useMemo(() => computeBill(cartLines.filter((l) => !l.problem), restaurant || {}), [cartLines, restaurant]);
  const quantityForItem = useCallback((itemId) => lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.quantity, 0), [lines]);

  // ---------- Orders ----------
  const placeOrder = useCallback(async ({ customerName, customerPhone }) => {
    const valid = cartLines.filter((l) => !l.problem);
    const res = await api.post('/api/orders', {
      restaurantId,
      tableNumber: table,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      items: valid.map((l) => ({
        menuItem: l.itemId,
        quantity: l.quantity,
        variantId: l.variantId,
        addOnIds: l.addOnIds?.length ? l.addOnIds : undefined,
        notes: l.notes || undefined
      }))
    });
    const order = res.data;
    setOrders((map) => ({ ...map, [order._id]: order }));
    setTracked((list) => [{ id: order._id, token: order.trackingToken, placedAt: order.createdAt }, ...list.filter((t) => t.id !== order._id)]);
    socketRef.current?.emit('trackOrder', { orderId: order._id, token: order.trackingToken });
    if (customerName || customerPhone) local.set(k.customer, { customerName, customerPhone });
    clearCart();
    return order;
  }, [cartLines, restaurantId, table, clearCart, k.customer]);

  // Puts a past order's items back in the cart, matching sizes and add-ons by name.
  const reorder = useCallback((order) => {
    let skipped = 0;
    order.items.forEach((orderItem) => {
      const item = menuById.get(String(orderItem.menuItem));
      if (!item || !item.available) { skipped += 1; return; }
      const variant = orderItem.variant?.name ? item.variants?.find((v) => v.name === orderItem.variant.name) : undefined;
      if (item.variants?.length && !variant) { skipped += 1; return; }
      const addOnIds = (orderItem.addOns || []).map((a) => item.addOns?.find((x) => x.name === a.name)?._id).filter(Boolean);
      addLine({ itemId: item._id, variantId: variant?._id, addOnIds, notes: orderItem.notes || '', quantity: orderItem.quantity });
    });
    return skipped;
  }, [menuById, addLine]);

  const requestService = useCallback(async (type) => {
    const saved = local.get(k.customer, {});
    await api.post('/api/service-requests', { restaurantId, tableNumber: table, type, customerName: saved.customerName || undefined });
  }, [restaurantId, table, k.customer]);

  // Rating a served meal; the tracking token proves the order is ours.
  const rateOrder = useCallback(async (orderId, feedback) => {
    const token = orders[orderId]?.trackingToken;
    const res = await api.post(`/api/orders/${orderId}/feedback`, { token, ...feedback });
    setOrders((map) => ({ ...map, [orderId]: { ...res.data, trackingToken: token } }));
  }, [orders]);

  const trackedOrders = useMemo(() => tracked.map((t) => orders[t.id]).filter(Boolean), [tracked, orders]);
  const activeOrders = trackedOrders.filter((o) => isActiveOrder(o.status));

  // ---------- Favourites ----------
  const toggleFavourite = useCallback((id) => {
    setFavourites((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const value = {
    restaurantId,
    restaurant,
    menu,
    menuById,
    language,
    languages,
    setLanguage,
    status,
    error,
    reload: load,
    table,
    setTable,
    cartLines,
    cartCount,
    cartBump,
    bill,
    addLine,
    setLineQuantity,
    setLineNotes,
    clearCart,
    quantityForItem,
    placeOrder,
    reorder,
    rateOrder,
    requestService,
    orders,
    trackedOrders,
    activeOrders,
    refreshOrders,
    favourites,
    toggleFavourite,
    savedCustomer: local.get(k.customer, {})
  };

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used inside <CustomerProvider>');
  return ctx;
}
