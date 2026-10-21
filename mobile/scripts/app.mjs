// Builds and runs the staff app. Used by the root scripts (npm run app:build, app:sync, app:apk, ...).
//   node scripts/app.mjs doctor   check JDK 21, the Android SDK, plugin versions, Firebase and signing files
//   node scripts/app.mjs build    build the staff screens (client, vite --mode app) into client/dist-app
//   node scripts/app.mjs sync     build, then copy them and the plugins into the Android project
//   node scripts/app.mjs apk      sync, then a debug APK for testing on a phone  -> mobile/dist/
//   node scripts/app.mjs aab      sync, then a signed release bundle for the Play Store -> mobile/dist/
//   node scripts/app.mjs run      sync, then install and start on a connected phone or a running emulator
//   node scripts/app.mjs open     open the Android project in Android Studio
// The API address comes from VITE_API_URL (client/.env.app, client/.env.app.local or the environment).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appEnv } from '../../client/site/app.js';

const MOBILE = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(MOBILE, '..');
const CLIENT = join(ROOT, 'client');
const ANDROID = join(MOBILE, 'android');
const isWindows = process.platform === 'win32';
const appConfig = JSON.parse(readFileSync(join(MOBILE, 'app.config.json'), 'utf8'));

const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

function run(command, args, { cwd, env = {} } = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  // On Windows npx and gradlew.bat need a shell; give it one command line (no user input goes in here).
  const result = isWindows
    ? spawnSync([command, ...args].map((part) => (part.includes(' ') ? `"${part}"` : part)).join(' '), { cwd, stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
    : spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} failed (exit ${result.status})`);
}

// ---------- Toolchain ----------
function javaMajor(home) {
  const java = join(home, 'bin', isWindows ? 'java.exe' : 'java');
  if (!existsSync(java)) return 0;
  const out = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const match = `${out.stderr}${out.stdout}`.match(/version "(\d+)/);
  return match ? Number(match[1]) : 0;
}

// Capacitor 8 needs JDK 21 or newer. JAVA_HOME may point at an older JDK, so look in the usual places too.
function findJdk() {
  const dirs = (parent) => (existsSync(parent) ? readdirSync(parent).filter((d) => /jdk-?(2\d|[3-9]\d)/.test(d)).map((d) => join(parent, d)) : []);
  const candidates = [
    process.env.QRMENU_JAVA_HOME,
    process.env.JAVA_HOME,
    join(process.env.LOCALAPPDATA || '', 'Programs', 'jdk'),
    'C:\\Program Files\\Android\\Android Studio\\jbr'
  ].filter(Boolean);
  const homes = [
    ...candidates.filter((c) => javaMajor(c) >= 21),
    ...dirs(join(process.env.LOCALAPPDATA || '', 'Programs', 'jdk')),
    ...dirs('C:\\Program Files\\Eclipse Adoptium'),
    ...dirs('C:\\Program Files\\Java'),
    ...dirs('C:\\Program Files\\Microsoft')
  ];
  return homes.find((h) => javaMajor(h) >= 21) || null;
}

function findSdk() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')].filter(Boolean);
  return candidates.find((c) => existsSync(join(c, 'platform-tools'))) || null;
}

function toolchain() {
  const jdk = findJdk();
  const sdk = findSdk();
  if (!jdk) fail('JDK 21 not found. Install Eclipse Temurin 21 (https://adoptium.net) or Android Studio, or set QRMENU_JAVA_HOME.');
  if (!sdk) fail('Android SDK not found. Install Android Studio (or the command-line tools) and set ANDROID_HOME.');
  // Gradle reads the SDK location from local.properties (machine-specific, not committed).
  const local = join(ANDROID, 'local.properties');
  if (!existsSync(local)) writeFileSync(local, `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
  return { JAVA_HOME: jdk, ANDROID_HOME: sdk };
}

// ---------- Configuration ----------
function pluginVersionProblems() {
  const client = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')).dependencies;
  const mobile = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8')).dependencies;
  return Object.keys(mobile)
    .filter((name) => name !== '@capacitor/android')
    .filter((name) => client[name] !== mobile[name])
    .map((name) => `${name}: client ${client[name] || 'missing'}, mobile ${mobile[name]}`);
}

// ---------- Steps ----------
function build({ release = false } = {}) {
  const env = appEnv();
  const api = env.VITE_API_URL || 'http://10.0.2.2:5000';
  if (release && !api.startsWith('https://')) fail(`Release builds need an https API address; VITE_API_URL is ${api}. Set it in client/.env.app.local.`);
  if (release && !env.VITE_SITE_URL) fail('Release builds need VITE_SITE_URL (the website address, for QR codes and menu links). Set it in client/.env.app.local.');
  const problems = pluginVersionProblems();
  if (problems.length) fail(`Capacitor plugin versions differ between client/ and mobile/ (keep them identical):\n  ${problems.join('\n  ')}`);
  console.log(`Staff app ${appConfig.versionName} (${appConfig.versionCode}) -> API ${api}${env.VITE_SITE_URL ? `, website ${env.VITE_SITE_URL}` : ''}`);
  run('npx', ['vite', 'build', '--mode', 'app'], { cwd: CLIENT });
  run('node', ['scripts/check-bundles.mjs', 'app'], { cwd: CLIENT });
  return api;
}

function sync(options) {
  const api = build(options);
  // Plain http only works in debug builds (see android/app/src/debug) and needs mixed content allowed.
  run('npx', ['cap', 'sync', 'android'], { cwd: MOBILE, env: { QRMENU_ALLOW_HTTP: api.startsWith('http://') ? '1' : '0' } });
}

function gradle(task, env) {
  // Full path: Windows may not look in the current folder for commands.
  run(join(ANDROID, isWindows ? 'gradlew.bat' : 'gradlew'), [task, '--no-daemon'], { cwd: ANDROID, env });
}

function copyOut(from, name) {
  mkdirSync(join(MOBILE, 'dist'), { recursive: true });
  const to = join(MOBILE, 'dist', name);
  copyFileSync(from, to);
  console.log(`\nBuilt: ${to}`);
  return to;
}

function doctor() {
  const jdk = findJdk();
  const sdk = findSdk();
  const lines = [
    [jdk ? 'ok  ' : 'MISSING', `JDK 21+: ${jdk || 'not found'}`],
    [sdk ? 'ok  ' : 'MISSING', `Android SDK: ${sdk || 'not found'}`],
    [sdk && existsSync(join(sdk, 'platforms', 'android-36')) ? 'ok  ' : 'MISSING', 'Android SDK Platform 36'],
    [existsSync(join(MOBILE, 'node_modules', '@capacitor', 'android')) ? 'ok  ' : 'MISSING', 'mobile/node_modules (run npm run install:all)'],
    [pluginVersionProblems().length ? 'MISMATCH' : 'ok  ', 'Capacitor plugin versions match in client/ and mobile/'],
    [existsSync(join(ANDROID, 'app', 'google-services.json')) ? 'ok  ' : 'off ', 'Firebase (android/app/google-services.json): push notifications'],
    [existsSync(join(ANDROID, 'keystore.properties')) ? 'ok  ' : 'off ', 'Release signing (android/keystore.properties)'],
    [sdk && existsSync(join(sdk, 'emulator')) ? 'ok  ' : 'off ', 'Android emulator']
  ];
  lines.forEach(([state, text]) => console.log(`${state.padEnd(8)} ${text}`));
  console.log(`\nApp ${appConfig.appId} ${appConfig.versionName} (${appConfig.versionCode}); API for the app build: ${appEnv().VITE_API_URL || 'http://10.0.2.2:5000 (default)'}`);
}

const command = process.argv[2];
switch (command) {
  case 'doctor':
    doctor();
    break;
  case 'build':
    build();
    break;
  case 'sync':
    sync();
    break;
  case 'apk': {
    const env = toolchain();
    sync();
    gradle('assembleDebug', env);
    copyOut(join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), `qr-menu-staff-${appConfig.versionName}-debug.apk`);
    break;
  }
  case 'aab': {
    const env = toolchain();
    if (!existsSync(join(ANDROID, 'keystore.properties'))) fail('Release signing is not set up: create mobile/android/keystore.properties (see docs/PLAY_STORE.md).');
    sync({ release: true });
    gradle('bundleRelease', env);
    copyOut(join(ANDROID, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'), `qr-menu-staff-${appConfig.versionName}.aab`);
    break;
  }
  case 'run': {
    const env = toolchain();
    sync();
    run('npx', ['cap', 'run', 'android'], { cwd: MOBILE, env });
    break;
  }
  case 'open':
    run('npx', ['cap', 'open', 'android'], { cwd: MOBILE });
    break;
  default:
    fail('Usage: node scripts/app.mjs doctor | build | sync | apk | aab | run | open');
}
