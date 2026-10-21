# QR Menu

QR code digital menu and table ordering system for restaurants and cafés. Customers scan the QR code on
their table, browse the menu, and place orders; the restaurant sees orders live on its dashboard.

> Work in progress: this monorepo is being turned into a production SaaS product. The full product guide,
> screenshots and deployment notes will be added as the work lands.

## Structure

```
QR-Project/
├── client/            React 18 app (Vite)
├── server/            Express + Mongoose + Socket.io API
│   └── scripts/       maintenance scripts (seed, guarded reset)
├── design-reference/  brand colour and UI references
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

## Demo data

```powershell
npm run seed
```

Creates the demo restaurant **Olive Leaf Café** (22 dishes with photos, 5 tables, sample orders and a pending
waiter call) and prints its customer-menu link. Log in to the dashboard with **demo@qrmenu.test / Demo@1234**.
Re-running replaces only the demo account's own data. Image credits: `server/scripts/seed-assets/CREDITS.md`.

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

To test from a phone on the same Wi-Fi, set `VITE_API_URL` to your PC's LAN address
(for example `http://192.168.1.20:5000`) and add that client origin to `CORS_ORIGINS` in `server/.env`. Client env changes need a dev-server restart.

## Resetting the database

`server/scripts/reset-db.js` drops the **entire** database. It refuses to run unless `NODE_ENV=development` is set in
the shell, `--confirm` is passed, and `MONGODB_URI` points at a local MongoDB. Never run it against shared or
production data.
