# Publishing QR Menu Staff on the App Store

Everything needed to publish the iPhone and iPad app: the listing text, the screenshots, the App Privacy
answers, the review account and notes, and the steps from the first TestFlight build to release. The Android
listing is in [PLAY_STORE.md](PLAY_STORE.md); both apps are built from the same code.

Replace `menu.example.com` (the website) and `api.example.com` (the API) with the real addresses.

## The app

| | |
| --- | --- |
| Name | QR Menu Staff |
| Bundle ID | `com.qrmenu.staff` (same as Android) |
| SKU | `qrmenu-staff-ios` |
| Version | `versionName` in `mobile/app.config.json` (build number set by the cloud build) |
| Primary category | Business |
| Secondary category | Food & Drink |
| Price | Free, no in-app purchases |
| Age rating | 4+ (every questionnaire answer is "None") |
| Devices | iPhone and iPad, iOS 15.0 or later |
| Encryption | Standard HTTPS only: `ITSAppUsesNonExemptEncryption` is `NO` in Info.plist, so no export compliance form |

## Listing text

**Subtitle** (30 characters max)

> Orders, kitchen and menu

**Promotional text** (170 max, can be changed without a new version)

> New orders ring on every phone, the kitchen screen stays on, and the menu changes live. The staff app for restaurants using QR Menu.

**Description** (4,000 max)

> QR Menu Staff is the app for the team behind a restaurant or café that takes orders with QR Menu. Guests scan
> the QR code on their table, browse the menu and order from their own phone; the order reaches your staff at
> once, and they move it from the kitchen to the table from this app.
>
> FOR EVERY ROLE
> • Owners and managers: the live orders board, the menu, tables and QR codes, bills, analytics, guest feedback,
>   staff logins and settings.
> • Kitchen: a full-screen kitchen display that stays on during service, in portrait or landscape on an iPad.
> • Waiters: the orders board, ready-to-serve alerts and table requests.
>
> ALERTS THAT GET NOTICED
> • New orders, waiter calls and bill requests ring even when the phone is locked, each with its own sound.
> • New orders and table requests are time-sensitive, so they still come through during Focus.
> • Tap an alert to open that order. Each person chooses which alerts their phone gets.
>
> RUN SERVICE FROM YOUR PHONE
> • Accept, prepare and serve orders with a tap; the guest sees the status on their phone.
> • Change prices, mark dishes sold out and add new dishes with photos from the camera.
> • Share table QR codes and bills as PDFs, or print them with AirPrint.
> • GST-ready bills with a UPI QR code for payment.
>
> SAFE AND PRIVATE
> • Your login is kept in the iOS Keychain. See and sign out every signed-in device from Settings.
> • No ads and no tracking.
>
> QR Menu Staff needs a QR Menu restaurant account. Create one free in the app or at menu.example.com.

**Keywords** (100 max, commas, no spaces; the name is indexed already)

> restaurant,orders,kitchen,KOT,QR,cafe,waiter,billing,GST,table,dine-in,tickets,bell,POS

| | |
| --- | --- |
| Support URL | `https://menu.example.com` (or a contact page) |
| Marketing URL | `https://menu.example.com` |
| Privacy Policy URL | `https://menu.example.com/privacy` (also linked in the app: Settings > Privacy and about) |
| Copyright | `2026 <your company name>` |

## Screenshots

App Store Connect needs at least one screenshot per device family the app supports, and takes up to 10. The
sizes for the largest devices are enough; Apple scales them down for smaller ones.

| Display | Device | Size (pixels) |
| --- | --- | --- |
| 6.9" iPhone (required) | iPhone 16/17 Pro Max | 1320 x 2868 portrait (or 2868 x 1320 landscape) |
| 13" iPad (required, the app runs on iPad) | iPad Pro 13-inch | 2064 x 2752 portrait (or 2752 x 2064 landscape) |

