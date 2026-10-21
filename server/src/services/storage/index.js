const config = require('../../config');
const createLocalStorage = require('./localStorage');
const { createCloudinaryStorage } = require('./cloudinaryStorage');

/*
 * Storage adapter interface. An adapter (local disk, Cloudinary, or later S3) implements:
 *   save(buffer, { folder, extension, contentType }) -> Promise<{ key, url }>   (url is public)
 *   read(key) -> Promise<Buffer>
 *   remove(key) -> Promise<void>
 *   keyFromUrl(url) -> key | null   (null for URLs this adapter did not create)
 * Register it below and select it with STORAGE_DRIVER.
 */
function createStorage() {
  switch (config.storage.driver) {
    case 'local':
      return createLocalStorage({ uploadDir: config.storage.uploadDir, publicUrl: config.publicUrl });
    case 'cloudinary':
      return createCloudinaryStorage(config.storage.cloudinary);
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${config.storage.driver}`);
  }
}

const storage = createStorage();

// Best-effort delete of a replaced or removed image; URLs we did not create are left alone.
async function discardImage(url) {
  const key = storage.keyFromUrl(url);
  if (!key) return;
  try {
    await storage.remove(key);
  } catch (err) {
    console.error('Could not delete image', key, err.message);
  }
}

module.exports = { storage, discardImage };
