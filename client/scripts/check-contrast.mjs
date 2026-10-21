// Checks WCAG contrast for every foreground/background pair the UI uses, reading src/styles/tokens.css.
// Run: node scripts/check-contrast.mjs   (exits 1 if a pair fails)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v]));
const color = (name) => (name.startsWith('#') ? name : tokens[name]);

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum, where]. 4.5 = normal text, 3 = large/bold text or UI parts.
const PAIRS = [
  ['#ffffff', 'olive-700', 4.5, 'primary button text'],
  ['#ffffff', 'olive-800', 4.5, 'primary button hover, stepper inside the CTA'],
  ['olive-100', 'olive-800', 4.5, 'demo band text on dark olive'],
  ['ink', 'olive-500', 4.5, 'accent buttons, active sidebar item, centre nav button'],
  ['ink', 'olive-400', 4.5, 'accent button hover'],
  ['ink', 'olive-300', 4.5, 'sidebar badge'],
  ['ink', 'olive-100', 4.5, 'quantity stepper, soft accents'],
  ['olive-700', 'cream-bg', 4.5, 'links, prices, eyebrow text on the page'],
  ['olive-700', 'surface', 4.5, 'links and prices on cards'],
  ['olive-700', 'olive-50', 4.5, 'eyebrow on the hero glow'],
  ['olive-800', 'olive-100', 4.5, "chef's special badge, stat icons, empty-state icons"],
  ['olive-900', 'olive-100', 4.5, 'active category, welcome card'],
  ['olive-800', 'cream-bg', 4.5, 'picker hover text'],
  ['olive-300', 'ink', 4.5, 'active bottom-nav item, labels on dark'],
  ['olive-300', 'ink-soft', 4.5, 'icons in the dark "how it works" cards'],
  ['olive-600', 'cream-bg', 3, 'focus ring and selected outlines (non-text)'],
  ['olive-600', 'surface', 3, 'focus ring on cards (non-text)'],
  ['ink', 'cream-bg', 4.5, 'body text'],
  ['muted', 'cream-bg', 4.5, 'secondary text'],
  ['muted', 'surface', 4.5, 'secondary text on cards'],
  ['on-dark-muted', 'ink', 4.5, 'secondary text on dark'],
  ['success', 'success-bg', 4.5, 'success badges'],
  ['danger', 'danger-bg', 4.5, 'error notices'],
  ['warning', 'warning-bg', 4.5, 'warning notices and bestseller badge'],
  ['info', 'info-bg', 4.5, 'info badges'],
  ['danger', 'surface', 4.5, 'field errors'],
  ['veg-green', 'surface', 3, 'veg mark (non-text)'],
  ['nonveg-red', 'surface', 3, 'non-veg mark (non-text)']
];

let failed = 0;
for (const [fg, bg, min, where] of PAIRS) {
  const value = ratio(color(fg), color(bg));
  const ok = value >= min;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${value.toFixed(2).padStart(5)}:1  (min ${min})  ${fg} on ${bg}  - ${where}`);
}
console.log(failed ? `\n${failed} pair(s) fail` : '\nAll pairs pass');
process.exit(failed ? 1 : 0);
