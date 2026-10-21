# QR Menu

QR code digital menu and table ordering system for restaurants and cafés. Customers scan the QR code on
their table, browse the menu, and place orders; the restaurant sees orders live on its dashboard.

> Work in progress: this monorepo is being turned into a production SaaS product. The full product guide,
> screenshots and deployment notes will be added as the work lands.

## Structure

```
QR-Project/
├── client/            React 18 app (Vite)
│   └── src/           features/{customer,owner,auth,landing}, components/ui, lib, styles
├── server/            Express + Mongoose + Socket.io API
│   └── scripts/       maintenance scripts (seed, guarded reset)
├── design-reference/  brand colour and UI references
├── docs/              screenshots, roadmap
├── e2e/               Playwright end-to-end tests
└── package.json       root scripts that drive both apps
```

## Requirements

- Node.js 22 LTS (22.12 or newer) and npm 10 or newer. The repo has an `.nvmrc`, so `nvm use` (nvm-windows:
  `nvm install 22` then `nvm use 22`) picks the right version. Node 18 and 20 are not supported.
  On Render, set the environment variable `NODE_VERSION=22` (Render also reads `.nvmrc`); on Netlify/Vercel
  set the Node version to 22 in the project settings.
- MongoDB on `mongodb://localhost:27017`: MongoDB Community Server, a Docker container, or a MongoDB Atlas URI

To run MongoDB in Docker:

```powershell
docker run -d --name qr-mongo -p 27017:27017 -v qr-mongo-data:/data/db mongo:7
```

## Setup (Windows PowerShell)

