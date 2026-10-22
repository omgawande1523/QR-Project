// Signs a test page in to the staff app build with a session saved by global-setup.js. The app build in a
// browser keeps the session where the phone would use secure storage: localStorage. iPhone and iPad projects
// (names starting with "ios-") use the iOS app's sessions.
const fs = require('fs');
const { FILE } = require('./global-setup');

const platformOf = (testInfo) => (testInfo.project.name.startsWith('ios-') ? 'ios' : 'android');

function sessionFor(role, testInfo) {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'))[`${role}:${platformOf(testInfo)}`];
}

async function signedIn(page, role, testInfo) {
  const session = sessionFor(role, testInfo);
  await page.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('userId', s.userId);
    localStorage.setItem('role', s.role);
    localStorage.setItem('qr.alerts', JSON.stringify({ sound: false, voice: false, browser: false }));
  }, session);
  return session;
}

module.exports = { platformOf, sessionFor, signedIn };
