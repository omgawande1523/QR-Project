const express = require('express');
const { z } = require('zod');
const uploads = require('../controllers/uploadController');
const { verifyToken } = require('../middleware/auth');
const { singleImage } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { IMAGE_KINDS } = require('../services/images');

const router = express.Router();

const kindParam = { params: z.object({ kind: z.enum(Object.keys(IMAGE_KINDS)) }) };

// POST /api/uploads/:kind  (multipart/form-data, field "image")
router.post('/:kind', verifyToken, validate(kindParam), singleImage, uploads.uploadImage);

module.exports = router;
