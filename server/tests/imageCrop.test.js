const fs = require('fs');
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

const pathOf = (url) => new URL(url).pathname;

// Left half red, right half blue: lets tests see which way an image was rotated.
async function twoTone(width, height) {
  const half = await sharp({ create: { width: width / 2, height, channels: 3, background: '#ff0000' } }).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: '#0000ff' } })
    .composite([{ input: half, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function fetchImage(url) {
  const res = await request(app).get(pathOf(url)).buffer(true).parse((r, cb) => {
    const chunks = [];
    r.on('data', (c) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  expect(res.status).toBe(200);
  return res.body;
}

async function averageColour(buffer) {
  const { channels } = await sharp(buffer).stats();
  return channels.slice(0, 3).map((c) => Math.round(c.mean));
}

function uploadOriginal(token, buffer) {
  return request(app).post('/api/uploads/originals').set(auth(token)).attach('image', buffer, { filename: 'photo.png', contentType: 'image/png' });
}

describe('crop flow', () => {
  test('stores the original at full size (capped at 3000 px) as WebP', async () => {
    const owner = await registerOwner(app);
    const res = await uploadOriginal(owner.token, await twoTone(4000, 2000));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ originalId: expect.any(String), width: 3000, height: 1500 });
    expect(res.body.url).toMatch(/\/uploads\/originals\/[0-9a-f-]{36}\.webp$/);
  });

  test('crops a dish photo to exactly 1200 x 900', async () => {
    const owner = await registerOwner(app);
    const original = (await uploadOriginal(owner.token, await twoTone(2000, 1000))).body;
    const res = await request(app).post('/api/uploads/crop').set(auth(owner.token))
      .send({ originalId: original.originalId, kind: 'menu', crop: { x: 0, y: 0, width: 1000, height: 750 } });
    expect(res.status).toBe(201);
    const image = await fetchImage(res.body.url);
    const meta = await sharp(image).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1200, 900]);
    const [r, , b] = await averageColour(image);
    expect(r).toBeGreaterThan(200); // the left (red) half was cropped
    expect(b).toBeLessThan(60);
  });

  test('applies rotation before cropping (90 degrees clockwise puts the left half on top)', async () => {
    const owner = await registerOwner(app);
    const original = (await uploadOriginal(owner.token, await twoTone(1000, 500))).body;
    const res = await request(app).post('/api/uploads/crop').set(auth(owner.token))
      .send({ originalId: original.originalId, kind: 'logo', rotation: 90, crop: { x: 0, y: 0, width: 500, height: 500 } });
    expect(res.status).toBe(201);
    const image = await fetchImage(res.body.url);
    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height]).toEqual([512, 512]);
    const [r, , b] = await averageColour(image);
    expect(r).toBeGreaterThan(200);
    expect(b).toBeLessThan(60);
  });

  test.each([['banner', 1200, 1200], ['profile', 512, 512]])('%s output is %ix%i', async (kind, w, h) => {
    const owner = await registerOwner(app);
    const original = (await uploadOriginal(owner.token, await twoTone(800, 800))).body;
    const res = await request(app).post('/api/uploads/crop').set(auth(owner.token))
      .send({ originalId: original.originalId, kind, crop: { x: 0, y: 0, width: 800, height: 800 } });
    const meta = await sharp(await fetchImage(res.body.url)).metadata();
    expect([meta.width, meta.height]).toEqual([w, h]);
  });

  test('a crop outside the image is clamped instead of failing', async () => {
    const owner = await registerOwner(app);
    const original = (await uploadOriginal(owner.token, await twoTone(400, 300))).body;
    const res = await request(app).post('/api/uploads/crop').set(auth(owner.token))
      .send({ originalId: original.originalId, kind: 'menu', crop: { x: 350, y: 250, width: 4000, height: 3000 } });
    expect(res.status).toBe(201);
  });

  test('another owner cannot crop my original', async () => {
    const me = await registerOwner(app);
    const them = await registerOwner(app);
    const original = (await uploadOriginal(me.token, await twoTone(400, 300))).body;
    const res = await request(app).post('/api/uploads/crop').set(auth(them.token))
      .send({ originalId: original.originalId, kind: 'menu', crop: { x: 0, y: 0, width: 400, height: 300 } });
    expect(res.status).toBe(404);
  });

  test('validates the crop request and needs a token', async () => {
    const owner = await registerOwner(app);
    expect((await request(app).post('/api/uploads/crop').send({})).status).toBe(401);
    const bad = await request(app).post('/api/uploads/crop').set(auth(owner.token))
      .send({ originalId: 'nope', kind: 'poster', crop: { x: -1, y: 0, width: 2, height: 2 } });
    expect(bad.status).toBe(400);
  });
});

describe('edit crop (source lookup)', () => {
  test('returns the original and the last crop of an image', async () => {
    const owner = await registerOwner(app);
    const original = (await uploadOriginal(owner.token, await twoTone(2000, 1000))).body;
    const cropped = (await request(app).post('/api/uploads/crop').set(auth(owner.token))
      .send({ originalId: original.originalId, kind: 'menu', rotation: 0, crop: { x: 800, y: 100, width: 800, height: 600 } })).body;

    const res = await request(app).get('/api/uploads/source').query({ url: cropped.url }).set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ originalId: original.originalId, url: original.url, crop: { x: 800, y: 100, width: 800, height: 600 }, rotation: 0 });
  });

  test('an older image used by one of my dishes becomes its own original', async () => {
    const owner = await registerOwner(app);
    const png = await twoTone(600, 450);
    const direct = await request(app).post('/api/uploads/menu').set(auth(owner.token)).attach('image', png, { filename: 'a.png', contentType: 'image/png' });
    await createMenuItem(app, owner.token, { image: direct.body.url });

    const first = await request(app).get('/api/uploads/source').query({ url: direct.body.url }).set(auth(owner.token));
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ crop: null, rotation: 0, width: 600, height: 450 });
    const second = await request(app).get('/api/uploads/source').query({ url: direct.body.url }).set(auth(owner.token));
    expect(second.body.originalId).toBe(first.body.originalId); // created once
  });

  test('refuses images I do not use', async () => {
    const me = await registerOwner(app);
    const them = await registerOwner(app);
    const theirs = await request(app).post('/api/uploads/menu').set(auth(them.token)).attach('image', await twoTone(200, 150), { filename: 'a.png', contentType: 'image/png' });
    await createMenuItem(app, them.token, { image: theirs.body.url });
    const res = await request(app).get('/api/uploads/source').query({ url: theirs.body.url }).set(auth(me.token));
    expect(res.status).toBe(404);
  });
});
