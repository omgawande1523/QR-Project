const express = require('express');
const { z } = require('zod');
const uploads = require('../controllers/uploadController');
const { verifyToken } = require('../middleware/auth');
const { singleImage } = require('../middleware/upload');
const { imageLimiter, imageUrlLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { IMAGE_KINDS } = require('../services/images');
const { objectId } = require('../validators/common');

const router = express.Router();

const kind = z.enum(Object.keys(IMAGE_KINDS), { errorMap: () => ({ message: 'Unknown image type' }) });
const pixels = z.number().finite().min(0).max(100000);

const schemas = {
  kindParam: { params: z.object({ kind }) },
  crop: {
    body: z.object({
      originalId: objectId,
      kind,
      crop: z.object({ x: pixels, y: pixels, width: pixels.min(8, 'The crop is too small'), height: pixels.min(8, 'The crop is too small') }),
      rotation: z.number().finite().min(-360).max(360).default(0)
    })
  },
  source: { query: z.object({ url: z.string().trim().url().max(2048) }) },
  fromUrl: { body: z.object({ url: z.string({ required_error: 'Paste an image link' }).trim().min(1, 'Paste an image link').max(2048, 'That link is too long') }) }
};

router.use(verifyToken, imageLimiter);

// Crop flow: original -> crop. Specific paths come before /:kind.
router.post('/originals', singleImage, uploads.uploadOriginal);
router.post('/from-url', imageUrlLimiter, validate(schemas.fromUrl), uploads.importFromUrl);
router.post('/crop', validate(schemas.crop), uploads.crop);
router.get('/source', validate(schemas.source), uploads.source);

// POST /api/uploads/:kind  (multipart/form-data, field "image"): direct upload without cropping
router.post('/:kind', validate(schemas.kindParam), singleImage, uploads.uploadImage);

module.exports = router;
