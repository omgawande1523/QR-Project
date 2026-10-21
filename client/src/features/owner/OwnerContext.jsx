import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { connectSocket } from '../../lib/socket';
import { getToken, getUserId, getRole, setSession } from '../../lib/session';
import { can } from '../../lib/roles';
import { local } from '../../lib/storage';
import { useToast } from '../../components/ui';

const OwnerContext = createContext(null);
const ALERTS_KEY = 'qr.alerts';
const DEFAULT_ALERTS = { sound: true, voice: false, browser: false };

// Restaurant profile, live orders and service requests for every owner screen, plus new-order alerts.
export function OwnerProvider({ children }) {
  const userId = getUserId();
  const toast = useToast();
  // Who is logged in. Starts from the stored role and is confirmed by /api/users/me.
  const [me, setMe] = useState(() => ({ role: getRole(), name: '' }));
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [requests, setRequests] = useState([]);
  const [connected, setConnected] = useState(false);
  const [alerts, setAlertsState] = useState(() => ({ ...DEFAULT_ALERTS, ...local.get(ALERTS_KEY, {}) }));
  const socketRef = useRef(null);
  const listeners = useRef(new Map());
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const roleRef = useRef(me.role);
  roleRef.current = me.role;

  const setAlerts = useCallback((patch) => {
    setAlertsState((current) => {
      const next = { ...current, ...patch };
      local.set(ALERTS_KEY, next);
      return next;
    });
  }, []);

  const announce = useCallback((title, body) => {
    const prefs = alertsRef.current;
    if (prefs.sound) new Audio('/notification.wav').play().catch(() => {});
    if (prefs.voice && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(body ? `${title}. ${body}` : title);
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
    if (prefs.browser && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: '/favicon.ico', tag: title });
    }
  }, []);

  // ---------- Initial data ----------
  const loadProfile = useCallback(async () => {
    const res = await api.get(`/api/users/${userId}`);
    setProfile(res.data);
    return res.data;
  }, [userId]);

  const loadOrders = useCallback(async () => {
    // Today's orders (for the home stats) plus anything still open from earlier days.
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const res = await api.get('/api/orders', { params: { openSince: midnight.toISOString(), limit: 1000 } });
    setOrders(res.data);
    setOrdersLoaded(true);
  }, []);

  useEffect(() => {
    api.get('/api/users/me').then((res) => {
      setMe(res.data);
      setSession({ token: getToken(), role: res.data.role });
      if (can(res.data.role, 'requests')) api.get('/api/service-requests').then((r) => setRequests(r.data)).catch(() => {});
    }).catch(() => {});
    loadProfile().catch((err) => toast.error(errorMessage(err, 'Could not load your restaurant')));
    loadOrders().catch((err) => toast.error(errorMessage(err, 'Could not load orders')));
  }, [loadProfile, loadOrders, toast]);

  // ---------- Live updates ----------
  useEffect(() => {
    const socket = connectSocket(getToken());
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('newOrder', (order) => {
      setOrders((list) => (list.some((o) => o._id === order._id) ? list : [order, ...list]));
      toast.info(`New order · Table ${order.tableNumber}`);
      announce(`New order from table ${order.tableNumber}`, order.items.map((i) => `${i.quantity} ${i.menuItemName}`).join(', '));
    });
    socket.on('orderUpdated', (order) => setOrders((list) => list.map((o) => (o._id === order._id ? order : o))));
    socket.on('serviceRequest', (request) => {
      if (!can(roleRef.current, 'requests')) return; // the kitchen does not handle table requests
      setRequests((list) => [request, ...list.filter((r) => r._id !== request._id)]);
      toast.info(`${request.type} · Table ${request.tableNumber}`);
      announce(`${request.type} requested`, `Table ${request.tableNumber}`);
    });
    const relay = (event) => (payload) => listeners.current.get(event)?.forEach((fn) => fn(payload));
    socket.on('menuUpdated', relay('menuUpdated'));
    socket.on('menuItemDeleted', relay('menuItemDeleted'));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [announce, toast]);

  // Lets a screen listen to menu events without opening a second socket.
  const subscribe = useCallback((event, fn) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(fn);
    return () => listeners.current.get(event)?.delete(fn);
  }, []);

  // ---------- Actions ----------
  const saveProfile = useCallback(async (patch, { silent = false } = {}) => {
    const res = await api.put(`/api/users/${userId}`, patch);
    setProfile(res.data);
    if (!silent) toast.success('Saved');
    return res.data;
  }, [userId, toast]);

  const setOrderStatus = useCallback(async (orderId, status) => {
    try {
      const res = await api.put(`/api/orders/${orderId}`, { status });
      setOrders((list) => list.map((o) => (o._id === orderId ? res.data : o)));
      return res.data;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the order'));
      throw err;
    }
  }, [toast]);

  // Puts an order returned by the API (bill, payment) on the board without waiting for the socket.
  const replaceOrder = useCallback((order) => {
    setOrders((list) => list.map((o) => (o._id === order._id ? order : o)));
  }, []);

  const markRequestHandled = useCallback(async (id) => {
    setRequests((list) => list.filter((r) => r._id !== id));
    try {
      await api.delete(`/api/service-requests/${id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the request'));
    }
  }, [toast]);

  const value = useMemo(() => ({
    userId,
    me,
    role: me.role,
    profile,
    loadProfile,
    saveProfile,
    orders,
    ordersLoaded,
    loadOrders,
    setOrderStatus,
    replaceOrder,
    requests,
    markRequestHandled,
    connected,
    alerts,
    setAlerts,
    subscribe
  }), [userId, me, profile, loadProfile, saveProfile, orders, ordersLoaded, loadOrders, setOrderStatus, replaceOrder, requests, markRequestHandled, connected, alerts, setAlerts, subscribe]);

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error('useOwner must be used inside <OwnerProvider>');
  return ctx;
}
