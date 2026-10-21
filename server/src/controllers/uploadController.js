const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Upload = require('../models/Upload');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const { storage } = require('../services/storage');
const { saveImage, saveOriginal, cropOriginal } = require('../services/images');
const remoteImage = require('../services/remoteImage');

const originalBody = (doc) => ({ originalId: doc._id, url: doc.url, width: doc.width, height: doc.height });

// Direct upload (no crop): returns the public URL of the processed image.
exports.uploadImage = asyncHandler(async (req, res) => {
  const { url } = await saveImage(req.file.buffer, req.params.kind);
  res.status(201).json({ url });
});

// Step 1 of the crop flow: keep the full-size original and return it for the crop screen.
exports.uploadOriginal = asyncHandler(async (req, res) => {
  const original = await saveOriginal(req.file.buffer, req.user.userId);
  res.status(201).json(originalBody(original));
});

// Step 1, from a pasted link: the server downloads the image (safely) and keeps it as our own WebP,
// so menus never hotlink images that expire or change.
exports.importFromUrl = asyncHandler(async (req, res) => {
  const buffer = await remoteImage.fetchRemoteImage(req.body.url);
  const original = await saveOriginal(buffer, req.user.userId, { source: 'url', notImageMessage: "This link isn't an image" });
  res.status(201).json(originalBody(original));
});

// Step 2: apply the crop rectangle and rotation chosen in the browser.
exports.crop = asyncHandler(async (req, res) => {
  const { originalId, kind, crop, rotation } = req.body;
  const final = await cropOriginal({ ownerId: req.user.userId, originalId, kind, crop, rotation });
  res.status(201).json({ url: final.url, originalId });
});

// Is this URL used by one of the owner's dishes or profile images?
async function ownerUsesUrl(ownerId, url) {
  const [inMenu, inProfile] = await Promise.all([
    MenuItem.exists({ owner: ownerId, image: url }),
    User.exists({ _id: ownerId, $or: [{ profilePicture: url }, { bannerImage: url }, { qrLogo: url }] })
  ]);
  return Boolean(inMenu || inProfile);
}

// "Edit crop": the original and the last crop behind an image the owner is using.
exports.source = asyncHandler(async (req, res) => {
  const { url } = req.query;
  const final = await Upload.findOne({ owner: req.user.userId, role: 'final', url }).populate('original');
  if (final?.original) {
    return res.json({ ...originalBody(final.original), crop: final.crop || null, rotation: final.rotation || 0 });
  }

  // Images from before cropping existed: use the image itself as the original, once.
  const key = storage.keyFromUrl(url);
  if (!key || !(await ownerUsesUrl(req.user.userId, url))) {
    throw AppError.notFound('This image cannot be re-cropped. Add it again to crop it.', 'NO_ORIGINAL');
  }
  const original = await saveOriginal(await storage.read(key), req.user.userId, { source: 'existing' });
  await Upload.create({ owner: req.user.userId, role: 'final', key, url, original: original._id, rotation: 0 });
  return res.json({ ...originalBody(original), crop: null, rotation: 0 });
});
