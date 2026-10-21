// Responsive images: smaller copies of uploaded photos for srcset, so a phone never downloads a 1200 px
// photo for a 170 px card.
//   Local storage:  <api>/uploads/menu/<uuid>.webp?w=320   (server/src/services/storage/imageVariants.js)
//   Cloudinary:     .../image/upload/w_320,c_limit,f_auto,q_auto/...
// Other URLs (seed links, external images) are used as they are.
export const VARIANT_WIDTHS = [160, 320, 480, 640, 960];

const LOCAL = /\/uploads\/[a-z]+\/[0-9a-f-]{36}\.webp$/;
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

export function resizedUrl(url, width) {
  if (typeof url !== 'string') return url;
  if (LOCAL.test(url)) return `${url}?w=${width}`;
  const cloud = url.match(CLOUDINARY);
  if (cloud) return `${cloud[1]}w_${width},c_limit,f_auto,q_auto/${cloud[2]}`;
  return url;
}

// Props for <img>: src (a mid-size copy), srcSet with the given widths, and sizes.
export function responsiveImage(url, { widths = VARIANT_WIDTHS, sizes, fallback = widths[Math.min(1, widths.length - 1)] } = {}) {
  if (!url || resizedUrl(url, fallback) === url) return { src: url };
  return {
    src: resizedUrl(url, fallback),
    srcSet: widths.map((w) => `${resizedUrl(url, w)} ${w}w`).join(', '),
    sizes
  };
}