The **ios-check** cloud build (Codemagic or GitHub Actions) takes them on exactly these simulators (iPhone Pro
Max and iPad Pro 13-inch) with the demo restaurant: download the `ios-check` artifact and pick from
`iPhone-*.png` and `iPad-*.png` (landscape screens are captured sideways: rotate them upright first, as
`docs/screenshots/app/ios-ipad-kitchen-landscape.png` was). Suggested set: orders board, kitchen display (iPad landscape), dashboard home,
menu editor, bill with UPI QR, table QR codes, settings with signed-in devices. Screenshots must show the app
itself (no device frames are needed) and no real guests' personal data; the demo data is made up.

## App Privacy ("nutrition label")

App Store Connect > App Privacy. Answers that match what the app sends to the server:

**Do you or your third-party partners collect data from this app?** Yes.

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
| --- | --- | --- | --- | --- |
| Contact Info > Name | Yes (staff member names, restaurant name) | Yes | No | App Functionality |
| Contact Info > Email Address | Yes (owner and staff logins) | Yes | No | App Functionality |
| Contact Info > Phone Number | Yes (optional, owner login and restaurant contact) | Yes | No | App Functionality |
| User Content > Photos or Videos | Yes (dish photos, logo and banner the owner uploads) | Yes | No | App Functionality |
| User Content > Other User Content | Yes (menu text, restaurant settings) | Yes | No | App Functionality |
| Financial Info > Other Financial Info | Yes (the restaurant's UPI ID and GSTIN, printed on bills) | Yes | No | App Functionality |
| Identifiers > Device ID | Yes (the push notification token of the device) | Yes | No | App Functionality |
| Diagnostics > Other Diagnostic Data | Yes (server request logs: address, result, time taken) | No | No | App Functionality |

Not collected: location, contacts, browsing or search history, health, purchases, usage data or analytics,
crash data, advertising data, sensitive info, audio. No data is used for tracking and there are no third-party
advertising or analytics SDKs. (Orders and guest names come from guests on the website, not from this app.)

## Apple's review rules this app meets

- **Account deletion in the app (5.1.1(v))**: Settings > Delete account. An owner types DELETE and their
  password, and the restaurant with all its data is deleted; staff delete their own login. The web page
  `/delete-account` stays for the Play Store.
- **Privacy policy in the app and the listing (5.1.1(i))**: Settings > Privacy and about, and the URL above.
- **No purchases outside the App Store (3.1.1)**: the app has no prices, plans, upgrade buttons or payment links;
  creating a restaurant is free. The website's pricing page is not part of the app.
- **Sign in with Apple (4.8)**: not required; the app uses its own email and password accounts only.
- **Permissions**: camera, photo library and photo library add only, each with a specific reason. Push
  notifications are asked for after sign-in.
- **A working demo account (2.1)**: below.

## Review account

Reviewers need a restaurant with data. `npm run seed:review` creates **App Review Café** (the demo menu,
tables, live and past orders) with three logins sharing one password:

| Login | Role |
| --- | --- |
| `appreview@qrmenu.app` | Owner (everything) |
| `appreview.waiter@qrmenu.app` | Waiter |
| `appreview.kitchen@qrmenu.app` | Kitchen |

It is a normal account, not the read-only demo, so reviewers can try every feature, deleting it included. Run
the seed again to bring it back. Only that account's data is touched, so it is safe on the production database.

**Create it on production** with the production settings (database, storage) and a long password of your own:

- On Render (paid plans have a Shell): open the API service > Shell and run
  `cd server && REVIEW_PASSWORD='<long password>' node scripts/seed.js --review`.
- Or from this PC: copy the production values (`MONGODB_URI`, `STORAGE_DRIVER`, `CLOUDINARY_URL`,
  `PUBLIC_URL`, `JWT_SECRET`, `NODE_ENV=production`) into the environment of a terminal, never into a file in
  the repository, then run `npm run seed:review` with `REVIEW_PASSWORD` set.

Put the owner login and the password in App Store Connect > the version > App Review Information > Sign-in
information.

## Review notes

Paste into App Review Information > Notes (replace the addresses):

> QR Menu Staff is the staff app for restaurants that use QR Menu (https://menu.example.com). Guests do not use
> this app: they scan a QR code on their table and order on the restaurant's web menu. Restaurant staff use this
> app to receive and manage those orders.
>
> Sign in with the owner account in the Sign-in information (App Review Café, a test restaurant with sample
> menu, tables and orders). To try other roles, sign in with appreview.kitchen@qrmenu.app (kitchen display) or
> appreview.waiter@qrmenu.app (orders board), same password.
>
> To see a new order arrive live: open https://menu.example.com/menu/<App Review Café id>?table=1 in Safari (or
> scan a table QR code from Tables & QR in the app), add a dish and place the order. It appears on the Orders
> board (and the kitchen display); tap Accept, then Mark ready.
>
> Account deletion: Settings > Delete account (type DELETE and the password). The review account can be deleted;
> we restore it for later reviews.
>
> The app has no in-app purchases and no subscriptions; restaurant accounts are free. Notifications are used only
> for new orders, table requests and ready orders.

(The App Review Café id is printed by `npm run seed:review` as "Customer menu".)

## From the first build to the App Store

One-time setup, in this order (each needs your accounts):

1. **Apple Developer Program**: enrol at https://developer.apple.com/programs/ (USD 99 a year, an organisation
   needs a D-U-N-S number).
