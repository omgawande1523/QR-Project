const sharp = require('sharp');
const AppError = require('../utils/AppError');
const { storage } = require('./storage');
const Upload = require('../models/Upload');

// Output size per use. The crop flow always produces exactly this size (the client crops to the same
// aspect ratio); direct uploads are only shrunk to fit inside it.
//   menu: dish card and item detail photo, 4:3     profile: restaurant logo, 1:1 (shown round)
//   banner: customer welcome hero, 1:1             logo: centre of the table QR code, 1:1
const IMAGE_KINDS = {
  menu: { width: 1200, height: 900 },
  logo: { width: 512, height: 512 },
  profile: { width: 512, height: 512 },
  banner: { width: 1200, height: 1200 }
};

const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heif'];
const MAX_PIXELS = 40_000_000;
const ORIGINAL_MAX_SIDE = 3000;

// Throws a friendly AppError unless the bytes really are a supported raster image (SVG is refused:
// sharp can read it, but it may carry scripts). `notImageMessage` overrides both "not an image" errors.
async function inspectImage(buffer, notImageMessage) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw AppError.badRequest(notImageMessage || 'The file is not a valid image', 'INVALID_IMAGE');
  }
  if (!ALLOWED_FORMATS.includes(metadata.format)) {
    throw AppError.badRequest(notImageMessage || 'Upload a JPEG, PNG, WebP or GIF image', 'INVALID_IMAGE');
  }
  if (metadata.width * metadata.height > MAX_PIXELS) {
    throw AppError.badRequest('The image dimensions are too large', 'IMAGE_TOO_LARGE');
  }
  return metadata;
}

/**
 * Re-encodes an uploaded image as WebP: verifies it really is an image (whatever the file
 * extension or Content-Type claimed), applies EXIF orientation, strips metadata and resizes it.
 */
async function processImage(buffer, kind) {
  const size = IMAGE_KINDS[kind];
  if (!size) throw AppError.badRequest('Unknown image type', 'UNKNOWN_IMAGE_KIND');
  await inspectImage(buffer);
  return sharp(buffer, { animated: false })
    .autoOrient()
    .resize({ ...size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function saveImage(buffer, kind) {
  const processed = await processImage(buffer, kind);
  return storage.save(processed, { folder: kind, extension: 'webp', contentType: 'image/webp' });
}

// Stores the full-size original (re-encoded, metadata stripped, longest side <= 3000 px) for cropping.
async function saveOriginal(buffer, ownerId, { source = 'upload', notImageMessage } = {}) {
  await inspectImage(buffer, notImageMessage);
  const { data, info } = await sharp(buffer, { animated: false })
    .autoOrient()
    .resize({ width: ORIGINAL_MAX_SIDE, height: ORIGINAL_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  const saved = await storage.save(data, { folder: 'originals', extension: 'webp', contentType: 'image/webp' });
  return Upload.create({ owner: ownerId, role: 'original', key: saved.key, url: saved.url, width: info.width, height: info.height, source });
}

// Applies a crop made in the client (react-easy-crop pixels, relative to the image rotated by
// `rotation` degrees inside its bounding box) to the stored original and saves the result.
async function cropOriginal({ ownerId, originalId, kind, crop, rotation = 0 }) {
  const size = IMAGE_KINDS[kind];
  if (!size) throw AppError.badRequest('Unknown image type', 'UNKNOWN_IMAGE_KIND');
  const original = await Upload.findOne({ _id: originalId, owner: ownerId, role: 'original' });
  if (!original) throw AppError.notFound('That image is no longer available. Please add it again.', 'ORIGINAL_NOT_FOUND');

  const angle = ((Math.round(rotation) % 360) + 360) % 360;
  const rotated = await sharp(await storage.read(original.key))
    .rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer({ resolveWithObject: true });

  // Clamp to the image so rounding in the browser can never make sharp throw.
  const W = rotated.info.width;
  const H = rotated.info.height;
  const left = Math.min(Math.max(0, Math.round(crop.x)), W - 1);
  const top = Math.min(Math.max(0, Math.round(crop.y)), H - 1);
  const width = Math.max(1, Math.min(Math.round(crop.width), W - left));
  const height = Math.max(1, Math.min(Math.round(crop.height), H - top));

  const output = await sharp(rotated.data)
    .extract({ left, top, width, height })
    .resize({ ...size, fit: 'cover' })
    .webp({ quality: 82 })
    .toBuffer();
  const saved = await storage.save(output, { folder: kind, extension: 'webp', contentType: 'image/webp' });
  return Upload.create({
    owner: ownerId,
    role: 'final',
    kind,
    key: saved.key,
    url: saved.url,
    width: size.width,
    height: size.height,
    original: original._id,
    crop: { x: left, y: top, width, height },
    rotation: angle
  });
}

module.exports = { IMAGE_KINDS, processImage, saveImage, saveOriginal, cropOriginal, inspectImage };
