/**
 * Face Recognition Engine — Real, working server-side face recognition
 *
 * Replaces the previous insightfaceEngine.js, which depended on an npm
 * package ("insightface") that does not exist on the npm registry and
 * could never actually initialize.
 *
 * This engine uses @vladmandic/face-api running on TensorFlow.js with the
 * WASM backend (pure JS/WASM — no native TensorFlow binary download, no
 * GPU, no Docker), which is what makes it deployable on free hosts like
 * Render. Detection + landmark + recognition model weights (~12MB total,
 * MIT licensed, openly redistributable) are fetched once by
 * scripts/download-face-models.js (runs automatically via "postinstall").
 *
 * Pipeline (unchanged from before): detect face -> extract 128-d embedding
 * -> cosine similarity against the employee's stored embedding.
 *
 * Configuration via environment variables:
 *   FACE_SIMILARITY_THRESHOLD - Verification threshold (default: 0.90)
 *   FACE_RETRY_THRESHOLD - Retry suggestion threshold (default: 0.85)
 *   FACE_TIMEOUT_MS - Per-request face-detection timeout in milliseconds.
 *                     Default: 0 (disabled/unlimited) — detection is allowed
 *                     to take as long as it needs (useful on slow free-tier
 *                     hosts). Set a positive number to re-enable a cap.
 *   FACE_MIN_DETECTION_SCORE - Minimum detector confidence (default: 0.5)
 *
 * NOTE on thresholds: these were recalibrated for face-api's embedding
 * space specifically (its own docs use euclidean distance <= 0.6 as the
 * standard match cutoff). A same-person cosine similarity of ~1.0 and a
 * different-person similarity in the ~0.80-0.90 range are typical, so the
 * 0.95 default carried over from the old InsightFace config would have
 * been too strict for this model — verified against real test images
 * before shipping.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FACE_SIMILARITY_THRESHOLD = parseFloat(process.env.FACE_SIMILARITY_THRESHOLD || '0.90');
const FACE_RETRY_THRESHOLD = parseFloat(process.env.FACE_RETRY_THRESHOLD || '0.85');
const FACE_TIMEOUT_MS = parseInt(process.env.FACE_TIMEOUT_MS || '0', 10);
const FACE_MIN_DETECTION_SCORE = parseFloat(process.env.FACE_MIN_DETECTION_SCORE || '0.5');

const MODEL_DIR = path.join(__dirname, '..', 'models', 'face-api');

let faceapi = null;
let isInitialized = false;
let initPromise = null;

/**
 * Initialize the engine asynchronously. Called once on server startup.
 * Safe to call multiple times — uses caching to avoid redundant loads.
 */
async function initialize() {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const requiredFiles = [
        'ssd_mobilenetv1_model-weights_manifest.json',
        'ssd_mobilenetv1_model.bin',
        'face_landmark_68_model-weights_manifest.json',
        'face_landmark_68_model.bin',
        'face_recognition_model-weights_manifest.json',
        'face_recognition_model.bin',
      ];
      const missing = requiredFiles.filter(f => !fs.existsSync(path.join(MODEL_DIR, f)));
      if (missing.length > 0) {
        throw new Error(
          `Face model files missing: ${missing.join(', ')}. ` +
          `Run "node scripts/download-face-models.js" to fetch them.`
        );
      }

      console.log('[FaceRecognitionEngine] Loading face-api (node-wasm build)...');
      // eslint-disable-next-line global-require
      faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
      // eslint-disable-next-line global-require
      const { Canvas, Image, ImageData } = require('canvas');
      faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

      await faceapi.tf.setBackend('wasm');
      await faceapi.tf.ready();

      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);

      isInitialized = true;
      console.log('[FaceRecognitionEngine] ✅ Initialized successfully (backend:', faceapi.tf.getBackend(), ')');
      return true;
    } catch (err) {
      console.error('[FaceRecognitionEngine] Initialization failed:', err.message);
      isInitialized = false;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Decode an image buffer into a canvas face-api can run detection on.
 */
async function bufferToCanvas(imageBuffer) {
  // eslint-disable-next-line global-require
  const { createCanvas, loadImage } = require('canvas');
  const img = await loadImage(imageBuffer);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}

/**
 * Extract face embedding from an image buffer.
 *
 * @param {Buffer} imageBuffer - Image data (JPEG/PNG)
 * @returns {Promise<{embedding: Float32Array, confidence: number}>}
 * @throws {Error} If image invalid, face detection fails, or no/multiple faces
 */
async function extractEmbedding(imageBuffer) {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Image buffer is empty');
  }

  // Model loading (TF.js WASM backend + ~12MB of weights) is a one-time,
  // potentially slow step — especially right after a deploy/restart on a
  // free-tier host. It must fully finish before any detection can run, but
  // it has nothing to do with how long any single face-detection request
  // should be allowed to take, so it is intentionally NOT wrapped in the
  // timeout below. Previously it was raced against the same short clock as
  // the actual detection work, which caused enrollment/verification to fail
  // with a generic "failed, please try again" whenever the very first
  // request after startup arrived before the models had finished loading.
  if (!isInitialized) {
    await initialize();
  }

  const timeoutPromise = FACE_TIMEOUT_MS > 0
    ? new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Face embedding extraction timeout')), FACE_TIMEOUT_MS)
      )
    : null;

  const extractPromise = (async () => {
    const canvas = await bufferToCanvas(imageBuffer);

    // detectAllFaces so we can distinguish "no face" from "multiple faces"
    // (detectSingleFace silently picks the best one either way).
    const results = await faceapi
      .detectAllFaces(canvas)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!results || results.length === 0) {
      throw new Error('No face detected in the image. Please ensure your face is clearly visible.');
    }

    if (results.length > 1) {
      throw new Error('Multiple faces detected. Please ensure only your face is in the frame.');
    }

    const face = results[0];
    const confidence = face.detection.score;

    if (confidence < FACE_MIN_DETECTION_SCORE) {
      throw new Error('Face detection confidence too low. Please try again in better lighting.');
    }

    if (!face.descriptor || face.descriptor.length === 0) {
      throw new Error('Could not extract face features. Please try again.');
    }

    return { embedding: face.descriptor, confidence };
  })();

  try {
    return await (timeoutPromise ? Promise.race([extractPromise, timeoutPromise]) : extractPromise);
  } catch (err) {
    console.error('[FaceRecognitionEngine] Embedding extraction error:', err.message);
    throw err;
  }
}

/**
 * Compare two face embeddings using cosine similarity.
 * Returns similarity score in range [-1, 1] where 1.0 = identical.
 *
 * @param {Float32Array|number[]} embedding1
 * @param {Float32Array|number[]} embedding2
 * @returns {number} Cosine similarity score
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
 *   >= FACE_SIMILARITY_THRESHOLD (0.90) : match accepted
 *   >= FACE_RETRY_THRESHOLD (0.85)      : match weak, suggest retry
 *   < 0.85                               : match rejected
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
    console.error('[FaceRecognitionEngine] Verification error:', err.message);
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
