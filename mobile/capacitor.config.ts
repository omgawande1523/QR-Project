import { readFileSync } from 'fs';
import { join } from 'path';
import type { CapacitorConfig } from '@capacitor/cli';

// App id, name and version: mobile/app.config.json is the one place to change them (Gradle reads it too).
const app = JSON.parse(readFileSync(join(__dirname, 'app.config.json'), 'utf8'));

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.appName,
  // The staff screens, built by `vite build --mode app` (npm run app:build).
  webDir: '../client/dist-app',
  android: {
    // Only for testing against a local API over plain http (10.0.2.2 or the PC's LAN address): set by
    // scripts/app.mjs when VITE_API_URL starts with http://. Release builds use https and keep it off.
    allowMixedContent: process.env.QRMENU_ALLOW_HTTP === '1'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // hidden by the app once the first screen has rendered
      backgroundColor: '#faf6ee',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE'
    },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
