// DANGER: drops the ENTIRE database named in MONGODB_URI.
//
// Refuses to run unless ALL of these hold:
//   1. NODE_ENV=development is set in the shell (a value in .env does NOT count)
//   2. --confirm is passed on the command line
//   3. MONGODB_URI points at a local MongoDB (localhost / 127.0.0.1 / ::1)
//
// Usage (PowerShell):  $env:NODE_ENV='development'; node scripts/reset-db.js --confirm

// Checked before dotenv loads, so a NODE_ENV line in .env cannot satisfy it.
const shellNodeEnv = process.env.NODE_ENV;
const confirmed = process.argv.includes('--confirm');

if (shellNodeEnv !== 'development' || !confirmed) {
  console.error('Refusing to reset the database.');
  console.error('This drops EVERY collection. To proceed, set NODE_ENV=development in the shell and pass --confirm.');
  process.exit(1);
}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/qr-menu';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

function describeTarget(connectionString) {
  const match = connectionString.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!match) return null;
  const hosts = match[1].split(',').map((h) => h.replace(/:\d+$/, ''));
  return { hosts, dbName: match[2] || 'test' };
}

const target = describeTarget(uri);
if (!target || !target.hosts.every((h) => LOCAL_HOSTS.includes(h))) {
  console.error('Refusing to reset: MONGODB_URI is not a local MongoDB. Only localhost databases can be reset.');
  process.exit(1);
}

async function resetDatabase() {
  try {
    await mongoose.connect(uri);
    console.log(`Connected to local MongoDB, database "${target.dbName}"`);

    await mongoose.connection.db.dropDatabase();
    console.log(`Database "${target.dbName}" dropped.`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error resetting database:', error.message);
    process.exit(1);
  }
}

resetDatabase();
