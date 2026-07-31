/**
 * Biometric Service — orchestrates CompreFace enrollment and verification
 * with the BiometricCredential MongoDB collection.
 *
 * This service is the single place responsible for:
 *   1. Checking if an employee is enrolled
 *   2. Auto-enrolling on first check-in (upload image to CompreFace, store subjectId)
 *   3. Verifying subsequent check-ins via CompreFace recognition
 *   4. Resetting/deleting enrollment
 *   5. Cleaning up CompreFace subjects
 *
 * No face descriptors, embeddings, or vectors are stored in MongoDB.
 * Only metadata: subjectId, enrollment timestamp, and verification stats.
 */

'use strict';

const compreface = require('./compreFaceService');

class BiometricService {
  /**
   * @param {Object} models - { Teacher, BiometricCredential }
   */
  constructor(models) {
    this.Teacher = models.Teacher;
    this.BiometricCredential = models.BiometricCredential;
  }

  /**
   * Get enrollment status for a teacher.
   * Returns { enrolled, subjectId, enrolledAt, verificationCount, lastVerified, lastSimilarity }
   */
  async getStatus(teacherId) {
    const cred = await this.BiometricCredential.findOne({ teacher_id: teacherId })
      .sort({ createdAt: -1 })
      .lean();

    if (!cred) {
      return { enrolled: false, subjectId: null, enrolledAt: null, verificationCount: 0, lastVerified: null, lastSimilarity: null };
    }

    return {
      enrolled: !!cred.subject_id,
      subjectId: cred.subject_id || null,
      enrolledAt: cred.enrolled_at || cred.createdAt || null,
      verificationCount: cred.verification_count || 0,
      lastVerified: cred.last_verified || null,
      lastSimilarity: cred.last_similarity || null,
    };
  }

  /**
   * The core biometric verification method.
   *
   * Workflow:
   *   1. Validate image exists
   *   2. Check if teacher is enrolled
   *   3. If NOT enrolled → auto-enroll (upload to CompreFace, store subjectId)
   *   4. If enrolled → verify against CompreFace
   *   5. Update verification stats in MongoDB
   *
   * @param {string} teacherId - MongoDB ObjectId string
   * @param {Buffer} imageBuffer - Captured selfie image
   * @param {string} schoolId - For subject namespace isolation
   * @returns {{ ok: boolean, enrolled: boolean, similarity: number|null, message: string }}
   */
  async verifyOrEnroll(teacherId, imageBuffer, schoolId) {
    // Validate image
    if (!imageBuffer || imageBuffer.length < 1000) {
      return { ok: false, enrolled: false, similarity: null, message: 'Image is too small or empty. Please try again.' };
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      return { ok: false, enrolled: false, similarity: null, message: 'Image is too large. Please try again.' };
    }

    // Check if CompreFace is configured
    if (!compreface.isConfigured) {
      return { ok: false, enrolled: false, similarity: null, message: 'Biometric service is not configured. Please contact your administrator.' };
    }

    const teacherStrId = teacherId.toString();

    // Check current enrollment status
    const existing = await this.BiometricCredential.findOne({ teacher_id: teacherStrId })
      .sort({ createdAt: -1 });

    const subjectId = `school_${schoolId}_teacher_${teacherStrId}`;

    // ── NOT ENROLLED → Auto-enroll ──
    if (!existing || !existing.subject_id) {
      try {
        await compreface.enroll(subjectId, imageBuffer);

        const now = new Date();
        const updateData = {
          subject_id: subjectId,
          school_id: schoolId,
          enrolled_at: now,
          biometric_enabled: true,
          verification_count: 1,
          last_verified: now,
          last_similarity: 1.0, // Self-enrollment, perfect match
        };

        if (existing) {
          await this.BiometricCredential.updateOne({ _id: existing._id }, { $set: updateData });
        } else {
          await this.BiometricCredential.create({
            teacher_id: teacherStrId,
            ...updateData,
          });
        }

        return { ok: true, enrolled: true, similarity: 1.0, message: 'Face enrolled and verified successfully.' };
      } catch (err) {
        console.error('[BiometricService] Enrollment error:', err.message);
        return { ok: false, enrolled: false, similarity: null, message: `Enrollment failed: ${err.message}` };
      }
    }

    // ── ENROLLED → Verify ──
    try {
      const recognizeResponse = await compreface.recognize(imageBuffer);
      const evaluation = compreface.evaluateResult(recognizeResponse, subjectId);

      // Update verification stats regardless of outcome
      const statsUpdate = {
        verification_count: (existing.verification_count || 0) + 1,
        last_verified: new Date(),
        last_similarity: evaluation.similarity,
      };
      await this.BiometricCredential.updateOne({ _id: existing._id }, { $set: statsUpdate });

      if (!evaluation.matched) {
        return { ok: false, enrolled: true, similarity: evaluation.similarity, message: evaluation.message };
      }

      return { ok: true, enrolled: true, similarity: evaluation.similarity, message: evaluation.message };
    } catch (err) {
      console.error('[BiometricService] Verification error:', err.message);
      return { ok: false, enrolled: true, similarity: null, message: `Verification failed: ${err.message}` };
    }
  }

  /**
   * Reset an employee's biometric enrollment.
   * Deletes from both MongoDB and CompreFace.
   */
  async resetEnrollment(teacherId) {
    const cred = await this.BiometricCredential.findOne({ teacher_id: teacherId })
      .sort({ createdAt: -1 });

    if (cred?.subject_id) {
      try {
        await compreface.deleteSubject(cred.subject_id);
      } catch (err) {
        console.warn('[BiometricService] CompreFace subject deletion warning:', err.message);
      }
    }

    await this.BiometricCredential.deleteMany({ teacher_id: teacherId });
    return true;
  }

  /**
   * Get the set of teacher IDs that are enrolled for a given school.
   * Used by the teachers list endpoint to show enrollment status.
   */
  async getEnrolledTeacherIds(schoolId) {
    const creds = await this.BiometricCredential.find({ school_id: schoolId, subject_id: { $ne: null, $exists: true } })
      .select('teacher_id')
      .lean();
    return new Set(creds.map(c => c.teacher_id.toString()));
  }
}

module.exports = BiometricService;
