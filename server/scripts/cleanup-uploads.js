// Removes images that were added more than 24 hours ago but are not used anywhere (the server also does
// this every 6 hours). Usage: npm run cleanup:uploads [-- --dry-run]
const mongoose = require('mongoose');
const config = require('../src/config');
const { cleanupUploads } = require('../src/services/uploadCleanup');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(config.mongoUri);
  console.log(`Database "${mongoose.connection.name}" on ${mongoose.connection.host}${dryRun ? ' (dry run, nothing is deleted)' : ''}`);
  const { finals, originals, failed } = await cleanupUploads({ dryRun });
  console.log(`${dryRun ? 'Would remove' : 'Removed'} ${finals} unused crops and ${originals} unused originals${failed ? `; ${failed} could not be removed` : ''}.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Cleanup failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
