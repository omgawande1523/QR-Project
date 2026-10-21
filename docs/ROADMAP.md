# Roadmap

## Phase 4: features that make it sellable (next)

In this order, one commit each:

1. ~~Kitchen Display Screen (`/kitchen`)~~ done.
   Replaces the old dashboard's "kitchen mode", removed in Phase 3.
2. ~~Staff accounts with roles~~ done.
3. ~~Bill / invoice: printable GST invoice per order (PDF), mark paid (cash / UPI / card)~~ done.
4. ~~Analytics: sales by day and week, by item, by category, peak hours, table usage (charts)~~ done.
5. ~~Customer feedback: rate the meal after an order is served~~ done.
6. Multi-language menu (English / Hindi / Marathi) for item names and descriptions (optional fields).
7. Optional online payment: Razorpay test mode behind a feature flag (pay at counter stays the default).
8. PWA: installable customer menu and dashboard, offline fallback page, real app icons
   (the favicon and logo192/512 referenced by index.html and manifest.json are still missing).
9. SEO / meta tags and an Open Graph image for the landing page.
10. Abandoned-upload cleanup: delete images older than 24 hours that nothing uses: `Upload` records
    (originals and crops, see server/src/models/Upload.js) whose crop is not referenced by any dish or
    restaurant image field, plus their files (owner request, Phase 3). Keep originals that still back a used crop.

## Phase 5: quality, verification, docs

- React Testing Library tests for cart maths and the order flow; extend the Playwright suite (`e2e/`).
- Widths 375 / 768 / 1440 with no horizontal scroll and 44px tap targets; Lighthouse >= 90 on the customer menu.
- No console errors or React warnings; no unused files or dead CSS.
- Full README with screenshots, setup on Windows, environment variables and a deployment guide.
