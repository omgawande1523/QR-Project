const path = require('path');
const { execFileSync } = require('child_process');

const serverDir = path.join(__dirname, '..');

// Loads src/config in a fresh Node process with the given environment and reports the outcome.
function loadConfigWith(env) {
  const script = "try { require('./src/config'); console.log('LOADED'); } catch (e) { console.log(e.message); }";
  return execFileSync(process.execPath, ['-e', script], {
    cwd: serverDir,
    // dotenv never overrides a variable that is set, so JWT_SECRET='' hides the one in server/.env.
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    encoding: 'utf8'
  });
}

describe('config', () => {
  test('refuses to load in production with a missing JWT_SECRET', () => {
    const out = loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: '' });
    expect(out).toMatch(/JWT_SECRET must be at least 32 characters/);
  });

  test('refuses a short JWT_SECRET', () => {
    const out = loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: 'secret' });
    expect(out).toMatch(/JWT_SECRET must be at least 32 characters/);
  });

  test('loads with a strong JWT_SECRET', () => {
    const out = loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64) });
    expect(out.trim()).toBe('LOADED');
  });
});
