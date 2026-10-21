const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const Upload = require('../models/Upload');
const { storage } = require('./storage');

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_AGE_MS = 24 * HOUR_MS;
const DEFAULT_INTERVAL_MS = 6 * HOUR_MS;

// The storage key at the end of an uploaded image URL, whatever host it was served from, so a changed
// PUBLIC_URL can never make an image in use look abandoned.
const KEY_IN_URL = /\/uploads\/([a-z]+\/[0-9a-f-]{36}\.[a-z]+)$/;

async function imagesInUse() {
  const [menuImages, profiles] = await Promise.all([
    MenuItem.distinct('image'),
    User.find({}, 'profilePicture bannerImage qrLogo').lean()
  ]);
  const urls = new Set([...menuImages, ...profiles.flatMap((u) => [u.profilePicture, u.bannerImage, u.qrLogo])].filter(Boolean));
  const keys = new Set([...urls].map((url) => url.match(KEY_IN_URL)?.[1]).filter(Boolean));
  return (upload) => urls.has(upload.url) || keys.has(upload.key);
}

/**
 * Removes images owners added but never used:
 * - crops ("finals") older than `olderThanMs` that no dish or profile field uses, and
 * - originals older than that which no remaining crop was made from (so the original behind an image in
 *   use, or behind a crop still being edited, stays for "Edit crop").
 * Nothing referenced is ever deleted. Returns what was (or, with dryRun, would be) removed.
 */
async function cleanupUploads({ olderThanMs = DEFAULT_AGE_MS, now = Date.now(), dryRun = false } = {}) {
  const cutoff = new Date(now - olderThanMs);
  const inUse = await imagesInUse();

  const staleFinals = (await Upload.find({ role: 'final', createdAt: { $lt: cutoff } }).select('key url').lean())
    .filter((u) => !inUse(u));
  const removedFinalIds = staleFinals.map((u) => u._id);

  const oldOriginals = await Upload.find({ role: 'original', createdAt: { $lt: cutoff } }).select('key url').lean();
  const backed = new Set((await Upload.distinct('original', {
    role: 'final',
    original: { $in: oldOriginals.map((o) => o._id) },
    _id: { $nin: removedFinalIds }
  })).map(String));
  const staleOriginals = oldOriginals.filter((o) => !backed.has(String(o._id)) && !inUse(o));

  const result = { finals: staleFinals.length, originals: staleOriginals.length, failed: 0, dryRun };
  if (dryRun) return result;

  for (const upload of [...staleFinals, ...staleOriginals]) {
    try {
      await storage.remove(upload.key); // a file that is already gone is fine
      await Upload.deleteOne({ _id: upload._id });
    } catch (err) {
      result.failed += 1;
      console.error('Upload cleanup: could not remove', upload.key, err.message);
    }
  }
  return result;
}

// Runs the cleanup shortly after start-up and then every few hours. Safe to run on several instances.
function scheduleUploadCleanup({ intervalMs = DEFAULT_INTERVAL_MS, firstRunMs = 60 * 1000 } = {}) {
  const run = async () => {
    try {
      const { finals, originals, failed } = await cleanupUploads();
      if (finals || originals || failed) console.log(`Upload cleanup: removed ${finals} unused crops and ${originals} originals${failed ? `, ${failed} failed` : ''}`);
    } catch (err) {
      console.error('Upload cleanup failed:', err.message);
    }
  };
  const first = setTimeout(run, firstRunMs);
  const timer = setInterval(run, intervalMs);
  first.unref();
  timer.unref();
  return () => { clearTimeout(first); clearInterval(timer); };
}

module.exports = { cleanupUploads, scheduleUploadCleanup };
