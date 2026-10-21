const { createCloudinaryStorage, parseCloudinaryUrl, sign } = require('../src/services/storage/cloudinaryStorage');

// No network: a fake fetch records each request and answers like Cloudinary does.
function fakeCloudinary() {
  const calls = [];
  const files = new Map(); // public ID -> bytes
  const fetchImpl = async (url, init = {}) => {
    const entry = { url, fields: {} };
    if (init.body instanceof FormData) {
      for (const [k, v] of init.body.entries()) entry.fields[k] = typeof v === 'string' ? v : Buffer.from(await v.arrayBuffer());
    }
    calls.push(entry);
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

    if (url.endsWith('/image/upload')) {
      files.set(entry.fields.public_id, entry.fields.file);
      return json(200, { secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v1712345678/${entry.fields.public_id}.webp`, format: 'webp', version: 1712345678 });
    }
    if (url.endsWith('/image/destroy')) {
      const existed = files.delete(entry.fields.public_id);
      return json(200, { result: existed ? 'ok' : 'not found' });
    }
    const delivered = url.match(/^https:\/\/res\.cloudinary\.com\/demo-cloud\/image\/upload\/(.+)\.webp$/);
    if (delivered && files.has(delivered[1])) {
      const bytes = files.get(delivered[1]);
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    }
    return json(404, { error: { message: 'Resource not found' } });
  };
  return { calls, files, fetchImpl };
}

const make = (fake, extra = {}) => createCloudinaryStorage({
  cloudName: 'demo-cloud', apiKey: '123456', apiSecret: 'shh-secret', folder: 'qr-menu', fetchImpl: fake.fetchImpl, ...extra
});

describe('Cloudinary storage', () => {
  test('signs requests the way Cloudinary documents', () => {
    // Example from https://cloudinary.com/documentation/authentication_signatures
    expect(sign({ timestamp: 1315060510, public_id: 'sample_image' }, 'abcd')).toBe('b4ad47fb4e25c7bf5f92a20089f9db59bc302313');
  });

  test('parses CLOUDINARY_URL', () => {
    expect(parseCloudinaryUrl('cloudinary://123456:abc-DEF@my-cloud')).toEqual({ cloudName: 'my-cloud', apiKey: '123456', apiSecret: 'abc-DEF' });
    expect(parseCloudinaryUrl('https://123:abc@my-cloud')).toBeNull();
    expect(parseCloudinaryUrl('cloudinary://my-cloud')).toBeNull();
    expect(parseCloudinaryUrl('not a url')).toBeNull();
  });

  test('save uploads a signed request and returns a key and the CDN URL', async () => {
    const fake = fakeCloudinary();
    const storage = make(fake);
    const { key, url } = await storage.save(Buffer.from('webp-bytes'), { folder: 'menu', extension: 'webp', contentType: 'image/webp' });

    expect(key).toMatch(/^menu\/[0-9a-f-]{36}\.webp$/);
    expect(url).toBe(`https://res.cloudinary.com/demo-cloud/image/upload/v1712345678/qr-menu/${key}`);

    const { fields, url: endpoint } = fake.calls[0];
    expect(endpoint).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    expect(fields.public_id).toBe(`qr-menu/${key.replace('.webp', '')}`);
    expect(fields.api_key).toBe('123456');
    expect(fields.file.toString()).toBe('webp-bytes');
    // The secret is only used for the signature, never sent.
    expect(Object.values(fields).some((v) => String(v).includes('shh-secret'))).toBe(false);
    const { public_id, overwrite, timestamp } = fields;
    expect(fields.signature).toBe(sign({ public_id, overwrite, timestamp }, 'shh-secret'));
  });

  test('read downloads the stored image and remove destroys it', async () => {
    const fake = fakeCloudinary();
    const storage = make(fake);
    const { key } = await storage.save(Buffer.from('original'), { folder: 'originals', extension: 'webp', contentType: 'image/webp' });

    expect((await storage.read(key)).toString()).toBe('original');

    await storage.remove(key);
    const destroy = fake.calls.find((c) => c.url.endsWith('/destroy'));
    expect(destroy.fields.public_id).toBe(`qr-menu/${key.replace('.webp', '')}`);
    expect(fake.files.size).toBe(0);
    await expect(storage.read(key)).rejects.toThrow(/404/);
    // Removing something already gone is fine.
    await expect(storage.remove(key)).resolves.toBeUndefined();
  });

  test('keyFromUrl only accepts URLs from this cloud and folder', () => {
    const storage = make(fakeCloudinary());
    const key = 'menu/0b0e6a9c-6f6e-4a52-9a3c-2f0b7d3d9e11.webp';
    expect(storage.keyFromUrl(`https://res.cloudinary.com/demo-cloud/image/upload/v17/qr-menu/${key}`)).toBe(key);
    expect(storage.keyFromUrl(`https://res.cloudinary.com/demo-cloud/image/upload/qr-menu/${key}`)).toBe(key);
    expect(storage.keyFromUrl(`https://res.cloudinary.com/other-cloud/image/upload/v17/qr-menu/${key}`)).toBeNull();
    expect(storage.keyFromUrl(`https://res.cloudinary.com/demo-cloud/image/upload/v17/other/${key}`)).toBeNull();
    expect(storage.keyFromUrl(`http://localhost:5000/uploads/${key}`)).toBeNull();
    expect(storage.keyFromUrl(null)).toBeNull();
  });

  test('a Cloudinary error becomes an Error with its message, and bad keys are refused', async () => {
    const storage = make({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid Signature' } }) }) });
    await expect(storage.save(Buffer.from('x'), { folder: 'menu', extension: 'webp', contentType: 'image/webp' }))
      .rejects.toThrow('Cloudinary upload failed (401): Invalid Signature');
    await expect(storage.read('../etc/passwd')).rejects.toThrow('Invalid storage key');
    await expect(storage.remove('menu/../../x')).rejects.toThrow('Invalid storage key');
  });
});
