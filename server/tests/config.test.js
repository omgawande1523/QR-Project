const path = require('path');
const { execFileSync } = require('child_process');

const serverDir = path.join(__dirname, '..');

// Loads src/config in a fresh Node process with the given environment and reports the outcome
// (or, with `print`, one config value as JSON).
function loadConfigWith(env, print) {
  const report = print ? `console.log(JSON.stringify(require('./src/config').${print}))` : "require('./src/config'); console.log('LOADED')";
  const script = `try { ${report}; } catch (e) { console.log(e.message); }`;
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

  const strong = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64) };

  test('UPLOAD_CLEANUP=off turns the automatic image cleanup off', () => {
    expect(loadConfigWith({ ...strong, UPLOAD_CLEANUP: 'off' }, 'uploadCleanup').trim()).toBe('false');
    expect(loadConfigWith({ ...strong, UPLOAD_CLEANUP: '' }, 'uploadCleanup').trim()).toBe('true');
  });

  test('STORAGE_DRIVER=cloudinary needs a valid CLOUDINARY_URL', () => {
    const out = loadConfigWith({ ...strong, STORAGE_DRIVER: 'cloudinary', CLOUDINARY_URL: '' });
    expect(out).toMatch(/CLOUDINARY_URL: set it to cloudinary:\/\/<api_key>:<api_secret>@<cloud_name>/);
  });

  test('STORAGE_DRIVER=cloudinary reads the cloud name, key, secret and folder', () => {
    const out = loadConfigWith({ ...strong, STORAGE_DRIVER: 'cloudinary', CLOUDINARY_URL: 'cloudinary://1234:s3cr3t@my-cloud', CLOUDINARY_FOLDER: 'cafe/prod' }, 'storage.cloudinary');
    expect(JSON.parse(out)).toEqual({ cloudName: 'my-cloud', apiKey: '1234', apiSecret: 's3cr3t', folder: 'cafe/prod' });
    // A blank CLOUDINARY_FOLDER= line in .env means the default folder.
    const blank = loadConfigWith({ ...strong, STORAGE_DRIVER: 'cloudinary', CLOUDINARY_URL: 'cloudinary://1234:s3cr3t@my-cloud', CLOUDINARY_FOLDER: '' }, 'storage.cloudinary.folder');
    expect(JSON.parse(blank)).toBe('qr-menu');
  });
});
