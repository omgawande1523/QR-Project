const http = require('http');
const request = require('supertest');
const sharp = require('sharp');
const db = require('./helpers/db');
const createApp = require('../src/app');
const remoteImage = require('../src/services/remoteImage');
const { registerOwner, auth } = require('./helpers/factory');

const { isPublicAddress, createRemoteImageFetcher } = remoteImage;
const app = createApp();

// A small "internet" on 127.0.0.1. Tests reach it as http://images.test:<port>, a name the test
// resolver maps to 127.0.0.1 and the test policy treats as public; every other name (including
// 127.0.0.1 itself) goes through the real address checks.
let server;
let port;
let png;

beforeAll(async () => {
  await db.connect();
  png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#a3b23a' } }).png().toBuffer();
  server = http.createServer((req, res) => {
    const base = `http://images.test:${port}`;
    switch (req.url) {
      case '/photo.png': res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(png);
      case '/page': res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html><body>not an image</body></html>');
      case '/fake.png': res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end('<html>pretending to be a png</html>');
      case '/drawing.svg': res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
      case '/declared-huge': res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': String(9 * 1024 * 1024) }); return res.end();
      case '/streamed-huge': {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' }); // chunked, no length
        const chunk = Buffer.alloc(256 * 1024, 7);
        let sent = 0;
        const pump = () => {
          while (sent < 40 && res.write(chunk)) sent += 1;
          if (sent < 40) res.once('drain', pump); else res.end();
        };
        return pump();
      }
      case '/slow': return setTimeout(() => { res.writeHead(200); res.end(png); }, 2000);
      case '/redirect-ok': res.writeHead(302, { Location: `${base}/photo.png` }); return res.end();
      case '/redirect-local': res.writeHead(302, { Location: `http://127.0.0.1:${port}/photo.png` }); return res.end();
      case '/redirect-metadata': res.writeHead(301, { Location: 'http://169.254.169.254/latest/meta-data/' }); return res.end();
      case '/hop1': res.writeHead(302, { Location: '/hop2' }); return res.end();
      case '/hop2': res.writeHead(302, { Location: '/hop3' }); return res.end();
      case '/hop3': res.writeHead(302, { Location: '/photo.png' }); return res.end();
      case '/hop0': res.writeHead(302, { Location: '/hop1' }); return res.end();
      default: res.writeHead(404); return res.end('missing');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

afterEach(() => jest.restoreAllMocks());

const testResolve = async (host) => {
  if (host === 'images.test') return ['127.0.0.1'];
  if (host === 'internal.test') return ['10.0.0.5'];
  if (host === 'mixed.test') return ['93.184.216.34', '192.168.0.10'];
  if (host === 'nowhere.test') throw new Error('ENOTFOUND');
  return [host];
};
const testFetcher = (limits = {}) => createRemoteImageFetcher({
  resolve: testResolve,
  isAllowed: (address, host) => host === 'images.test' || isPublicAddress(address),
  limits: { allowedPorts: [80, 443, port], ...limits }
});
const url = (path, host = 'images.test') => `http://${host}:${port}${path}`;

async function expectError(promise, status, code) {
  await expect(promise).rejects.toMatchObject({ status, code });
}

describe('isPublicAddress', () => {
  test.each([
    '127.0.0.1', '127.8.8.8', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip'
  ])('%s is not public', (address) => expect(isPublicAddress(address)).toBe(false));

  test.each(['93.184.216.34', '8.8.8.8', '1.1.1.1', '2606:4700::1111'])('%s is public', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe('fetchRemoteImage', () => {
  test('downloads an image', async () => {
    const bytes = await testFetcher()(url('/photo.png'));
    expect(bytes.equals(png)).toBe(true);
  });

  test('follows a redirect to an allowed host', async () => {
    expect((await testFetcher()(url('/redirect-ok'))).equals(png)).toBe(true);
  });

  test('follows up to three redirects but not four', async () => {
    expect((await testFetcher()(url('/hop1'))).equals(png)).toBe(true);
    await expectError(testFetcher()(url('/hop0')), 422, 'DOWNLOAD_FAILED');
  });

  test('blocks a redirect to 127.0.0.1', async () => {
    await expectError(testFetcher()(url('/redirect-local')), 400, 'BLOCKED_IMAGE_URL');
  });

  test('blocks a redirect to the cloud metadata address', async () => {
    await expectError(testFetcher()(url('/redirect-metadata')), 400, 'BLOCKED_IMAGE_URL');
  });

  test.each([
    `http://127.0.0.1:PORT/photo.png`,
    `http://localhost:PORT/photo.png`,
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/'
  ])('blocks %s', async (raw) => {
    const fetcher = createRemoteImageFetcher({ limits: { allowedPorts: [80, 443, port] } }); // real DNS and policy
    await expectError(fetcher(raw.replace('PORT', port)), 400, 'BLOCKED_IMAGE_URL');
  });

  test('blocks a host name that resolves to a private address', async () => {
    await expectError(testFetcher()(url('/photo.png', 'internal.test')), 400, 'BLOCKED_IMAGE_URL');
  });

  test('blocks a host name with any private address among its records', async () => {
    await expectError(testFetcher()(url('/photo.png', 'mixed.test')), 400, 'BLOCKED_IMAGE_URL');
  });

  test.each(['ftp://images.test/photo.png', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])('rejects %s', async (raw) => {
    await expectError(testFetcher()(raw), 400, 'INVALID_IMAGE_URL');
  });

  test('rejects credentials in the URL and non-standard ports', async () => {
    await expectError(testFetcher()(`http://user:pass@images.test:${port}/photo.png`), 400, 'BLOCKED_IMAGE_URL');
    await expectError(createRemoteImageFetcher()('http://example.com:8080/a.png'), 400, 'BLOCKED_IMAGE_URL');
  });

  test('refuses a declared Content-Length over 8 MB', async () => {
    await expectError(testFetcher()(url('/declared-huge')), 413, 'IMAGE_TOO_LARGE');
  });

  test('stops a streamed body as soon as it passes 8 MB', async () => {
    await expectError(testFetcher()(url('/streamed-huge')), 413, 'IMAGE_TOO_LARGE');
  });

  test('gives up after the time limit', async () => {
    await expectError(testFetcher({ timeoutMs: 300 })(url('/slow')), 422, 'DOWNLOAD_FAILED');
  });

  test('reports a missing page or an unknown host as a failed download', async () => {
    await expectError(testFetcher()(url('/missing')), 422, 'DOWNLOAD_FAILED');
    await expectError(testFetcher()(url('/photo.png', 'nowhere.test')), 422, 'DOWNLOAD_FAILED');
  });
});

describe('POST /api/uploads/from-url', () => {
  const importUrl = (token, link) => request(app).post('/api/uploads/from-url').set(auth(token)).send({ url: link });

  test('requires a logged-in owner', async () => {
    const res = await request(app).post('/api/uploads/from-url').send({ url: url('/photo.png') });
    expect(res.status).toBe(401);
  });

  test('stores the downloaded image as our own WebP original', async () => {
    jest.spyOn(remoteImage, 'fetchRemoteImage').mockImplementation(testFetcher());
    const owner = await registerOwner(app);
    const res = await importUrl(owner.token, url('/photo.png'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ width: 64, height: 48 });
    expect(res.body.url).toMatch(/^http:\/\/localhost:5000\/uploads\/originals\/[0-9a-f-]{36}\.webp$/);
  });

  test.each([['/page'], ['/fake.png'], ['/drawing.svg']])('%s is refused with "This link isn\'t an image"', async (path) => {
    jest.spyOn(remoteImage, 'fetchRemoteImage').mockImplementation(testFetcher());
    const owner = await registerOwner(app);
    const res = await importUrl(owner.token, url(path));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("This link isn't an image");
  });

  test('explains failures in plain words', async () => {
    jest.spyOn(remoteImage, 'fetchRemoteImage').mockImplementation(testFetcher());
    const owner = await registerOwner(app);
    expect((await importUrl(owner.token, url('/missing'))).body.message).toBe("Couldn't download that image");
    expect((await importUrl(owner.token, url('/streamed-huge'))).body.message).toMatch(/^Image is too large/);
    expect((await importUrl(owner.token, url('/redirect-local'))).body.code).toBe('BLOCKED_IMAGE_URL');
  });

  test('with the real policy, a loopback link is blocked', async () => {
    const owner = await registerOwner(app);
    const res = await importUrl(owner.token, `http://127.0.0.1:${port}/photo.png`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BLOCKED_IMAGE_URL');
  });
});
