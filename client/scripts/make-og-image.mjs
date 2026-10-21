// Renders public/og-image.jpg (1200 x 630), the link preview for the landing page, from the app mark, the
// landing headline and the phone screenshot. Uses sharp from the server package; text is set in the
// system sans (Segoe UI / Arial), so re-run it on a machine with those fonts. Run: node scripts/make-og-image.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const sharp = require('sharp');
const file = (path) => fileURLToPath(new URL(path, import.meta.url));

const APP_NAME = readFileSync(file('../src/config.js'), 'utf8').match(/export const APP_NAME = '([^']+)'/)[1];
const C = { cream: '#faf6ee', ink: '#1e2112', muted: '#5f634e', olive700: '#656c1c', olive100: '#e3e8c9' };
const W = 1200;
const H = 630;
const FONT = "'Segoe UI', Arial, sans-serif";

const mark = readFileSync(file('./icon/mark.svg'), 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const lines = ['Your menu on every table.', 'Orders straight to', 'your kitchen.'];

// Phone: screenshot in a dark bezel, running off the bottom edge.
const phone = { x: 790, y: 70, w: 330, radius: 44, bezel: 12 };
const screenW = phone.w - phone.bezel * 2;
const screen = await sharp(file('../src/assets/landing/phone-menu.webp')).resize(screenW).toBuffer();
const screenH = (await sharp(screen).metadata()).height;
const visibleH = H - phone.y - phone.bezel;
const rounded = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${screenW}" height="${visibleH}"><rect width="${screenW}" height="${visibleH + 40}" rx="${phone.radius - phone.bezel}" fill="#fff"/></svg>`);
const screenCrop = await sharp(screen).extract({ left: 0, top: 0, width: screenW, height: Math.min(screenH, visibleH) })
  .composite([{ input: rounded, blend: 'dest-in' }]).png().toBuffer();

const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.cream}"/>
  <circle cx="${phone.x + phone.w / 2}" cy="${H + 40}" r="420" fill="${C.olive100}"/>
  <g transform="translate(80 72) scale(0.1406)"><rect width="512" height="512" rx="112" fill="${C.olive700}"/>${mark}</g>
  <text x="168" y="122" font-family="${FONT}" font-size="34" font-weight="700" fill="${C.ink}">${APP_NAME}</text>
  ${lines.map((line, i) => `<text x="80" y="${232 + i * 64}" font-family="${FONT}" font-size="52" font-weight="800" fill="${C.ink}">${line}</text>`).join('\n  ')}
  <text x="80" y="462" font-family="${FONT}" font-size="26" fill="${C.muted}">QR ordering, a live kitchen board and GST bills</text>
  <text x="80" y="500" font-family="${FONT}" font-size="26" fill="${C.muted}">for Indian restaurants and cafés.</text>
  <rect x="${phone.x}" y="${phone.y}" width="${phone.w}" height="${H}" rx="${phone.radius}" fill="${C.ink}"/>
</svg>`;

await sharp(Buffer.from(background))
  .composite([{ input: screenCrop, left: phone.x + phone.bezel, top: phone.y + phone.bezel }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(file('../public/og-image.jpg'));
console.log('public/og-image.jpg written');
