const crypto = require('crypto');

const KEY_PATTERN = /^[a-z]+\/[0-9a-f-]{36}\.[a-z]+$/;
const TIMEOUT_MS = 30000;

// Cloudinary's request signature: SHA-1 of the sorted parameters followed by the API secret.
// https://cloudinary.com/documentation/authentication_signatures
function sign(params, apiSecret) {
  const payload = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(payload + apiSecret).digest('hex');
}

// Parses CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>, as shown in the Cloudinary console).
function parseCloudinaryUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'cloudinary:' || !url.username || !url.password || !url.hostname) return null;
  return { cloudName: url.hostname, apiKey: decodeURIComponent(url.username), apiSecret: decodeURIComponent(url.password) };
}

/*
 * Stores images in Cloudinary, so they survive redeploys (Render's disk is wiped on every deploy) and are
 * served from its CDN. Talks to the Upload API with signed requests; no SDK needed.
 * Keys look like local ones ("menu/<uuid>.webp"); the Cloudinary public ID is "<folder>/<key without extension>".
 */
function createCloudinaryStorage({ cloudName, apiKey, apiSecret, folder = 'qr-menu', fetchImpl = fetch }) {
  const apiBase = `https://api.cloudinary.com/v1_1/${cloudName}/image`;
  const deliveryBase = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  const escapedBase = deliveryBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedFolder = folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Optional version segment (v1712345678/) comes before the public ID.
  const urlPattern = new RegExp(`^${escapedBase}(?:v\\d+/)?${escapedFolder}/([a-z]+/[0-9a-f-]{36}\\.[a-z]+)$`);

  const publicIdOf = (key) => `${folder}/${key.replace(/\.[a-z]+$/, '')}`;

  async function call(action, params, file) {
    const signed = { ...params, timestamp: Math.floor(Date.now() / 1000) };
    const body = new FormData();
    Object.entries(signed).forEach(([k, v]) => body.append(k, String(v)));
    body.append('api_key', apiKey);
    body.append('signature', sign(signed, apiSecret));
    if (file) body.append('file', new Blob([file.buffer], { type: file.contentType }), file.name);

    const res = await fetchImpl(`${apiBase}/${action}`, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Cloudinary ${action} failed (${res.status}): ${data.error?.message || 'no details'}`);
    return data;
  }

  return {
    async save(buffer, { folder: kind, extension, contentType }) {
      const key = `${kind}/${crypto.randomUUID()}.${extension}`;
      if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
      const data = await call('upload', { public_id: publicIdOf(key), overwrite: 'false' }, { buffer, contentType, name: key.split('/')[1] });
      return { key, url: data.secure_url };
    },

    async read(key) {
      if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
      const res = await fetchImpl(`${deliveryBase}${folder}/${key}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Cloudinary download failed (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },

    async remove(key) {
      if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
      // "not found" is fine: the image is gone either way.
      await call('destroy', { public_id: publicIdOf(key), invalidate: 'true' });
    },

    // Returns the storage key for a URL this adapter produced, or null for anything else.
    keyFromUrl(url) {
      if (typeof url !== 'string') return null;
      return url.match(urlPattern)?.[1] || null;
    }
  };
}

module.exports = { createCloudinaryStorage, parseCloudinaryUrl, sign };
