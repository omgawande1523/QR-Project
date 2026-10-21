// Renders the app icons in public/ from scripts/icon/mark.svg (uses sharp from the server package).
// Run: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const sharp = require('sharp');
const OLIVE_700 = '#656c1c';
const mark = readFileSync(new URL('./icon/mark.svg', import.meta.url), 'utf8');
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// Rounded tile for browsers and home screens; maskable is full-bleed with the mark in the safe zone.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${OLIVE_700}"/>${inner}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${OLIVE_700}"/><g transform="translate(256 256) scale(0.88) translate(-256 -256)">${inner}</g></svg>`;
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

writeFileSync(out('favicon.svg'), tile);
const png = (svg, size, name) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out(name));
await Promise.all([
  png(tile, 32, 'favicon-32.png'),
  png(tile, 180, 'apple-touch-icon.png'),
  png(tile, 192, 'logo192.png'),
  png(tile, 512, 'logo512.png'),
  png(maskable, 512, 'maskable-512.png')
]);
console.log('icons written to public/');
