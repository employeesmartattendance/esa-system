// MIGRATION_INSIGHTFACE.js - Database migration for InsightFace implementation
// Run this ONCE after deploying the new code, before restarting the server
//
// This script safely migrates existing BiometricCredential records from the
// old browser-based face-api.js descriptors to the new InsightFace embedding format.
//
// Usage: node backend/scripts/migrate-insightface.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/esa';

async function migrate() {
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);

    const db = mongoose.connection.db;
    const collection = db.collection('biometriccredentials');

    // Check if migration already completed
    const sampleDoc = await collection.findOne({});
    if (sampleDoc && sampleDoc.embedding && !sampleDoc.face_descriptor) {
      console.log('✅ Already migrated (embedding field exists, face_descriptor absent)');
      await mongoose.connection.close();
      return;
    }

    console.log('[Migration] Backing up old records...');
    const backupCollection = db.collection('biometriccredentials_backup_descriptors');
    const allDocs = await collection.find({}).toArray();
    
    if (allDocs.length > 0) {
      await backupCollection.insertMany(allDocs);
      console.log(`✅ Backup created: ${allDocs.length} records`);
    }

    console.log('[Migration] Removing old browser-based descriptors...');
    // Delete face_descriptor field from all records (first enrollment will auto-create embedding)
    const result = await collection.updateMany(
      { face_descriptor: { $exists: true } },
      { $unset: { face_descriptor: '', device_label: '' } }
    );
    console.log(`✅ Updated ${result.modifiedCount} records - old descriptors removed`);

    console.log('[Migration] ✅ Migration complete!');
    console.log('Next steps:');
    console.log('  1. Deployed new InsightFace code');
    console.log('  2. Employees will auto-re-enroll on their next check-in');
    console.log('  3. Existing attendance records are untouched');
    console.log('  4. Backup saved as: biometriccredentials_backup_descriptors');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Fatal error:', err.message);
    process.exit(1);
  }
}

migrate();
