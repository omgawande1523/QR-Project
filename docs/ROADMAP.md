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

## Phase 6: next steps

Suggested order. The first three turn the product into something that can be sold and run as a business.

1. **Go live**: create the Atlas, Cloudinary, Render and Vercel/Netlify accounts, deploy with `render.yaml`,
   connect the domain, then print QR codes from the final address. Add uptime monitoring on `/health`
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
   automatically, a print server for kitchen tickets on thermal printers, table merge and transfer, and split
   bills.
6. **Guests**: WhatsApp order updates, a loyalty stamp card, and dish recommendations ("goes well with").
7. **Platform**: automated backups with a tested restore, a staging environment (`CLOUDINARY_FOLDER` and a
   second Atlas database), CI running `npm test`, `npm run lint` and `npm run e2e` on every pull request, and the
   rest of the interface (not just dish names) in Hindi and Marathi.
