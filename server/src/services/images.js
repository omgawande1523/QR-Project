const sharp = require('sharp');
const AppError = require('../utils/AppError');
const { storage } = require('./storage');

// Output size per use. Images are only ever shrunk, never enlarged.
const IMAGE_KINDS = {
  menu: { width: 1200, height: 1200 },
  logo: { width: 512, height: 512 },
  profile: { width: 512, height: 512 },
  banner: { width: 1920, height: 800 }
};

const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heif'];

/**
 * Re-encodes an uploaded image as WebP: verifies it really is an image (whatever the file
 * extension or Content-Type claimed), applies EXIF orientation, strips metadata and resizes it.
 */
async function processImage(buffer, kind) {
  const size = IMAGE_KINDS[kind];
  if (!size) throw AppError.badRequest('Unknown image type', 'UNKNOWN_IMAGE_KIND');

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw AppError.badRequest('The file is not a valid image', 'INVALID_IMAGE');
  }
  if (!ALLOWED_FORMATS.includes(metadata.format)) {
    throw AppError.badRequest('Upload a JPEG, PNG, WebP or GIF image', 'INVALID_IMAGE');
  }
  if (metadata.width * metadata.height > 40_000_000) {
    throw AppError.badRequest('The image dimensions are too large', 'IMAGE_TOO_LARGE');
  }

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

module.exports = { IMAGE_KINDS, processImage, saveImage };
