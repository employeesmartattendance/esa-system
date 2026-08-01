/**
 * One-time cleanup: drop the stale `credential_id_1` unique index from the
 * biometriccredentials collection.
 *
 * Why this exists: an earlier schema version had a unique `credential_id`
 * field on BiometricCredential. That field was removed from the current
 * schema (app.js), but the unique index MongoDB built for it was never
 * dropped. Every document inserted under the current schema has no
 * `credential_id`, which Mongo stores as `credential_id: null` — and the
 * leftover unique index only allows ONE document total with that null value.
 * So the very first face enrollment on the collection succeeds, and every
 * enrollment after that (for any teacher) fails with:
 *   E11000 duplicate key error ... index: credential_id_1 dup key: { credential_id: null }
 *
 * This is now also handled automatically on every server startup (see
 * dropStaleBiometricIndex() in app.js), so running this script manually is
 * OPTIONAL — it's here for cases where you want to clean it up immediately
 * without redeploying/restarting the server first.
 *
 * Safe to run multiple times (idempotent — does nothing if the index is
 * already gone). Does not touch any documents or any other collection.
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-drop-credential-id-index.js
 *
 * Requires the same MONGODB_URI / .env setup as the main app.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI (or MONGO_URI) not set in environment/.env — aborting.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const coll = db.collection('biometriccredentials');

  const indexes = await coll.indexes();
  const stale = indexes.find(ix => ix.name === 'credential_id_1');

  if (!stale) {
    console.log('No stale credential_id_1 index found. Nothing to do.');
  } else {
    await coll.dropIndex('credential_id_1');
    console.log('Dropped stale credential_id_1 index. Face enrollment should work correctly now.');
  }

  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch(err => {
  console.error('Drop credential_id_1 index migration failed:', err);
  process.exit(1);
});
