# Roadmap

## Phase 4: features that make it sellable (done)

1. ~~Kitchen Display Screen (`/kitchen`)~~ done.
   Replaces the old dashboard's "kitchen mode", removed in Phase 3.
2. ~~Staff accounts with roles~~ done.
3. ~~Bill / invoice: printable GST invoice per order (PDF), mark paid (cash / UPI / card)~~ done.
4. ~~Analytics: sales by day and week, by item, by category, peak hours, table usage (charts)~~ done.
5. ~~Customer feedback: rate the meal after an order is served~~ done.
6. ~~Multi-language menu (English / Hindi / Marathi) for item names and descriptions (optional fields)~~ done.
7. Optional online payment: Razorpay test mode behind a feature flag (pay at counter stays the default).
   Skipped for now (owner decision, 21 Oct 2026): pay at the counter (cash, UPI QR on the bill, card) only.
   Moved to Phase 6.
8. ~~PWA: installable customer menu and dashboard, offline fallback page, real app icons~~ done.
9. ~~SEO / meta tags and an Open Graph image for the landing page~~ done.
10. ~~Abandoned-upload cleanup: delete unused images older than 24 hours, keeping originals that back a used crop~~ done.

## Phase 5: quality, verification, docs (done, 21 Oct 2026)

- ~~React Testing Library tests for cart maths and the order flow; extend the Playwright suite~~ done.
- ~~Every screen at 375 / 768 / 1440 px: no horizontal scroll, 44 px tap targets, nothing under the bottom nav,
  long dish names and Hindi/Marathi text~~ done; checked on every run by `e2e/quality.spec.js`.
- ~~Performance~~ done: shared chunks grouped, socket.io deferred, the menu's API requests start from
  `index.html`, responsive dish photos (`?w=` copies or Cloudinary transformations) with eager first cards,
  gzip on the API, Devanagari font only when needed. Lighthouse (mobile, production build): customer menu
  performance 90-92, landing 92-97, dashboard 98-100; accessibility and best practices 100 everywhere; SEO 100
  on public pages (staff pages are deliberately not crawlable).
- ~~Accessibility~~ done: WCAG 2.1 AA (axe-core) on every screen, keyboard-only ordering, a visible focus ring
  with checked contrast, dialogs that trap focus and give it back, spoken cart and order-status updates;
  checked by `e2e/keyboard.spec.js`.
- ~~No console errors or React warnings; no unused files, dependencies or dead CSS~~ done.
- ~~Production readiness~~ done: Cloudinary image storage (`STORAGE_DRIVER=cloudinary`), `/health`, graceful
  shutdown, JSON logs without sensitive data, `render.yaml`, Vercel and Netlify config, `npm run e2e:prod`.
- ~~Full README, deployment guide and a user guide for restaurant owners~~ done.

## Phase 6: QR Menu Staff, the Android app (done, 21 Oct 2026)

- ~~Capacitor 8 app in `mobile/` packaging the dashboard screens (`vite build --mode app`), no guest code~~ done.
- ~~Same accounts and role rules; signed-in device sessions with sign out per device and everywhere; password
  changes end app sessions too; app origins allowed for CORS and Socket.io~~ done.
- ~~Feature parity, plus camera photos, share sheet for QR codes and invoices, Android printing, kitchen screen
  kept awake~~ done.
- ~~Push notifications per role (FCM HTTP v1, mock sender in tests), per-device switches, reconnect and refetch on
  foreground and network return, offline banner, back button, pull to refresh, haptics, icon and splash~~ done;
  live push needs the Firebase project (`google-services.json` and `FIREBASE_SERVICE_ACCOUNT`).
- ~~Debug APK, signed release AAB, versions in `mobile/app.config.json`, `/privacy`, `/delete-account`, account
  deletion, `/api/app-version` update prompt, docs/PLAY_STORE.md~~ done.
- Not done (optional): Bluetooth thermal printer receipts (ESC/POS, 58/80 mm) behind a setting.

