# QR Menu

QR code digital menu and table ordering system for restaurants and cafés. Customers scan the QR code on
their table, browse the menu, and place orders; the restaurant sees orders live on its dashboard.

> Work in progress: this monorepo is being turned into a production SaaS product. The full product guide,
> screenshots and deployment notes will be added as the work lands.

## Structure

```
QR-Project/
├── client/            React app (Create React App)
├── server/            Express + Mongoose + Socket.io API
│   └── scripts/       maintenance scripts (seed, guarded reset)
├── design-reference/  brand colour and UI references
└── package.json       root scripts that drive both apps
```

## Requirements

- Node.js 18 or newer, npm 9 or newer
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

This starts the API on http://localhost:5000 and the React app on http://localhost:3000.

| Script | What it does |
| --- | --- |
| `npm run install:all` | Installs root, server and client dependencies |
| `npm run dev` | Runs server (nodemon) and client (React dev server) together |
| `npm run build` | Production build of the client into `client/build` |
| `npm start` | Starts the API server |
| `npm run seed` | Loads demo data |
| `npm test` | Runs server and client tests |

## Environment variables

**server/.env** (see `server/.env.example`)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign login tokens |
| `FRONTEND_URL` | Allowed CORS origin and base URL for password-reset links |
| `EMAIL_USER`, `EMAIL_PASS` | SMTP login for password-reset emails; password reset is disabled when blank |

**client/.env** (see `client/.env.example`)

| Variable | Purpose |
| --- | --- |
| `REACT_APP_API_URL` | API base URL (default `http://localhost:5000`) |
| `REACT_APP_SOCKET_URL` | Socket.io URL (defaults to `REACT_APP_API_URL`) |

To test from a phone on the same Wi-Fi, set `REACT_APP_API_URL` to your PC's LAN address
(for example `http://192.168.1.20:5000`) and add that client origin to `FRONTEND_URL`.

## Resetting the database

`server/scripts/reset-db.js` drops the **entire** database. It refuses to run unless `NODE_ENV=development` is set in
the shell, `--confirm` is passed, and `MONGODB_URI` points at a local MongoDB. Never run it against shared or
production data.
