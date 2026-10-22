// Renders the app icons and splash screens from the brand mark (client/scripts/icon/mark.svg, olive-700 tile and
// cream mark, the same as the website's icons): Android launcher, notification icon and splash; iOS app icon
// (light, dark and tinted) and launch image. Uses sharp from the server package.
// Run from mobile/: node scripts/make-assets.mjs [android|ios]   (both when no platform is given)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const sharp = require('sharp');

const OLIVE_700 = '#656c1c';
const CREAM = '#faf6ee';
const mark = readFileSync(new URL('../../client/scripts/icon/mark.svg', import.meta.url), 'utf8');
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const recolor = (svg, color) => svg.replaceAll(CREAM, color);

const res = (path) => fileURLToPath(new URL(`../android/app/src/main/res/${path}`, import.meta.url));
const svg = (body, viewBox = 512) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}">${body}</svg>`);
async function png(source, width, height, path) {
  mkdirSync(res(path).replace(/[\\/][^\\/]+$/, ''), { recursive: true });
  await sharp(source, { density: 512 }).resize(width, height).png({ compressionLevel: 9 }).toFile(res(path));
}

const only = process.argv[2];
const doAndroid = !only || only === 'android';
const doIos = !only || only === 'ios';

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Legacy square and round icons (48 dp) for launchers without adaptive icons.
const square = svg(`<rect width="512" height="512" rx="112" fill="${OLIVE_700}"/>${inner}`);
const round = svg(`<circle cx="256" cy="256" r="256" fill="${OLIVE_700}"/><g transform="translate(256 256) scale(0.86) translate(-256 -256)">${inner}</g>`);
// Adaptive icon layers (108 dp): the mark sits inside the 66 dp safe zone; the background is a colour.
const foreground = svg(`<g transform="translate(256 256) scale(0.6) translate(-256 -256)">${inner}</g>`);
const monochrome = svg(`<g transform="translate(256 256) scale(0.6) translate(-256 -256)">${recolor(inner, '#ffffff')}</g>`);
// Status-bar notification icon (24 dp): white on transparent, as Android requires.
const notify = svg(recolor(inner, '#ffffff').replace('<g fill="#ffffff">', '<g fill="#ffffff" transform="translate(-40 -40) scale(1.16)">'));

const jobs = [];
for (const [name, scale] of doAndroid ? Object.entries(DENSITIES) : []) {
  jobs.push(png(square, 48 * scale, 48 * scale, `mipmap-${name}/ic_launcher.png`));
  jobs.push(png(round, 48 * scale, 48 * scale, `mipmap-${name}/ic_launcher_round.png`));
  jobs.push(png(foreground, 108 * scale, 108 * scale, `mipmap-${name}/ic_launcher_foreground.png`));
  jobs.push(png(monochrome, 108 * scale, 108 * scale, `mipmap-${name}/ic_launcher_monochrome.png`));
  jobs.push(png(notify, 24 * scale, 24 * scale, `drawable-${name}/ic_stat_notify.png`));
}

// Splash (before Android 12; newer versions show the adaptive icon on the cream background instead).
const splash = (w, h) => {
  const size = Math.round(Math.min(w, h) * 0.32);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${CREAM}"/>`
    + `<svg x="${(w - size) / 2}" y="${(h - size) / 2}" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${OLIVE_700}"/>${inner}</svg></svg>`);
};
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [name, [w, h]] of doAndroid ? Object.entries(SPLASH) : []) {
  jobs.push(png(splash(w, h), w, h, `drawable-port-${name}/splash.png`));
  jobs.push(png(splash(h, w), h, w, `drawable-land-${name}/splash.png`));
}
if (doAndroid) jobs.push(png(splash(480, 320), 480, 320, 'drawable/splash.png'));

// ---------- iOS ----------
// One 1024 px icon per appearance; Xcode makes every other size from it. The App Store icon must be square
// and fully opaque (iOS rounds the corners itself), so the tile fills the canvas and alpha is removed.
const assets = (path) => fileURLToPath(new URL(`../ios/App/App/Assets.xcassets/${path}`, import.meta.url));
async function opaquePng(source, size, path) {
  await sharp(source, { density: 512 }).resize(size, size).flatten({ background: OLIVE_700 }).removeAlpha().png({ compressionLevel: 9 }).toFile(assets(path));
}
const IOS_DARK = '#1f2112';
const iosIcon = (background, markColor) => svg(`<rect width="512" height="512" fill="${background}"/><g transform="translate(256 256) scale(0.8) translate(-256 -256)">${recolor(inner, markColor)}</g>`);
// Launch image: the Android splash on a 2732 px square, drawn "aspect fill" so the mark stays centred.
const launch = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="100%" height="100%" fill="${CREAM}"/>`
  + `<svg x="${(2732 - 400) / 2}" y="${(2732 - 400) / 2}" width="400" height="400" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${OLIVE_700}"/>${inner}</svg></svg>`);
if (doIos) {
  rmSync(assets('AppIcon.appiconset'), { recursive: true, force: true });
  mkdirSync(assets('AppIcon.appiconset'), { recursive: true });
  jobs.push(opaquePng(iosIcon(OLIVE_700, CREAM), 1024, 'AppIcon.appiconset/AppIcon-1024.png'));
  jobs.push(opaquePng(iosIcon(IOS_DARK, '#c6cc7a'), 1024, 'AppIcon.appiconset/AppIcon-1024-dark.png'));
  // Tinted: a grayscale image that iOS colours with the person's chosen tint.
  jobs.push(sharp(iosIcon('#000000', '#ffffff'), { density: 512 }).resize(1024, 1024).removeAlpha().grayscale().png({ compressionLevel: 9 }).toFile(assets('AppIcon.appiconset/AppIcon-1024-tinted.png')));
  const icon = (file, appearance) => ({ ...(appearance ? { appearances: [{ appearance: 'luminosity', value: appearance }] } : {}), filename: file, idiom: 'universal', platform: 'ios', size: '1024x1024' });
  writeFileSync(assets('AppIcon.appiconset/Contents.json'), `${JSON.stringify({
    images: [icon('AppIcon-1024.png'), icon('AppIcon-1024-dark.png', 'dark'), icon('AppIcon-1024-tinted.png', 'tinted')],
    info: { author: 'xcode', version: 1 }
  }, null, 2)}
`);
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    jobs.push(sharp(launch).png({ compressionLevel: 9, palette: true }).toFile(assets(`Splash.imageset/${name}`)));
  }
}
await Promise.all(jobs);
if (doIos) console.log('iOS app icon (light, dark, tinted) and launch image written');
if (!doAndroid) process.exit(0);

// Adaptive icon definition with the themed-icon (monochrome) layer, and the brand colours.
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
writeFileSync(res('mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(res('mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
writeFileSync(res('values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${OLIVE_700}</color>
</resources>
`);
// Capacitor's default artwork, replaced by the files above.
rmSync(res('drawable-v24/ic_launcher_foreground.xml'), { force: true });
rmSync(res('drawable/ic_launcher_background.xml'), { force: true });
console.log('Android icons, notification icon and splash screens written');
