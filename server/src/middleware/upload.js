const multer = require('multer');
const AppError = require('../utils/AppError');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// SVG is deliberately excluded: it can carry scripts.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(AppError.badRequest('Upload a JPEG, PNG, WebP or GIF image', 'INVALID_IMAGE'));
    }
    cb(null, true);
  }
});

// Accepts a single file in the "image" field and turns multer errors into AppErrors.
function singleImage(req, res, next) {
  imageUpload.single('image')(req, res, (err) => {
    if (!err) {
      if (!req.file) return next(AppError.badRequest('Choose an image to upload', 'NO_FILE'));
      return next();
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'Image is too large (the limit is 8 MB)', 'FILE_TOO_LARGE'));
      return next(AppError.badRequest('Upload one image in the "image" field', 'INVALID_UPLOAD'));
    }
    next(err);
  });
}

module.exports = { singleImage, MAX_IMAGE_BYTES };
