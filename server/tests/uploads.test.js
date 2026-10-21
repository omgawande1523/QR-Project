const fs = require('fs');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
const db = require('./helpers/db');
const createApp = require('../src/app');
const config = require('../src/config');
const { registerOwner, auth, createMenuItem } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(async () => {
  await db.close();
  fs.rmSync(config.storage.uploadDir, { recursive: true, force: true });
});

const png = (width, height) => sharp({
  create: { width, height, channels: 3, background: { r: 120, g: 140, b: 40 } }
}).png().toBuffer();

const pathOf = (url) => new URL(url).pathname;

function upload(token, kind, buffer, filename = 'photo.png', contentType = 'image/png') {
  const req = request(app).post(`/api/uploads/${kind}`);
  if (token) req.set(auth(token));
  return req.attach('image', buffer, { filename, contentType });
}

describe('image uploads', () => {
  test('requires a token', async () => {
    const res = await upload(null, 'menu', await png(10, 10));
    expect(res.status).toBe(401);
  });

  test('stores a resized WebP and serves it', async () => {
    const owner = await registerOwner(app);
    const res = await upload(owner.token, 'menu', await png(3000, 2000));

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^http:\/\/localhost:5000\/uploads\/menu\/[0-9a-f-]{36}\.webp$/);

    const served = await request(app).get(pathOf(res.body.url)).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
    const meta = await sharp(served.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(800);
  });

  test('rejects SVG', async () => {
    const owner = await registerOwner(app);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await upload(owner.token, 'logo', svg, 'logo.svg', 'image/svg+xml');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_IMAGE');
  });

  test('rejects a non-image disguised as a PNG', async () => {
    const owner = await registerOwner(app);
    const res = await upload(owner.token, 'menu', Buffer.from('<?php echo "hi"; ?>'), 'shell.png', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_IMAGE');
  });

  test('rejects files over 8 MB', async () => {
    const owner = await registerOwner(app);
    const res = await upload(owner.token, 'menu', Buffer.alloc(8 * 1024 * 1024 + 1, 1));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  test('rejects an unknown image kind', async () => {
    const owner = await registerOwner(app);
    const res = await upload(owner.token, 'avatar', await png(10, 10));
    expect(res.status).toBe(400);
  });

  test('menu items no longer accept inline base64 images', async () => {
    const owner = await registerOwner(app);
    const res = await request(app)
      .post('/api/menu')
      .set(auth(owner.token))
      .send({ name: 'Dosa', price: 90, image: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(res.status).toBe(400);
  });

  test('replacing a menu image deletes the old file', async () => {
    const owner = await registerOwner(app);
    const first = await upload(owner.token, 'menu', await png(50, 50));
    const second = await upload(owner.token, 'menu', await png(60, 60));
    const item = await createMenuItem(app, owner.token, { image: first.body.url });

    const oldFile = path.join(config.storage.uploadDir, pathOf(first.body.url).replace('/uploads/', ''));
    expect(fs.existsSync(oldFile)).toBe(true);

    await request(app).put(`/api/menu/${item._id}`).set(auth(owner.token)).send({ image: second.body.url });
    expect(fs.existsSync(oldFile)).toBe(false);
  });

  test('a missing upload is a JSON 404', async () => {
    const res = await request(app).get('/uploads/menu/00000000-0000-0000-0000-000000000000.webp');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('resized copies for srcset (?w=)', () => {
  const getImage = (url) => request(app).get(url).buffer(true).parse((r, cb) => {
    const chunks = [];
    r.on('data', (c) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });

  test('serves the image scaled to an allowed width, cached for a year', async () => {
    const owner = await registerOwner(app);
    const { body } = await upload(owner.token, 'menu', await png(1200, 900));

    const res = await getImage(`${pathOf(body.url)}?w=320`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toMatch(/max-age=31536000/);
    const meta = await sharp(res.body).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 320, 240]);

    // Served again from the saved copy.
    const again = await getImage(`${pathOf(body.url)}?w=320`);
    expect(again.body.equals(res.body)).toBe(true);
  });

  test('other widths get the original, and small images are never enlarged', async () => {
    const owner = await registerOwner(app);
    const { body } = await upload(owner.token, 'menu', await png(200, 150));

    const odd = await getImage(`${pathOf(body.url)}?w=333`);
    expect((await sharp(odd.body).metadata()).width).toBe(200);
    const big = await getImage(`${pathOf(body.url)}?w=960`);
    expect((await sharp(big.body).metadata()).width).toBe(200);
  });

  test('a missing image is a 404 and the copies folder is not reachable directly', async () => {
    const missing = await request(app).get('/uploads/menu/00000000-0000-0000-0000-000000000000.webp?w=320');
    expect(missing.status).toBe(404);
    const owner = await registerOwner(app);
    const { body } = await upload(owner.token, 'menu', await png(800, 600));
    await getImage(`${pathOf(body.url)}?w=320`);
    const direct = await request(app).get(`/uploads/.variants/w320/${pathOf(body.url).replace('/uploads/', '')}`);
    expect(direct.status).toBe(404);
  });

  test('removing an image removes its resized copies', async () => {
    const owner = await registerOwner(app);
    const first = await upload(owner.token, 'menu', await png(800, 600));
    const second = await upload(owner.token, 'menu', await png(800, 600));
    const item = await createMenuItem(app, owner.token, { image: first.body.url });
    await getImage(`${pathOf(first.body.url)}?w=480`);
    const copy = path.join(config.storage.uploadDir, '.variants', 'w480', pathOf(first.body.url).replace('/uploads/', ''));
    expect(fs.existsSync(copy)).toBe(true);

    await request(app).put(`/api/menu/${item._id}`).set(auth(owner.token)).send({ image: second.body.url });
    expect(fs.existsSync(copy)).toBe(false);
  });
});
