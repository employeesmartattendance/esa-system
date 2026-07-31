/**
 * InsightFace Engine Service — Server-side face recognition
 *
 * Provides enterprise-grade face embedding extraction and similarity matching
 * using InsightFace. All AI processing happens server-side; no models or
 * recognition logic reaches the client.
 *
 * Configuration via environment variables:
 *   INSIGHTFACE_MODEL - Model name (default: "buffalo_l")
 *   FACE_SIMILARITY_THRESHOLD - Verification threshold (default: 0.95)
 *   FACE_RETRY_THRESHOLD - Retry suggestion threshold (default: 0.90)
 *   FACE_TIMEOUT_MS - Processing timeout in milliseconds (default: 15000)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Configuration from environment
const MODEL_NAME = process.env.INSIGHTFACE_MODEL || 'buffalo_l';
const FACE_SIMILARITY_THRESHOLD = parseFloat(process.env.FACE_SIMILARITY_THRESHOLD || '0.95');
const FACE_RETRY_THRESHOLD = parseFloat(process.env.FACE_RETRY_THRESHOLD || '0.90');
const FACE_TIMEOUT_MS = parseInt(process.env.FACE_TIMEOUT_MS || '15000', 10);

let insightface = null;
let isInitialized = false;
let initPromise = null;

/**
 * Initialize InsightFace asynchronously. Called once on server startup.
 * Safe to call multiple times — uses caching to avoid redundant loads.
 */
async function initialize() {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[InsightFaceEngine] Initializing with model:', MODEL_NAME);
      const InsightFace = require('insightface').default;
      insightface = new InsightFace({
        modelName: MODEL_NAME,
        modelPath: path.join(__dirname, '../models/insightface'),
      });

      await insightface.prepare();
      isInitialized = true;
      console.log('[InsightFaceEngine] ✅ Initialized successfully');
      return true;
    } catch (err) {
      console.error('[InsightFaceEngine] Initialization failed:', err.message);
      isInitialized = false;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Extract face embedding from an image buffer.
 *
 * Process:
 *   1. Validate image buffer
 *   2. Detect faces (reject if none or multiple)
 *   3. Extract embedding
 *   4. Return normalized embedding vector
 *
 * @param {Buffer} imageBuffer - Image data (JPEG/PNG)
 * @returns {Promise<{embedding: Float32Array, confidence: number}>}
 * @throws {Error} If image invalid, face detection fails, or no/multiple faces
 */
async function extractEmbedding(imageBuffer) {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Image buffer is empty');
  }

  if (!isInitialized) {
    await initialize();
  }

  try {
    // Set timeout for embedding extraction
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Face embedding extraction timeout')), FACE_TIMEOUT_MS)
    );

    const extractPromise = (async () => {
      // Detect faces in the image
      const faces = await insightface.detectFaces(imageBuffer);

      if (!faces || faces.length === 0) {
        throw new Error('No face detected in the image. Please ensure your face is clearly visible.');
      }

      if (faces.length > 1) {
        throw new Error('Multiple faces detected. Please ensure only your face is in the frame.');
      }

      const face = faces[0];

      // Validate face detection confidence
      if (face.confidence < 0.5) {
        throw new Error('Face detection confidence too low. Please try again in better lighting.');
      }

      // Extract embedding for the detected face
      const embedding = await insightface.extractEmbedding(face, imageBuffer);

      if (!embedding || embedding.length === 0) {
        throw new Error('Could not extract face features. Please try again.');
      }

      return {
        embedding: embedding,
        confidence: face.confidence,
      };
    })();

    return await Promise.race([extractPromise, timeoutPromise]);
  } catch (err) {
    console.error('[InsightFaceEngine] Embedding extraction error:', err.message);
    throw err;
  }
}

/**
 * Compare two face embeddings using cosine similarity.
 * Returns similarity score in range [0, 1] where 1.0 = identical.
 *
 * @param {Float32Array} embedding1 - First embedding vector
 * @param {Float32Array} embedding2 - Second embedding vector
 * @returns {number} Cosine similarity score [0, 1]
 */
function cosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    throw new Error('Invalid embeddings for comparison');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Verify a face against a stored embedding.
 * Returns { matched: boolean, similarity: number, message: string }
 *
 * Thresholds:
 *   >= FACE_SIMILARITY_THRESHOLD (0.95) : match accepted
 *   >= FACE_RETRY_THRESHOLD (0.90)     : match weak, suggest retry
 *   < 0.90                              : match rejected
 *
 * @param {Buffer} imageBuffer - New image to verify
 * @param {Float32Array} storedEmbedding - Stored reference embedding
 * @returns {Promise<{matched: boolean, similarity: number, message: string}>}
 */
async function verifyFace(imageBuffer, storedEmbedding) {
  try {
    const { embedding: newEmbedding } = await extractEmbedding(imageBuffer);
    const similarity = cosineSimilarity(newEmbedding, storedEmbedding);

    if (similarity >= FACE_SIMILARITY_THRESHOLD) {
      return {
        matched: true,
        similarity,
        message: 'Face verified successfully.',
      };
    }

    if (similarity >= FACE_RETRY_THRESHOLD) {
      return {
        matched: false,
        similarity,
        message: `Face similarity is ${Math.round(similarity * 100)}% — below the required ${Math.round(FACE_SIMILARITY_THRESHOLD * 100)}% threshold. Please try again in better lighting.`,
      };
    }

    return {
      matched: false,
      similarity,
      message: `Face did not match (${Math.round(similarity * 100)}% similarity). Please face the camera directly and try again.`,
    };
  } catch (err) {
    console.error('[InsightFaceEngine] Verification error:', err.message);
    return {
      matched: false,
      similarity: 0,
      message: `Verification failed: ${err.message}`,
    };
  }
}

module.exports = {
  initialize,
  extractEmbedding,
  cosineSimilarity,
  verifyFace,
  isInitialized: () => isInitialized,
  FACE_SIMILARITY_THRESHOLD,
  FACE_RETRY_THRESHOLD,
};
