const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('./helpers/db');
const createApp = require('../src/app');
const config = require('../src/config');
const Upload = require('../src/models/Upload');
const MenuItem = require('../src/models/MenuItem');
const User = require('../src/models/User');
const { saveOriginal, cropOriginal } = require('../src/services/images');
const { cleanupUploads } = require('../src/services/uploadCleanup');
const { registerOwner } = require('./helpers/factory');

const app = createApp();

beforeAll(db.connect);
afterEach(db.clear);
afterAll(async () => {
  await db.close();
  fs.rmSync(config.storage.uploadDir, { recursive: true, force: true });
});

const DAY = 24 * 60 * 60 * 1000;
const fileExists = (key) => fs.existsSync(path.join(config.storage.uploadDir, key));
const age = (upload, ms) => Upload.updateOne({ _id: upload._id }, { createdAt: new Date(Date.now() - ms) });
const stillThere = async (upload) => Boolean(await Upload.exists({ _id: upload._id })) && fileExists(upload.key);

let photo;
beforeAll(async () => {
  photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#a3ad4f' } }).jpeg().toBuffer();
});

async function originalWithCrop(ownerId) {
  const original = await saveOriginal(photo, ownerId);
  const final = await cropOriginal({ ownerId, originalId: original._id, kind: 'menu', crop: { x: 0, y: 0, width: 800, height: 600 } });
  return { original, final };
}

describe('abandoned upload cleanup', () => {
  test('removes old originals and crops that nothing uses, keeps everything in use', async () => {
    const owner = await registerOwner(app);

    // 1. Uploaded two days ago and never cropped or used
    const abandoned = await saveOriginal(photo, owner.userId);
    await age(abandoned, 2 * DAY);

    // 2. A dish uses the crop: crop and its original stay
    const used = await originalWithCrop(owner.userId);
    await MenuItem.create({ owner: owner.userId, name: 'Dosa', price: 120, image: used.final.url });
    await age(used.original, 3 * DAY);
    await age(used.final, 3 * DAY);

    // 3. The dish photo was replaced: the old crop and its original go
    const replaced = await originalWithCrop(owner.userId);
    await age(replaced.original, 2 * DAY);
    await age(replaced.final, 2 * DAY);

    // 4. Old original, crop made an hour ago and not saved yet (owner still editing): both stay
    const editing = await originalWithCrop(owner.userId);
    await age(editing.original, 2 * DAY);
    await age(editing.final, 60 * 60 * 1000);

    // 5. Uploaded an hour ago: too new to judge
    const fresh = await saveOriginal(photo, owner.userId);

    // 6. Used as the restaurant banner
    const banner = await originalWithCrop(owner.userId);
    await User.updateOne({ _id: owner.userId }, { bannerImage: banner.final.url });
    await age(banner.original, 5 * DAY);
    await age(banner.final, 5 * DAY);

    const result = await cleanupUploads();
    expect(result).toEqual({ finals: 1, originals: 2, failed: 0, dryRun: false });

    expect(await stillThere(abandoned)).toBe(false);
    expect(await stillThere(replaced.final)).toBe(false);
    expect(await stillThere(replaced.original)).toBe(false);
    for (const kept of [used.original, used.final, editing.original, editing.final, fresh, banner.original, banner.final]) {
      expect(await stillThere(kept)).toBe(true);
    }

    // Running again finds nothing more
    expect(await cleanupUploads()).toMatchObject({ finals: 0, originals: 0 });
  });

  test('an image in use is recognised by its file even if the site address changed', async () => {
    const owner = await registerOwner(app);
    const { original, final } = await originalWithCrop(owner.userId);
    await MenuItem.create({ owner: owner.userId, name: 'Idli', price: 80, image: `https://old-host.example${new URL(final.url).pathname}` });
    await age(original, 3 * DAY);
    await age(final, 3 * DAY);
    expect(await cleanupUploads()).toMatchObject({ finals: 0, originals: 0 });
    expect(await stillThere(final)).toBe(true);
  });

  test('a dry run reports without deleting', async () => {
    const owner = await registerOwner(app);
    const abandoned = await saveOriginal(photo, owner.userId);
    await age(abandoned, 2 * DAY);
    expect(await cleanupUploads({ dryRun: true })).toEqual({ finals: 0, originals: 1, failed: 0, dryRun: true });
    expect(await stillThere(abandoned)).toBe(true);
  });

  test('a record whose file is already gone is still cleaned up', async () => {
    const owner = await registerOwner(app);
    const abandoned = await saveOriginal(photo, owner.userId);
    await age(abandoned, 2 * DAY);
    fs.rmSync(path.join(config.storage.uploadDir, abandoned.key));
    expect(await cleanupUploads()).toMatchObject({ originals: 1, failed: 0 });
    expect(await Upload.exists({ _id: abandoned._id })).toBeNull();
  });
});
