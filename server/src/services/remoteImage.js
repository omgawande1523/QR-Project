const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');
const AppError = require('../utils/AppError');

// Downloads an image from a URL an owner pasted, without letting the server be used to reach
// internal addresses (SSRF):
// - http/https only, standard ports, no credentials in the URL
// - the host is resolved here and every address must be public unicast (no private, loopback,
//   link-local, CGNAT, multicast or reserved ranges, including IPv4-mapped IPv6); the connection
//   is pinned to the checked address so DNS cannot change between the check and the connect
// - the same checks run again on every redirect (at most 3)
// - one deadline for the whole download and a byte limit counted while streaming; compressed
//   responses are not accepted, so the limit cannot be bypassed by decompression
const DEFAULT_LIMITS = { maxBytes: 8 * 1024 * 1024, timeoutMs: 10_000, maxRedirects: 3, allowedPorts: [80, 443] };
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const USER_AGENT = 'QRMenuImageFetcher/1.0 (+https://github.com/omgawande1523/QR-Project)';

const errors = {
  invalid: () => AppError.badRequest('Enter a link that starts with http:// or https://', 'INVALID_IMAGE_URL'),
  blocked: (why = 'That link points to a private address and cannot be used') => AppError.badRequest(why, 'BLOCKED_IMAGE_URL'),
  failed: () => new AppError(422, "Couldn't download that image", 'DOWNLOAD_FAILED'),
  tooLarge: (maxBytes) => new AppError(413, `Image is too large (the limit is ${Math.round(maxBytes / 1024 / 1024)} MB)`, 'IMAGE_TOO_LARGE')
};

function isPublicAddress(address) {
  let parsed;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return false;
  }
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) parsed = parsed.toIPv4Address();
  return parsed.range() === 'unicast';
}

async function systemResolve(hostname) {
  if (net.isIP(hostname)) return [hostname];
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

function createRemoteImageFetcher({ resolve = systemResolve, isAllowed = (address) => isPublicAddress(address), limits = {} } = {}) {
  const { maxBytes, timeoutMs, maxRedirects, allowedPorts } = { ...DEFAULT_LIMITS, ...limits };

  function parse(raw) {
    let url;
    try {
      url = new URL(String(raw).trim());
    } catch {
      throw errors.invalid();
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw errors.invalid();
    if (url.username || url.password) throw errors.blocked('Links with a username or password cannot be used');
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    if (!allowedPorts.includes(port)) throw errors.blocked('Only links on standard web ports can be used');
    return url;
  }

  const remaining = (deadline) => {
    const ms = deadline - Date.now();
    if (ms <= 0) throw errors.failed();
    return ms;
  };

  async function connect(url, deadline) {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    let addresses;
    try {
      addresses = await Promise.race([
        resolve(hostname),
        new Promise((_, reject) => setTimeout(() => reject(errors.failed()), remaining(deadline)))
      ]);
    } catch (err) {
      throw err instanceof AppError ? err : errors.failed();
    }
    if (!addresses?.length) throw errors.failed();
    if (addresses.some((address) => !isAllowed(address, hostname))) throw errors.blocked();

    const pinned = addresses[0];
    const family = net.isIP(pinned);
    const lib = url.protocol === 'https:' ? https : http;
    return new Promise((resolvePromise, reject) => {
      const req = lib.request(url, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8', 'Accept-Encoding': 'identity' },
        // Always connect to the address that passed the check above.
        lookup: (_host, options, callback) => (options?.all ? callback(null, [{ address: pinned, family }]) : callback(null, pinned, family))
      });
      const timer = setTimeout(() => req.destroy(errors.failed()), remaining(deadline));
      req.on('response', (res) => {
        clearTimeout(timer);
        resolvePromise(res);
      });
      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err instanceof AppError ? err : errors.failed());
      });
      req.end();
    });
  }

  function readBody(res, deadline) {
    return new Promise((resolvePromise, reject) => {
      const chunks = [];
      let total = 0;
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => {
        finish(reject, errors.failed());
        res.destroy();
      }, remaining(deadline));
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          // Settle first: destroying the stream fires 'aborted', which would report a generic failure.
          finish(reject, errors.tooLarge(maxBytes));
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => finish(resolvePromise, Buffer.concat(chunks)));
      res.on('error', () => finish(reject, errors.failed()));
      res.on('aborted', () => finish(reject, errors.failed()));
    });
  }

  // Returns the image bytes; throws AppError with a message the owner can act on.
  return async function fetchRemoteImage(rawUrl) {
    const deadline = Date.now() + timeoutMs;
    let url = parse(rawUrl);
    for (let redirects = 0; ; redirects += 1) {
      const res = await connect(url, deadline);
      if (REDIRECTS.has(res.statusCode)) {
        res.resume();
        if (redirects >= maxRedirects || !res.headers.location) throw errors.failed();
        url = parse(new URL(res.headers.location, url).toString());
        continue;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        throw errors.failed();
      }
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
        res.destroy();
        throw errors.failed();
      }
      if (Number(res.headers['content-length']) > maxBytes) {
        res.destroy();
        throw errors.tooLarge(maxBytes);
      }
      return readBody(res, deadline);
    }
  };
}

const remoteImage = {
  isPublicAddress,
  createRemoteImageFetcher,
  fetchRemoteImage: createRemoteImageFetcher()
};

module.exports = remoteImage;
