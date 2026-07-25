/**
 * One-time migration: backfill `industry` on legacy School documents and
 * `group` on legacy Teacher documents that were created before those
 * fields existed.
 *
 * This is OPTIONAL. The application already works correctly without
 * running this — the frontend defaults any missing `industry`/`group`
 * value to 'school'/'primary' at read time (see frontend/src/industries.js
 * getIndustry(), and TeachersManager.vue's `group === 'primary'` check).
 * Run this only if you want the database itself to hold explicit values
 * instead of relying on those in-app fallbacks — e.g. before running your
 * own reporting/BI queries directly against MongoDB.
 *
 * Safe to run multiple times (idempotent — only touches documents where
 * the field is missing). Does not touch any other field, does not touch
 * Attendance, Settings, User, or any other collection.
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-industry-backfill.js
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

  const schoolsResult = await db.collection('schools').updateMany(
    { industry: { $exists: false } },
    { $set: { industry: 'school' } }
  );
  console.log(`schools: backfilled industry on ${schoolsResult.modifiedCount} document(s) (matched ${schoolsResult.matchedCount}).`);

  const teachersResult = await db.collection('teachers').updateMany(
    { group: { $exists: false } },
    { $set: { group: 'primary' } }
  );
  console.log(`teachers: backfilled group on ${teachersResult.modifiedCount} document(s) (matched ${teachersResult.matchedCount}).`);

  await mongoose.disconnect();
  console.log('Done. Disconnected.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