## Phase 7: QR Menu Staff for iPhone and iPad (done, 22 Oct 2026)

- ~~iOS project in `mobile/ios` from the same React code and app build, Swift Package Manager, iOS 15+, iPhone
  and iPad (iPad any orientation; iPhone portrait except the kitchen display)~~ done.
- ~~Icons and launch screen in the brand colours; camera, photo library usage text; safe areas on every screen,
  dialog, sheet and the kitchen display~~ done.
- ~~Parity: Keychain login, iOS sessions in the devices list, camera and Photos, share sheet, AirPrint, kitchen
  kept awake, reconnect and offline banner, pull to refresh, haptics, visible Close buttons and swipe back,
  keyboard handling, App Store update link (`APP_UPDATE_URL_IOS`)~~ done.
- ~~Push through FCM and APNs: platform per device token, APNs payload with the sound and the time-sensitive
  level for new orders and table requests~~ done, tested with the mock sender; live push needs the APNs key and
  `GoogleService-Info.plist`.
- ~~App Review: in-app account deletion with typed DELETE, privacy policy in Settings, no purchase links, review
  account (`npm run seed:review`), docs/APP_STORE.md~~ done.
- ~~Cloud builds: `codemagic.yaml` (ios-check, ios-release to TestFlight) and a manual GitHub Actions workflow;
  WebKit end-to-end runs at iPhone and iPad sizes~~ done. The simulator check runs on GitHub's Macs; the signed
  release needs the Apple Developer account.
- Bluetooth printer (not built on either platform yet): iOS only allows **Bluetooth Low Energy** printers, and
  most cheap "classic Bluetooth" 58 mm ESC/POS printers do not work with iPhones. When the feature is built:
  BLE ESC/POS on iOS, classic and BLE on Android, and a clear "This printer isn't supported on iPhone" message
  for classic-only printers.

## Phase 8: next steps

Suggested order. The first three turn the product into something that can be sold and run as a business.

1. **Go live**: create the Atlas, Cloudinary, Render and Vercel/Netlify accounts, deploy with `render.yaml`,
   connect the domain, then print QR codes from the final address. Set up Firebase and publish QR Menu Staff
   (docs/PLAY_STORE.md, docs/APP_STORE.md). Add uptime monitoring on `/health`
   (UptimeRobot or Better Stack) and error alerts (Sentry for the client and the API).
2. **Subscriptions and billing for selling the product**: the plans on the landing page (Starter, Growth,
   Business) become real. Razorpay Subscriptions with a free trial, plan limits enforced on the server (tables,
   staff, menu items), a billing page for owners (plan, renewal date, invoices with our GSTIN), dunning emails and
   a grace period, and a super-admin panel to see restaurants, plans and revenue.
3. **Online payment for guests** (Phase 4 item 7): Razorpay or a UPI intent link from the cart, behind a
   per-restaurant switch, with payment status on the board and refunds from the bill. Pay at the counter stays
   the default.
4. **Multi-branch**: one owner account with several outlets, each with its own menu (or a shared menu with
   per-branch prices and availability), tables, staff and kitchen screen; analytics per branch and combined;
   staff who work at more than one branch.
5. **Operations**: daily sales report by email or WhatsApp, simple stock tracking that marks dishes sold out
   automatically, Bluetooth thermal printers for receipts and kitchen tickets from the app (BLE printers only on
   iPhone, see Phase 7), table merge and transfer, and split bills.
6. **Guests**: WhatsApp order updates, a loyalty stamp card, and dish recommendations ("goes well with").
7. **Platform**: automated backups with a tested restore, a staging environment (`CLOUDINARY_FOLDER` and a
   second Atlas database), CI running `npm test`, `npm run lint` and `npm run e2e` on every pull request, and the
   rest of the interface (not just dish names) in Hindi and Marathi.
8. **Subscriptions in the iPhone app**: if plans are sold inside the iPhone app later, Apple requires In-App
   Purchase for them; until then the app shows no prices or upgrade links (Phase 7).