```powershell
git clone https://github.com/omgawande1523/QR-Project.git
cd QR-Project
npm run install:all
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Then open `server\.env` and set `JWT_SECRET` to a long random string:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running

```powershell
npm run dev
```

This starts the API on http://localhost:5000 and the React app (Vite) on http://localhost:3000; if port 3000
is taken, Vite uses the next free port (3001 is already allowed by the API in development).

| Script | What it does |
| --- | --- |
| `npm run install:all` | Installs root, server and client dependencies |
| `npm run dev` | Runs server (nodemon) and client (Vite) together |
| `npm run build` | Production build of the client into `client/build` |
| `npm start` | Starts the API server |
| `npm run seed` | Loads demo data |
| `npm test` | Runs server tests (Jest + Supertest) and client tests (Vitest) |
| `npm run lint` | Lints the client |
| `npm run e2e` | Playwright end-to-end tests (run `npm run seed` first; starts the dev servers if needed) |

## Demo data

```powershell
npm run seed
```

Creates the demo restaurant **Olive Leaf Café** (22 dishes with photos, 5 tables, sample orders and a pending
waiter call) and prints its customer-menu link. Log in to the dashboard with **demo@qrmenu.test / Demo@1234** (owner).
Staff logins with the same password: **manager@qrmenu.test**, **waiter@qrmenu.test**, **kitchen@qrmenu.test**.
Re-running replaces only the demo account's own data. Image credits: `server/scripts/seed-assets/CREDITS.md`.

## Screens

| Area | Routes |
| --- | --- |
| Marketing | `/` landing page, `/demo` opens the demo café |
| Customer (from a table QR code) | `/menu/:restaurantId?table=N` welcome, `/browse` menu, `/item/:id`, `/cart`, `/orders`, `/orders/:id` live tracking |
| Owner and staff | `/login`, `/register`, `/dashboard` home, `/dashboard/orders`, `/dashboard/menu`, `/dashboard/tables`, `/dashboard/analytics`, `/dashboard/feedback`, `/dashboard/staff`, `/dashboard/settings`, `/kitchen` kitchen display |

Screenshots at 375px and 1440px are in [docs/screenshots](docs/screenshots). The planned next steps are in
[docs/ROADMAP.md](docs/ROADMAP.md).

### Design system

All colours, type, radii, shadows and spacing are tokens in `client/src/styles/tokens.css` (olive scale around
`--olive-500`, cream background, ink text). Filled buttons use `--olive-700` with white text so they pass WCAG AA;
light olive is only used under dark text. Reusable components live in `client/src/components/ui`.

### Billing

"Bill" on a served order assigns a GST invoice number, consecutive per restaurant and Indian financial year
(`2026-27/000001`, within GST's 16-character limit), and opens the bill: an 80 mm printable receipt and an A4
invoice PDF with GSTIN, place of supply (from the GSTIN state code), SAC 996331, taxable value, CGST/SGST split
in whole paise and the amount in words. Without a GSTIN the document is titled "Bill" instead of "Tax Invoice".
If the restaurant sets a UPI ID in Settings, unpaid bills carry a UPI QR code with the amount filled in.
"Mark paid" records cash, UPI or card (with an optional reference) and closes the order. Payment taken before
the food is served keeps the order on the kitchen display. Owners, managers and waiters can bill; the kitchen
cannot.

### Analytics

`/dashboard/analytics` (owner and manager) shows sales for today, 7, 30 or 90 days or a custom range, in India
time and excluding cancelled orders: sales, orders, average order and dishes sold against the previous period;
sales by day (or by week for ranges over a month); top dishes; sales by category; a weekday x hour heatmap of
orders; orders, sales and QR scans per table; and the payment mix. Charts are plain SVG/HTML in the olive palette
(colours checked for contrast and lightness steps), with hover and keyboard tooltips and a table view for each.
The demo seed includes eight weeks of order history so the page has data.

### Feedback

Once an order is served, the guest's order page asks "How was your meal?": 1 to 5 stars (a keyboard-friendly
radio group), quick tags (praise for 4-5 stars, problems for 1-3) and an optional comment. One rating per order,
proved by the order's tracking token. `/dashboard/feedback` (owner and manager) shows the average, the share of
happy guests, the rating distribution, the most-mentioned tags and the latest comments, filterable by stars.

### Menu languages

Each dish can have an optional Hindi and Marathi name and description (Menu > edit a dish > "Hindi and
Marathi"). When any dish has a translation, the customer menu shows an English / हिंदी / मराठी switch; the
guest's choice is remembered, untranslated text falls back to English, and search matches either language.
Categories, options and the rest of the interface stay in English, and orders, the kitchen display and bills
always use the English names. Devanagari text uses Noto Sans Devanagari, downloaded only when it is shown.
The demo menu's translations are machine-assisted; have a native speaker check them for a real restaurant.

### Installable app (PWA)

Both the dashboard and the customer menu can be installed from the browser ("Install app" / "Add to Home
screen"). The dashboard manifest opens `/dashboard`; on a menu page the manifest is swapped for one that opens
`/menu/`, which returns the guest to the restaurant they last visited. `public/sw.js` shows an offline page
(`/offline.html`) when there is no connection and caches only the offline page, icons and content-hashed build
files: menus, orders and the API always come from the network. The manifests and offline page are generated from
`APP_NAME` by `client/site/assets.js`. Icons are rendered from `client/scripts/icon/mark.svg` with
`node scripts/make-icons.mjs` (in `client/`).

### SEO and link previews

The landing page gets its title, description, Open Graph and Twitter card tags from `client/site/assets.js`
at build time, with `client/public/og-image.jpg` (1200 x 630, rendered by `node scripts/make-og-image.mjs`) as
the preview image. Set `VITE_SITE_URL` to the public address of the site in production: link previews need an
absolute image URL, and it also enables the canonical link and `sitemap.xml`. `robots.txt` keeps `/dashboard`
and `/kitchen` out of search results. Every screen sets its own browser tab title (for example
"Orders · QR Menu").

### Images

Every image field (dish photo, logo, banner, QR logo) uses one picker: upload or drag and drop, paste with
Ctrl+V, or paste an image URL. Each image is then cropped in the browser (react-easy-crop) and the **server**
applies the crop to the stored full-size original with sharp, so "Edit crop" works later without re-uploading.

| Field | Crop ratio | Stored size |
| --- | --- | --- |
| Dish photo | 4:3 (the menu card) | 1200 x 900 WebP |
| Restaurant logo | 1:1, shown round | 512 x 512 |
| Banner | 1:1 (the customer welcome hero) | 1200 x 1200 |
| QR logo | 1:1 | 512 x 512 |

Pasted links are downloaded by the server (never hotlinked) through an SSRF guard: http/https on standard
ports only, every DNS answer must be a public address (checked again on each of at most 3 redirects, with the
connection pinned to the checked address), a 10 s deadline, an 8 MB limit enforced while streaming, and the bytes
must decode as a raster image. The limit is 20 links per owner per 10 minutes.

## Environment variables

**server/.env** (see `server/.env.example`)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign login tokens; **required**, at least 32 characters |
| `FRONTEND_URL` | Allowed CORS origin and base URL for password-reset links |
| `CORS_ORIGINS` | Extra allowed origins, comma separated (localhost:3000/3001 are added in development) |
| `TRUST_PROXY` | Reverse proxies in front of the API: `0` locally, `1` on Render/Railway |
| `PUBLIC_URL` | Public base URL of the API, used in uploaded image links (default `http://localhost:PORT`) |
| `STORAGE_DRIVER`, `UPLOAD_DIR` | Image storage; `local` saves to `server/uploads` and serves `/uploads` |
| `EMAIL_USER`, `EMAIL_PASS` | SMTP login for password-reset emails; password reset is disabled when blank |

**client/.env** (see `client/.env.example`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL (default `http://localhost:5000`) |
| `VITE_SOCKET_URL` | Socket.io URL (defaults to `VITE_API_URL`) |
| `VITE_SITE_URL` | Public address of the site, for link previews, the canonical link and sitemap.xml (empty in development) |

To test from a phone on the same Wi-Fi, set `VITE_API_URL` to your PC's LAN address
(for example `http://192.168.1.20:5000`) and add that client origin to `CORS_ORIGINS` in `server/.env`. Client env changes need a dev-server restart.

## Resetting the database

`server/scripts/reset-db.js` drops the **entire** database. It refuses to run unless `NODE_ENV=development` is set in
the shell, `--confirm` is passed, and `MONGODB_URI` points at a local MongoDB. Never run it against shared or
production data.
