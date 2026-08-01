/**
 * Embedding Service — Orchestrates server-side biometric verification
 *
 * Workflow:
 *   1. Check if employee is enrolled (has biometric embedding)
 *   2. If NOT enrolled → extract embedding from image, store it, mark enrolled
 *   3. If enrolled → extract embedding from image, compare against stored one
 *   4. Return verification result with similarity score
 *
 * This service is the single point responsible for:
 *   - Employee enrollment detection
 *   - Automatic first-time enrollment
 *   - Face verification against stored embeddings
 *   - Similarity threshold evaluation
 *   - Enrollment reset/deletion
 *
 * Storage:
 *   - MongoDB stores only: employeeId, embedding (array), enrolledAt, stats
 *   - No raw images are permanently stored
 *   - No face descriptors from old browser-based system
 */

'use strict';

const insightface = require('./faceRecognitionEngine');

class EmbeddingService {
  /**
   * @param {Object} models - { BiometricCredential, Teacher }
   */
  constructor(models) {
    this.BiometricCredential = models.BiometricCredential;
    this.Teacher = models.Teacher;
  }

  /**
   * Get enrollment status for an employee.
   * Returns { enrolled, enrolledAt, verificationCount, lastVerified, lastSimilarity }
   */
  async getStatus(employeeId) {
    const cred = await this.BiometricCredential.findOne({ employee_id: employeeId })
      .sort({ createdAt: -1 })
      .lean();

    if (!cred || !cred.embedding) {
      return {
        enrolled: false,
        enrolledAt: null,
        verificationCount: 0,
        lastVerified: null,
        lastSimilarity: null,
      };
    }

    return {
      enrolled: true,
      enrolledAt: cred.enrolled_at || cred.createdAt || null,
      verificationCount: cred.verification_count || 0,
      lastVerified: cred.last_verified || null,
      lastSimilarity: cred.last_similarity || null,
    };
  }

  /**
   * Core biometric verification/enrollment method.
   *
   * Workflow:
   *   1. Extract embedding from uploaded image
   *   2. Check if employee is enrolled
   *   3. If NOT enrolled → store embedding, return success (auto-enrollment)
   *   4. If enrolled → compare embeddings using cosine similarity
   *   5. Update verification stats
   *
   * @param {string} employeeId - Employee ID
   * @param {string} companyId - Company ID (for data isolation)
   * @param {Buffer} imageBuffer - Captured image
   * @returns {Promise<{ok: boolean, enrolled: boolean, similarity: number|null, message: string}>}
   */
  async verifyOrEnroll(employeeId, companyId, imageBuffer) {
    // Validate image
    if (!imageBuffer || imageBuffer.length < 1000) {
      return {
        ok: false,
        enrolled: false,
        similarity: null,
        message: 'Image is too small or empty. Please try again.',
      };
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      return {
        ok: false,
        enrolled: false,
        similarity: null,
        message: 'Image is too large. Maximum 10MB allowed.',
      };
    }

    // Check if the face recognition engine is initialized
    if (!insightface.isInitialized()) {
      return {
        ok: false,
        enrolled: false,
        similarity: null,
        message: 'Biometric service is initializing. Please try again in a moment.',
      };
    }

    const empStr = employeeId.toString();

    try {
      // Extract embedding from the uploaded image
      const { embedding: newEmbedding, confidence } = await insightface.extractEmbedding(imageBuffer);

      // Check current enrollment status
      const existing = await this.BiometricCredential.findOne({ employee_id: empStr })
        .sort({ createdAt: -1 });

      // ── NOT ENROLLED → Auto-enroll ──
      if (!existing || !existing.embedding) {
        try {
          const now = new Date();
          const enrollData = {
            employee_id: empStr,
            company_id: companyId,
            embedding: Array.from(newEmbedding), // Store as array in MongoDB
            embedding_model: 'face-api-recognition-v1',
            embedding_version: 1,
            biometric_enabled: true,
            enrolled_at: now,
            verification_count: 1,
            last_verified: now,
            last_similarity: 1.0, // Self-enrollment is perfect match
            last_detection_confidence: confidence,
          };

          if (existing) {
            // Update existing credential with new embedding
            await this.BiometricCredential.updateOne({ _id: existing._id }, { $set: enrollData });
          } else {
            // Create new credential
            await this.BiometricCredential.create(enrollData);
          }

          return {
            ok: true,
            enrolled: true,
            similarity: 1.0,
            message: 'Face enrolled and verified successfully.',
          };
        } catch (err) {
          console.error('[EmbeddingService] Enrollment error:', err.message);
          return {
            ok: false,
            enrolled: false,
            similarity: null,
            message: `Enrollment failed: ${err.message}`,
          };
        }
      }

      // ── ENROLLED → Verify ──
      // Convert stored embedding back to Float32Array for comparison
      const storedEmbedding = new Float32Array(existing.embedding);

      const verificationResult = await insightface.verifyFace(imageBuffer, storedEmbedding);

      // Update verification stats regardless of outcome
      const statsUpdate = {
        verification_count: (existing.verification_count || 0) + 1,
        last_verified: new Date(),
        last_similarity: verificationResult.similarity,
        last_detection_confidence: confidence,
      };

      await this.BiometricCredential.updateOne({ _id: existing._id }, { $set: statsUpdate });

      return {
        ok: verificationResult.matched,
        enrolled: true,
        similarity: verificationResult.similarity,
        message: verificationResult.message,
      };
    } catch (err) {
      console.error('[EmbeddingService] Error:', err.message);

      // Distinguish between extraction errors and processing errors
      if (err.message.includes('No face detected')) {
        return {
          ok: false,
          enrolled: false,
          similarity: null,
          message: 'No face detected. Please ensure your face is clearly visible and try again.',
        };
      }

      if (err.message.includes('Multiple faces')) {
        return {
          ok: false,
          enrolled: false,
          similarity: null,
          message: 'Multiple faces detected. Please ensure only your face is in the frame.',
        };
      }

      return {
        ok: false,
        enrolled: false,
        similarity: null,
        message: `Verification failed: ${err.message}`,
      };
    }
  }

  /**
   * Reset an employee's biometric enrollment.
   */
  async resetEnrollment(employeeId) {
    const result = await this.BiometricCredential.deleteMany({ employee_id: employeeId });
    return result.deletedCount > 0;
  }

  /**
   * Get set of enrolled employee IDs for a company.
   * Used for quick lookups on employee lists.
   */
  async getEnrolledEmployeeIds(companyId) {
    const creds = await this.BiometricCredential.find({
      company_id: companyId,
      embedding: { $ne: null, $exists: true },
    })
      .select('employee_id')
      .lean();

    return new Set(creds.map(c => c.employee_id.toString()));
  }
}

module.exports = EmbeddingService;
