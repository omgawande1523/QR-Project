# Publishing QR Menu Staff on Google Play

Everything needed to put the staff app on the Play Store: the listing text, screenshots, the Data safety
answers and the steps. App id `com.qrmenu.staff`, set in `mobile/app.config.json`.

## Before the first release

1. **Firebase** (push notifications): a Firebase project with an Android app for `com.qrmenu.staff`.
   - `google-services.json` goes in `mobile/android/app/` (never committed).
   - The service-account key goes in the server's `FIREBASE_SERVICE_ACCOUNT` (Render environment).
2. **Website live** with `/privacy` and `/delete-account` working (the listing links to both), and
   `VITE_CONTACT_EMAIL` set to the support address used on the listing.
3. **App build settings** in `client/.env.app.local` (not committed):
   ```
   VITE_API_URL=https://api.example.com
   VITE_SITE_URL=https://menu.example.com
   VITE_CONTACT_EMAIL=support@example.com
   ```
4. **Signing key**: `D:\keys\qrmenu-staff.jks`, passwords in `D:\keys\qrmenu-staff.properties`.
   `mobile/android/keystore.properties` (not committed) points Gradle at them. **Back both files up**
   (password manager plus an offline copy). With Play App Signing this is the *upload* key: if it is lost,
   Google can reset it after a support request, but without Play App Signing a lost key means the app can
   never be updated.
5. **Server**: allow the app's origins. They are built in (`https://localhost`, `capacitor://localhost`), so
   there is nothing to add on Render. Set `APP_MIN_VERSION` / `APP_LATEST_VERSION` when you want to prompt
   users to update.

## Build the release bundle

1. Raise the version in `mobile/app.config.json`: `versionCode` must go up by at least 1 for every upload;
   `versionName` is what users see (e.g. `1.0.1`).
2. `npm run app:aab`. This checks the API address is https, builds the staff screens, syncs Capacitor and
   writes a signed bundle to `mobile/dist/qr-menu-staff-<version>.aab`.

## Play Console steps

1. Create the app: name **QR Menu Staff**, default language English (India), App, Free.
2. **Set up your app** tasks:
   - Privacy policy: `https://menu.example.com/privacy`
   - App access: "All or some functionality is restricted". Give a reviewer login, e.g. the demo staff
     accounts (`demo@qrmenu.test` / `Demo@1234` once the demo is seeded on the live server).
   - Ads: No ads.
   - Content rating: questionnaire, category "Utility, productivity, communication or other"; no
     user-generated content shared publicly, no violence: expected rating Everyone / 3+.
   - Target audience: 18 and over (a business tool). Not designed for children.
   - News app: No. Health apps: No. Financial features: No (payments are taken at the counter, not in the app).
   - Government app: No.
   - Data safety: see below.
   - Account deletion: `https://menu.example.com/delete-account` (and in the app: Settings > Delete account).
3. **Store listing**: the text and screenshots below; app icon 512 x 512 (`client/public/logo512.png`); feature
   graphic 1024 x 500 (make one from `client/public/og-image.jpg`).
4. **Testing > Internal testing**: create a release, upload the `.aab`, add testers by email, share the opt-in
   link. Install on a few staff phones and check orders, notifications and printing.
5. When happy: **Production** (or closed testing first). New personal developer accounts must run a closed test
   with at least 12 testers for 14 days before production access is granted.
6. Opt in to **Play App Signing** (default for new apps).

## Store listing text

**App name**: QR Menu Staff

**Short description** (max 80 characters):
> Live orders, kitchen display and GST bills for your restaurant's QR menu.

**Full description**:
> QR Menu Staff is the app for restaurants and cafés that use QR Menu. Guests scan the QR code on their table,
> order from their phone, and the order arrives on your staff's phones instantly.
>
> • Live orders board: accept orders and move them from New to Preparing, Ready, Served and Billed with one tap.
> • Push notifications with their own sounds for new orders, waiter calls and bill requests, and orders ready to
>   serve, even when the phone is locked.
> • Kitchen display for a tablet: big tickets with timers, Start cooking, Bump and Recall; the screen stays on.
> • GST bills: invoice numbers, a printable receipt, an A4 invoice PDF to share on WhatsApp, and a UPI QR code
>   for the exact amount. Mark bills paid by cash, UPI or card.
> • Menu manager: dishes, photos straight from the camera, sizes, add-ons, Hindi and Marathi names, and sold-out
>   in one tap.
> • Tables and QR codes: share or print each table's QR code.
> • Staff accounts: Owner, Manager, Waiter and Kitchen, each seeing only what they need.
> • Sales analytics and guest feedback.
>
> Uses the same account as the QR Menu website. Need an account? Sign up in the app or on the website.

**Category**: Business. **Tags**: restaurant, point of sale, business tools.
**Contact email**: the `VITE_CONTACT_EMAIL` address. **Website**: the site address.

## Screenshots

Phone screenshots (at least 2, 1080 x 1920 or similar, 16:9 or 9:16) and 7-inch / 10-inch tablet screenshots:
`docs/screenshots/app/` has emulator screenshots of the login, orders board, order detail, kitchen display,
menu manager with the camera picker and Settings. Retake them against the live server with real dishes before
publishing.

## Data safety answers

Data is encrypted in transit (HTTPS): **Yes**. Users can request deletion: **Yes** (in the app and on
`/delete-account`). Data is not sold and not used for advertising.

| Data type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- |
| Personal info: Name | Yes (staff name, optional guest name on orders) | No | Staff name required; guest name optional | App functionality, account management |
| Personal info: Email address | Yes | No | Required | Account management, sign-in, password reset |
| Personal info: Phone number | Yes (owner, optional) | No | Optional | Account management |
| Financial info: Purchase history | Yes (orders and bills of the restaurant) | No | Required | App functionality |
| Photos | Yes (dish photos and logos the user chooses to upload) | No | Optional | App functionality |
| App activity: Other user-generated content | Yes (menu, guest ratings and comments) | No | Optional | App functionality |
| Device or other IDs | Yes (push notification token, device model for the signed-in devices list) | No | Required for notifications | App functionality, security |

Not collected: location, contacts, messages, audio, files, calendar, health, web browsing, app interactions
for analytics, crash logs (none sent), advertising ID.

Service providers that process data on our behalf (not "sharing" under Play's definition): MongoDB Atlas
(database), Render (server), Cloudinary (photos), Google Firebase Cloud Messaging (notifications).

## Permissions the app uses

| Permission | Why |
| --- | --- |
| Internet, network state | Talk to the restaurant's server; show "offline" and reconnect |
| Notifications (Android 13+, asked on first sign-in) | Order and table-request alerts |
| Vibrate | Haptic feedback when an order changes |
| Camera (system camera app, no permission declared) | "Take photo" for dish photos |
| Photos (system photo picker, no permission declared) | "Choose from gallery" |

## Every update

1. Bump `versionCode` (and `versionName`) in `mobile/app.config.json`.
2. `npm run app:aab`, upload to the testing track, then promote.
3. To make old versions update, raise `APP_MIN_VERSION` on the server once the new version is live.
