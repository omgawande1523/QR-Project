// Signs every role in once per run, as an Android and as an iOS app, and saves the sessions for the tests. The
// login endpoint allows 20 attempts per 15 minutes, and each Playwright project starts a fresh worker, so
// logging in from the tests themselves would run out with four projects.
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:5000';
const ACCOUNTS = { owner: 'demo@qrmenu.test', manager: 'manager@qrmenu.test', waiter: 'waiter@qrmenu.test', kitchen: 'kitchen@qrmenu.test' };
const FILE = path.join(__dirname, '..', '.results', 'app-logins.json');

module.exports = async () => {
  const sessions = {};
  for (const platform of ['android', 'ios']) {
    for (const [role, identifier] of Object.entries(ACCOUNTS)) {
      const res = await fetch(`${API}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'app', 'X-Platform': platform, 'X-Device-Name': platform === 'ios' ? 'Apple iPhone' : 'Google Pixel 7' },
        body: JSON.stringify({ identifier, password: 'Demo@1234' })
      });
      if (!res.ok) throw new Error(`Login as ${role} failed (${res.status}): run npm run seed first`);
      sessions[`${role}:${platform}`] = await res.json();
    }
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(sessions));
};

module.exports.FILE = FILE;