2. **App ID**: developer.apple.com > Certificates, Identifiers & Profiles > Identifiers > + > App IDs > App.
   Bundle ID `com.qrmenu.staff` (explicit). Tick **Push Notifications** and **Time Sensitive Notifications**.
3. **Push (APNs) key**: Keys > + > tick Apple Push Notifications service (APNs) > download the `.p8` file (only
   once; keep it outside the repository) and note the Key ID and your Team ID.
4. **Firebase**: in the same Firebase project as Android, Project settings > General > Add app > iOS, bundle ID
   `com.qrmenu.staff`; download `GoogleService-Info.plist`. Then Project settings > Cloud Messaging > Apple app
   configuration > APNs Authentication Key: upload the `.p8` with its Key ID and Team ID.
5. **App Store Connect app**: https://appstoreconnect.apple.com > Apps > + > New App: platform iOS, name QR Menu
   Staff, language English (U.K.) or (U.S.), bundle ID `com.qrmenu.staff`, SKU `qrmenu-staff-ios`. Note the
   **Apple ID** number on the app's App Information page (for `APP_STORE_APPLE_ID` and the update link).
6. **App Store Connect API key** (for the cloud builds): Users and Access > Integrations > App Store Connect API
   > Team Keys > + with the **App Manager** role. Download the `.p8` (once), note the Key ID and Issuer ID.
7. **Cloud build secrets**: README.md, "iOS staff app", lists each secret and where it goes (Codemagic or
   GitHub). Never commit them.

Each release:

1. Raise `versionName` in `mobile/app.config.json` for a new version (`versionCode` is Android's).
2. Start **ios-release** in Codemagic (or the GitHub Actions workflow with `release`). It builds with https only,
   signs automatically, numbers the build one above the last TestFlight build and uploads it.
3. **TestFlight**: after Apple's processing (10-30 minutes) the build appears under TestFlight. Add yourself and
   your staff as internal testers and install with the TestFlight app; check sign-in, orders, alerts (on a real
   phone: simulators cannot receive push), the camera, AirPrint and the kitchen display on an iPad.
4. **Submit**: App Store tab > the version > pick the build, fill in the listing, screenshots, App Privacy,
   review information (account and notes above), then **Add for Review** > **Submit**. First reviews usually take
   one to three days.
5. When it is live, set `APP_UPDATE_URL_IOS=https://apps.apple.com/app/id<Apple ID>` on the API (Render) so the
   update prompt opens the App Store page. Raise `APP_LATEST_VERSION` (or `APP_MIN_VERSION`) when a new version
   is out.
