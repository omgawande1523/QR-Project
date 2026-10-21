import { isNative } from '../lib/platform';

// Where the app keeps the signed-in session. On a phone: the plugin's encrypted storage, whose key lives in
// the Android Keystore (iOS: the Keychain). In the app build opened in a normal browser: localStorage.
export async function sessionStore() {
  if (isNative()) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.setKeyPrefix('qrmenu_');
    return {
      get: (key) => SecureStorage.getItem(key),
      set: (key, value) => SecureStorage.setItem(key, value),
      remove: (key) => SecureStorage.removeItem(key)
    };
  }
  return {
    get: async (key) => window.localStorage.getItem(key),
    set: async (key, value) => window.localStorage.setItem(key, value),
    remove: async (key) => window.localStorage.removeItem(key)
  };
}
