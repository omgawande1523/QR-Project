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
  // The app's pages load from https://localhost (an origin the API allows). Testing against a local API
  // over plain http (10.0.2.2 or the PC's LAN address) would make every image "mixed content", which Android
  // blocks, so those builds use http://localhost instead (allowed by the API in development only).
  // scripts/app.mjs sets QRMENU_ALLOW_HTTP when VITE_API_URL starts with http://; release builds never do.
  server: {
    androidScheme: process.env.QRMENU_ALLOW_HTTP === '1' ? 'http' : 'https'
  },
  // iOS loads the screens from capacitor://localhost (also allowed by the API). Plain http to a local test API
  // needs an App Transport Security exception for that one host, which only simulator builds add
  // (scripts/app.mjs ios-ats); release builds talk https only.
  ios: {
    contentInset: 'never', // edge to edge; the CSS keeps clear of the notch and home indicator (app.css)
    preferredContentMode: 'mobile', // iPad gets the touch layout, not a desktop-style page
    allowsLinkPreview: false, // a long press drags an order card instead of previewing a link
    backgroundColor: '#faf6ee'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // hidden by the app once the first screen has rendered
      backgroundColor: '#faf6ee',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE'
    },
    SystemBars: {
      // The app's CSS uses env(safe-area-inset-*) (client/src/app/app.css), so no injected variables needed.
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      // iOS: the web view shrinks above the keyboard, so dialogs and focused fields stay visible
      resize: 'native'
    }
  }
};

export default config;
