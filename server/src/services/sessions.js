const Session = require('../models/Session');
const { DAY_MS, ttlFor, signToken, signStaffToken } = require('./auth');
const emit = require('../sockets/io');

const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g; // eslint-disable-line no-control-regex

// "Chrome on Windows" from a browser's User-Agent; good enough to recognise a device in a list.
function describeBrowser(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
      : /OPR\//.test(ua) ? 'Opera'
        : /Firefox\//.test(ua) ? 'Firefox'
          : /Chrome\//.test(ua) ? 'Chrome'
            : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android'
    : /iPhone/.test(ua) ? 'iPhone'
      : /iPad/.test(ua) ? 'iPad'
        : /Windows/.test(ua) ? 'Windows'
          : /Mac OS X/.test(ua) ? 'Mac'
            : /CrOS/.test(ua) ? 'Chromebook'
              : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

// The staff app sends X-Client: app, X-Platform (ios or android; the first Android version sent none) and
// X-Device-Name (e.g. "Samsung Galaxy Tab A8"); browsers send none of them.
function clientInfo(req) {
  const client = req.get('x-client') === 'app' ? 'app' : 'web';
  const platform = client === 'web' ? 'web' : req.get('x-platform') === 'ios' ? 'ios' : 'android';
  const named = (req.get('x-device-name') || '').replace(CONTROL_CHARS, ' ').trim().slice(0, 60);
  const fallback = { web: describeBrowser(req.get('user-agent')), android: 'Android app', ios: 'iPhone app' }[platform];
  return { client, platform, deviceName: named || fallback };
}

const expiryFor = (session) => new Date(Date.now() + ttlFor(session) * DAY_MS);

// Which sessions belong to the same login: the owner's (staff: null) or one staff member's.
const subjectFilter = ({ userId, staffId }) => (staffId ? { staff: staffId } : { restaurant: userId, staff: null });
// The same login's other devices (all of them for a token from before sessions existed).
const otherSessions = (user) => ({ ...subjectFilter(user), ...(user.sessionId ? { _id: { $ne: user.sessionId } } : {}) });

// Starts a session for a successful login or sign-up and returns its token.
async function signIn(req, { user, staff }) {
  const info = clientInfo(req);
  const subject = staff
    ? { restaurant: staff.restaurant, staff: staff._id, role: staff.role }
    : { restaurant: user._id, staff: null, role: 'owner' };
  const session = await Session.create({ ...subject, ...info, expiresAt: expiryFor(info) });
  return { token: staff ? signStaffToken(staff, session) : signToken(user, session), session };
}

// A fresh token for an existing session (after a password change, or the app renewing itself).
async function reissue(sessionId, { user, staff }) {
  const session = sessionId ? await Session.findById(sessionId) : null;
  if (session) {
    session.expiresAt = expiryFor(session);
    session.lastActiveAt = new Date();
    await session.save();
  }
  return staff ? signStaffToken(staff, session) : signToken(user, session);
}

// Deletes sessions (and with them their push tokens) and drops their open sockets.
async function endSessions(filter) {
  const ids = (await Session.find(filter).select('_id').lean()).map((s) => String(s._id));
  if (!ids.length) return 0;
  await Session.deleteMany({ _id: { $in: ids } });
  ids.forEach((id) => emit.disconnectSession(id));
  return ids.length;
}

module.exports = { clientInfo, describeBrowser, subjectFilter, otherSessions, signIn, reissue, endSessions };
