const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

// Widths the client may ask for in srcset (client/src/lib/images.js uses the same list). A fixed list keeps
// the number of files per image small and stops anyone filling the disk with arbitrary sizes.
const VARIANT_WIDTHS = [160, 320, 480, 640, 960];
const KEY_PATTERN = /^[a-z]+\/[0-9a-f-]{36}\.webp$/;
const VARIANTS_DIR = '.variants';

const variantPath = (uploadDir, width, key) => path.join(uploadDir, VARIANTS_DIR, `w${width}`, key);

/**
 * Serves /uploads/<key>?w=<width>: the stored image scaled down to that width, made on first request and
 * kept next to the uploads. Requests without ?w (or with a width that is not in the list) fall through to
 * the original file.
 */
function imageVariants(uploadDir) {
  return async (req, res, next) => {
    const width = Number(req.query.w);
    const key = req.path.slice(1);
    if (!VARIANT_WIDTHS.includes(width) || !KEY_PATTERN.test(key)) return next();

    const target = variantPath(uploadDir, width, key);
    try {
      await fs.access(target);
    } catch {
      let source;
      try {
        source = await fs.readFile(path.join(uploadDir, key));
      } catch {
        return next(); // no such image: the static handler answers 404
      }
      try {
        const output = await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        await fs.mkdir(path.dirname(target), { recursive: true });
        // Write then rename, so a parallel request never serves a half-written file.
        const temp = `${target}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(temp, output);
        await fs.rename(temp, target);
      } catch (err) {
        return next(err);
      }
    }
    // dotfiles: the .variants folder is ours; express.static still refuses dotfile paths from the URL.
    res.sendFile(target, { maxAge: '365d', immutable: true, dotfiles: 'allow', headers: { 'Content-Type': 'image/webp' } });
  };
}

// Deletes every resized copy of an image (called when the image itself is removed).
async function removeVariants(uploadDir, key) {
  if (!KEY_PATTERN.test(key)) return;
  await Promise.all(VARIANT_WIDTHS.map((width) => fs.rm(variantPath(uploadDir, width, key), { force: true })));
}

module.exports = { VARIANT_WIDTHS, imageVariants, removeVariants };
