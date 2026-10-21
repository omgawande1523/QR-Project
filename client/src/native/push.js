import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../lib/api';
import { isLoggedIn } from '../lib/session';
import { onSignOut } from '../lib/auth';

// Push needs Firebase: the app build only turns it on when mobile/android/app/google-services.json exists
// (see mobile/scripts/app.mjs). Without it, calling the plugin would crash the app on start.
export const PUSH_ENABLED = import.meta.env.VITE_PUSH === 'true';

// One high-priority channel per type, each with its own sound, so staff can tell them apart by ear and set
// them separately in Android's settings. Ids must match server/src/services/push/index.js; the sounds are in
// mobile/android/app/src/main/res/raw (made by mobile/scripts/make-sounds.mjs). Android never changes a
// channel's sound after it is created: use a new id to change one.
export const CHANNELS = [
  { id: 'new_orders', type: 'newOrder', name: 'New orders', description: 'A guest placed an order', sound: 'new_order.wav' },
  { id: 'table_requests', type: 'tableRequest', name: 'Table requests', description: 'Waiter calls and requests for water, cutlery or the bill', sound: 'table_request.wav' },
  { id: 'order_ready', type: 'orderReady', name: 'Ready to serve', description: 'The kitchen marked an order ready', sound: 'order_ready.wav' }
];

let registered = false;

// Once at start-up: channels and listeners. `onOpen(data)` runs when a notification is tapped.
export async function setupPush(onOpen) {
  if (!PUSH_ENABLED) return;
  await Promise.all(CHANNELS.map((c) => PushNotifications.createChannel({
    id: c.id,
    name: c.name,
    description: c.description,
    sound: c.sound,
    importance: 5, // urgent: sound and heads-up, also on the lock screen
    visibility: 1, // public: shown in full on the lock screen
    vibration: true,
    lights: true,
    lightColor: '#A3AD4F'
  })));
  // A new or refreshed device token goes to this device's session on the server.
  PushNotifications.addListener('registration', ({ value }) => {
    api.put('/api/sessions/current/push', { token: value, platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android' }).catch(() => {});
  });
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => onOpen(notification?.data || {}));
  // Signing out ends the session, and with it the token on the server; register again after the next sign-in.
  onSignOut(() => { registered = false; });
}

export async function pushPermission() {
  if (!PUSH_ENABLED) return 'unavailable';
  return (await PushNotifications.checkPermissions()).receive;
}

// After sign-in: asks for permission once (Android 13+) and registers this device. Safe to call often.
export async function registerPush() {
  if (!PUSH_ENABLED || registered || !isLoggedIn()) return pushPermission();
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive.startsWith('prompt')) permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return permission.receive;
  registered = true;
  await PushNotifications.register();
  return 'granted';
}

// Per-device switches for each notification type.
export const savePushPrefs = (prefs) => api.put('/api/sessions/current/push', { prefs });
