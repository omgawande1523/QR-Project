// Checks the finished builds: the staff app (dist-app) contains no guest or landing screens, and the website
// (build) contains no Capacitor code. Run after both builds: node scripts/check-bundles.mjs [app|web]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function filesOf(dir) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir, { recursive: true }).filter((f) => /\.(js|css|html)$/.test(f)).map((f) => join(dir, f));
}

// Text that only guest or landing screens show (string literals survive minification).
const GUEST_TEXT = ['View Menu', 'Your cart', 'Place order', 'How was your meal', 'Try live demo', 'QR code menu and table ordering for restaurants', 'Scan the QR code on your table'];
const CAPACITOR_TEXT = ['@capacitor/', 'capacitor-secure-storage', 'NativePrint', 'keep-awake'];

function check(dir, forbidden, label) {
  const files = filesOf(join(root, dir));
  if (!files) return console.log(`skip ${label}: ${dir}/ not built`), 0;
  const problems = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const phrase of forbidden) if (text.includes(phrase)) problems.push(`${file.slice(root.length)}: "${phrase}"`);
  }
  if (problems.length) console.error(`FAIL ${label}:\n  ${problems.join('\n  ')}`);
  else console.log(`ok   ${label} (${files.length} files)`);
  return problems.length;
}

const which = process.argv[2];
let failures = 0;
if (!which || which === 'app') failures += check('dist-app', GUEST_TEXT, 'staff app has no guest or landing screens');
if (!which || which === 'web') failures += check('build', CAPACITOR_TEXT, 'website has no Capacitor code');
process.exit(failures ? 1 : 0);
