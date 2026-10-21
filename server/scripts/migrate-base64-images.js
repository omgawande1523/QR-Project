// Converts images stored inline as base64 data URLs (the old upload method) into uploaded files.
//
// Menu item images and restaurant profile pictures, banners and QR logos that start with
// "data:image/" are decoded, resized and re-encoded like a normal upload, saved through the
// storage adapter, and the field is replaced with the file URL. Nothing is deleted.
//
// Dry run (default) only reports what would change:   node scripts/migrate-base64-images.js
// Apply the changes:                                    node scripts/migrate-base64-images.js --apply

const mongoose = require('mongoose');
const config = require('../src/config');
const MenuItem = require('../src/models/MenuItem');
const User = require('../src/models/User');
const { saveImage } = require('../src/services/images');

const apply = process.argv.includes('--apply');
const DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,/i;

const TARGETS = [
  { model: MenuItem, label: 'menu item', fields: { image: 'menu' } },
  { model: User, label: 'restaurant', fields: { profilePicture: 'profile', bannerImage: 'banner', qrLogo: 'logo' } }
];

async function migrateDocument(doc, fields, label) {
  const changes = {};
  for (const [field, kind] of Object.entries(fields)) {
    const value = doc[field];
    if (typeof value !== 'string' || !DATA_URL.test(value)) continue;

    const buffer = Buffer.from(value.replace(DATA_URL, ''), 'base64');
    const sizeKb = Math.round(buffer.length / 1024);
    if (!apply) {
      console.log(`  would convert ${label} ${doc._id} ${field} (${sizeKb} KB)`);
      changes[field] = true;
      continue;
    }
    try {
      const { url } = await saveImage(buffer, kind);
      changes[field] = url;
      console.log(`  converted ${label} ${doc._id} ${field} (${sizeKb} KB) -> ${url}`);
    } catch (err) {
      console.warn(`  skipped ${label} ${doc._id} ${field}: ${err.message}`);
    }
  }
  if (apply && Object.keys(changes).length > 0) {
    await doc.constructor.updateOne({ _id: doc._id }, { $set: changes });
  }
  return Object.keys(changes).length;
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`${apply ? 'Applying' : 'Dry run'} on database "${mongoose.connection.name}"`);

  let total = 0;
  for (const { model, label, fields } of TARGETS) {
    const filter = { $or: Object.keys(fields).map((field) => ({ [field]: { $regex: '^data:image/' } })) };
    const cursor = model.find(filter).select(Object.keys(fields).join(' ')).cursor();
    for await (const doc of cursor) {
      total += await migrateDocument(doc, fields, label);
    }
  }

  console.log(apply ? `Converted ${total} image(s).` : `${total} image(s) would be converted. Re-run with --apply.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Migration failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
