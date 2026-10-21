// localStorage / sessionStorage that never throws (private mode, blocked storage, full quota).
function make(store) {
  return {
    get(key, fallback = null) {
      try {
        const raw = store().getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        store().setItem(key, JSON.stringify(value));
      } catch {
        // storage unavailable: the app keeps working for this page view
      }
    },
    remove(key) {
      try {
        store().removeItem(key);
      } catch {
        // ignore
      }
    }
  };
}

export const local = make(() => window.localStorage);
export const session = make(() => window.sessionStorage);
