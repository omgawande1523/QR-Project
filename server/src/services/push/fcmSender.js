const crypto = require('crypto');
const fs = require('fs');

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TIMEOUT_MS = 15000;

const base64url = (input) => Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/**
 * FIREBASE_SERVICE_ACCOUNT is the service-account key from Firebase (Project settings > Service accounts >
 * Generate new private key): either the JSON itself or the path to the .json file, kept outside the repo.
 * Returns null when it is empty, and throws a readable error when it is not a service-account key.
 */
function loadServiceAccount(value) {
  if (!value || !value.trim()) return null;
  const text = value.trim().startsWith('{') ? value : fs.readFileSync(value.trim(), 'utf8');
  let key;
  try {
    key = JSON.parse(text);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
  if (key.type !== 'service_account' || !key.project_id || !key.client_email || !key.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must be a Firebase service-account key (type, project_id, client_email, private_key)');
  }
  return key;
}

/*
 * Sends through the FCM HTTP v1 API with a service account; no Firebase SDK needed.
 *   send(message) -> { ok: true } | { ok: false, unregistered: boolean, error }
 * `unregistered` means the device token is no longer valid (app uninstalled, data cleared) and should be removed.
 */
function createFcmSender(serviceAccount, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const sendUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  let cached = null; // { accessToken, expiresAt }

  async function accessToken() {
    if (cached && cached.expiresAt - 60_000 > now()) return cached.accessToken;
    const iat = Math.floor(now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(JSON.stringify({ iss: serviceAccount.client_email, scope: SCOPE, aud: tokenUri, iat, exp: iat + 3600 }));
    const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(serviceAccount.private_key);
    const assertion = `${header}.${claims}.${base64url(signature)}`;
    const res = await fetchImpl(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new Error(`Firebase sign-in failed (${res.status}): ${data.error_description || data.error || 'no details'}`);
    cached = { accessToken: data.access_token, expiresAt: now() + (data.expires_in || 3600) * 1000 };
    return cached.accessToken;
  }

  return {
    name: 'fcm',
    async send(message) {
      const res = await fetchImpl(sendUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (res.ok) return { ok: true };
      const data = await res.json().catch(() => ({}));
      const code = data.error?.details?.find((d) => d.errorCode)?.errorCode || data.error?.status;
      return {
        ok: false,
        unregistered: res.status === 404 || code === 'UNREGISTERED' || (code === 'INVALID_ARGUMENT' && /token/i.test(data.error?.message || '')),
        error: `${res.status} ${code || ''} ${data.error?.message || ''}`.trim()
      };
    }
  };
}

module.exports = { createFcmSender, loadServiceAccount };
