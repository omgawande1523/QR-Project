const asyncHandler = require('../utils/asyncHandler');
const { saveImage } = require('../services/images');

// Returns the public URL of the processed image; the client then saves that URL on the record.
exports.uploadImage = asyncHandler(async (req, res) => {
  const { url } = await saveImage(req.file.buffer, req.params.kind);
  res.status(201).json({ url });
});
