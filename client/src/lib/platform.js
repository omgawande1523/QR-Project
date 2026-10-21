// Which build is running, and the few places where the staff app behaves differently from the website.
//
// IS_APP is fixed at build time (`vite build --mode app`, see vite.config.js). In the website build it is the
// literal `false`, so every `if (IS_APP)` branch, and the Capacitor code it imports, is dropped from the bundle.
// isNative() is true only inside the installed Android/iOS app; the app build opened in a normal browser
// (end-to-end tests, a quick look on the PC) runs without native plugins and falls back to web behaviour.
export const IS_APP = import.meta.env.VITE_APP === 'true';

export const isNative = () => IS_APP && Boolean(window.Capacitor?.isNativePlatform?.());
// Native code below sits in `if (IS_APP && isNative())` blocks: the literal IS_APP lets the website build drop
// the block and the plugin it imports (a function call alone would not).

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

// The public website: QR codes, menu links and the privacy page must point there, also from inside the app
// (whose own pages live at https://localhost).
export function siteOrigin() {
  if (!IS_APP) return window.location.origin;
  return (import.meta.env.VITE_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

// Opens a website page (customer menu, privacy policy): a new tab on the web, the browser from the app.
export async function openExternal(url) {
  if (IS_APP && isNative()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener');
}

// A short vibration when an order moves on (app only).
export function haptic() {
  if (IS_APP && isNative()) {
    import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium })).catch(() => {});
  }
}

/**
 * Saves a generated file: a download on the website, the Android share sheet in the app (WhatsApp, Drive,
 * Gmail, print services...). `blob` is a Blob; returns once the browser download started or the sheet closed.
 */
export async function saveFile(blob, filename, { title = filename } = {}) {
  if (IS_APP && isNative()) {
    const { shareBlob } = await import('../native/files');
    await shareBlob(blob, filename, title);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// Prints the current page: the browser's print dialog, or Android's print service in the app.
export async function printPage(jobName = 'Receipt') {
  if (IS_APP && isNative()) {
    const { printWebView } = await import('../native/print');
    await printWebView(jobName);
    return;
  }
  window.print();
}

// Callbacks for "the app came back to the foreground" and "the network is back" (app only), so screens can
// reconnect and refetch. Returns an unsubscribe function. On the website it does nothing.
const resumeListeners = new Set();
export function onAppResume(fn) {
  if (!IS_APP) return () => {};
  resumeListeners.add(fn);
  return () => resumeListeners.delete(fn);
}
export function notifyAppResume(reason) {
  resumeListeners.forEach((fn) => { try { fn(reason); } catch { /* one listener never blocks the others */ } });
}
