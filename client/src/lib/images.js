import { api } from './api';

// Crop ratio and preview per image field; the server writes the same ratios (server/src/services/images.js).
export const IMAGE_FIELDS = {
  menu: { aspect: 4 / 3, round: false, preview: 'card', title: 'Crop dish photo' },
  profile: { aspect: 1, round: true, preview: 'logo', title: 'Crop logo' },
  banner: { aspect: 1, round: false, preview: 'hero', title: 'Crop banner photo' },
  logo: { aspect: 1, round: false, preview: 'qr', title: 'Crop QR logo' }
};

export const MAX_IMAGE_MB = 8;

// Step 1 of the crop flow: store the full-size original (from a file, a pasted image or a link).
export async function uploadOriginal(file) {
  const data = new FormData();
  data.append('image', file, file.name || 'pasted-image.png');
  return (await api.post('/api/uploads/originals', data)).data;
}

export async function importImageUrl(url) {
  return (await api.post('/api/uploads/from-url', { url })).data;
}

// Step 2: the server crops the original; returns the final image URL.
export async function cropImage({ originalId, kind, crop, rotation }) {
  return (await api.post('/api/uploads/crop', { originalId, kind, crop, rotation })).data.url;
}

// For "Edit crop": the original and last crop behind an image.
export async function imageSource(url) {
  return (await api.get('/api/uploads/source', { params: { url } })).data;
}

// Size of an image's bounding box after rotating it (same as sharp's rotate()).
export function rotatedSize(width, height, degrees) {
  const r = (degrees * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(r) * width) + Math.abs(Math.sin(r) * height),
    height: Math.abs(Math.sin(r) * width) + Math.abs(Math.cos(r) * height)
  };
}

// Draws the crop the server will produce, scaled to the canvas, for the live preview.
export function drawCropPreview(canvas, img, pixels, rotation) {
  if (!canvas || !img || !pixels?.width) return;
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / pixels.width;
  const box = rotatedSize(img.naturalWidth, img.naturalHeight, rotation);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-pixels.x, -pixels.y);
  ctx.translate(box.width / 2, box.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.drawImage(img, 0, 0);
}
