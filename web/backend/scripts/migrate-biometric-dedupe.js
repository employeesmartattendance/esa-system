/**
 * One-time cleanup: remove duplicate BiometricCredential documents.
 *
 * Why this exists: the register route previously did a check-then-act
 * (check whether a credential exists, then create one) with a timing gap —
 * two near-simultaneous enroll requests for the same teacher (a double-tap,
 * a client retry firing while the first request was still in flight, a
 * network hiccup causing a resend of a request that had already succeeded,
 * etc.) could both pass the check before either had created a document,
 * leaving that teacher with more than one stored face descriptor. The
 * BiometricCredential schema now has a unique index on teacher_id to close
 * that race going forward — but if any duplicates were already created
 * before that index existed, MongoDB will refuse to build a unique index
 * over data that violates it, so this script clears them out first.
 *
 * This is OPTIONAL and only needed if the unique index fails to build (the
 * app logs a clear error on startup in that case — see app.js). If you're
 * setting this up fresh, or verify()/status() have never shown anything
 * unexpected, you likely have nothing to clean up and can skip this.
 *
 * For any teacher with more than one BiometricCredential row, this keeps
 * only the newest (highest createdAt) and deletes the rest — matching what
 * the app already treats as the authoritative credential everywhere it reads
 * one (see the `.sort({ createdAt: -1 })` in the /status and /verify routes
 * in biometric-routes.js), so this does not change which face descriptor is
 * actually being verified against for anyone.
 *
 * Safe to run multiple times (idempotent — a teacher with 0 or 1 rows is
 * left untouched). Does not touch any other field or any other collection.
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-biometric-dedupe.js
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

  // Group by teacher_id, keep each group's ids sorted newest-first.
  const groups = await coll.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$teacher_id', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  if (groups.length === 0) {
    console.log('No duplicate biometric credentials found. Nothing to do.');
  } else {
    let totalDeleted = 0;
    for (const g of groups) {
      const [keepId, ...dropIds] = g.ids; // ids[0] is newest due to the $sort above
      const result = await coll.deleteMany({ _id: { $in: dropIds } });
      totalDeleted += result.deletedCount;
      console.log(`teacher ${g._id}: kept newest credential ${keepId}, removed ${result.deletedCount} older duplicate(s).`);
    }
    console.log(`Done deduplicating: ${groups.length} teacher(s) affected, ${totalDeleted} duplicate document(s) removed in total.`);
  }

  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch(err => {
  console.error('Biometric dedupe migration failed:', err);
  process.exit(1);
});
