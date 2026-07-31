/**
 * CompreFace REST API Service
 *
 * Handles all communication with a self-hosted CompreFace instance (Docker).
 * CompreFace provides face detection, recognition (verification/identification),
 * and subject management via a clean REST API.
 *
 * Configuration is read entirely from environment variables — no hardcoded
 * credentials or URLs. If COMPRE_FACE_URL is not set, all methods return
 * safe error objects so the rest of the system degrades gracefully.
 *
 * CompreFace API docs: https://github.com/exadel-inc/CompreFace
 */

'use strict';

const COMPRE_FACE_URL       = (process.env.COMPRE_FACE_URL || '').replace(/\/+$/, '');
const COMPRE_FACE_API_KEY   = process.env.COMPRE_FACE_API_KEY || '';
const COMPRE_FACE_SERVICE_KEY = process.env.COMPRE_FACE_SERVICE_KEY || '';
const COMPRE_FACE_THRESHOLD = parseFloat(process.env.COMPRE_FACE_THRESHOLD || '0.90');

const isConfigured = !!(COMPRE_FACE_URL && COMPRE_FACE_API_KEY && COMPRE_FACE_SERVICE_KEY);

/** Build headers for CompreFace REST API calls */
function headers() {
  return {
    'x-api-key': COMPRE_FACE_API_KEY,
  };
}

/**
 * Upload an image buffer to CompreFace for face detection.
 * Returns CompreFace detection result array.
 */
async function detectFaces(imageBuffer) {
  if (!isConfigured) throw new Error('CompreFace is not configured. Set COMPRE_FACE_URL, COMPRE_FACE_API_KEY, and COMPRE_FACE_SERVICE_KEY.');

  const res = await fetch(`${COMPRE_FACE_URL}/api/v1/recognition/recognize`, {
    method: 'POST',
    headers: headers(),
    body: buildFormData(imageBuffer),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`CompreFace detection failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Recognize faces in an image against the CompreFace service.
 * Uses the /recognize endpoint which both detects and identifies.
 * Returns the full CompreFace response.
 */
async function recognize(imageBuffer) {
  if (!isConfigured) throw new Error('CompreFace is not configured. Set COMPRE_FACE_URL, COMPRE_FACE_API_KEY, and COMPRE_FACE_SERVICE_KEY.');

  const url = new URL(`${COMPRE_FACE_URL}/api/v1/recognition/recognize`);
  url.searchParams.set('limit', '1');
  url.searchParams.set('det_prob_threshold', '0.5');
  url.searchParams.set('prediction_count', '1');
  // Only match against a specific subject if provided
  // (used during verification to narrow search)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: headers(),
    body: buildFormData(imageBuffer),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`ComPreFace recognition failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Add a face image to a CompreFace subject.
 * Creates the subject if it does not exist.
 * Returns the CompreFace response.
 */
async function enroll(subjectId, imageBuffer) {
  if (!isConfigured) throw new Error('CompreFace is not configured. Set COMPRE_FACE_URL, COMPRE_FACE_API_KEY, and COMPRE_FACE_SERVICE_KEY.');

  // Step 1: Ensure subject exists (create is idempotent in CompreFace)
  await ensureSubject(subjectId);

  // Step 2: Add the face image to the subject
  const res = await fetch(`${COMPRE_FACE_URL}/api/v1/recognition/subjects/${encodeURIComponent(subjectId)}`, {
    method: 'POST',
    headers: headers(),
    body: buildFormData(imageBuffer),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`CompreFace enrollment failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Delete all faces for a subject from CompreFace.
 */
async function deleteSubject(subjectId) {
  if (!isConfigured) {
    console.warn('[CompreFace] Not configured — skipping subject deletion');
    return;
  }

  try {
    const res = await fetch(`${COMPRE_FACE_URL}/api/v1/recognition/subjects/${encodeURIComponent(subjectId)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    // 200 = deleted, 404 = already gone — both fine
    if (res.status !== 200 && res.status !== 202 && res.status !== 404) {
      console.warn(`[CompreFace] Subject deletion returned ${res.status}`);
    }
  } catch (err) {
    console.warn('[CompreFace] Subject deletion error:', err.message);
  }
}

/**
 * Check the similarity result from a CompreFace recognize response.
 * Returns { matched: boolean, similarity: number, subject: string|null, message: string }
 *
 * Thresholds (configurable via COMPRE_FACE_THRESHOLD, default 0.90):
 *   >= threshold : immediate success
 *   >= 0.90      : ask to retry (if threshold < 0.95)
 *   < 0.90      : reject
 */
function evaluateResult(recognizeResponse, expectedSubjectId = null) {
  if (!recognizeResponse?.result?.length) {
    return { matched: false, similarity: 0, subject: null, message: 'No face detected in the image. Please ensure your face is clearly visible and try again.' };
  }

  // CompreFace can return multiple face detections; use the largest (most prominent)
  const faces = recognizeResponse.result
    .filter(f => f?.box?.probability > 0.5)
    .sort((a, b) => {
      const aSize = (a.box?.x_max - a.box?.x_min) * (a.box?.y_max - a.box?.y_min);
      const bSize = (b.box?.x_max - b.box?.x_min) * (b.box?.y_max - b.box?.y_min);
      return bSize - aSize;
    });

  if (faces.length === 0) {
    return { matched: false, similarity: 0, subject: null, message: 'No face detected with sufficient confidence. Please face the camera directly in good lighting.' };
  }

  if (faces.length > 1) {
    return { matched: false, similarity: 0, subject: null, message: 'Multiple faces detected. Please ensure only your face is in the frame.' };
  }

  const face = faces[0];
  const predictions = face?.predictions || [];

  if (predictions.length === 0) {
    return { matched: false, similarity: 0, subject: null, message: 'Face detected but not recognized. If this is your first time, enrollment will happen automatically.' };
  }

  const topPrediction = predictions[0];
  const similarity = topPrediction.similarity ?? 0;
  const subject = topPrediction.subject ?? null;

  // If we expected a specific subject, verify it matches
  if (expectedSubjectId && subject !== expectedSubjectId) {
    return { matched: false, similarity, subject, message: 'Face recognized but does not match the enrolled identity. Please try again.' };
  }

  if (similarity >= COMPRE_FACE_THRESHOLD) {
    return { matched: true, similarity, subject, message: 'Face verified successfully.' };
  }

  if (similarity >= 0.90) {
    return { matched: false, similarity, subject, message: `Face similarity is ${Math.round(similarity * 100)}% — below the required ${Math.round(COMPRE_FACE_THRESHOLD * 100)}% threshold. Please try again in better lighting.` };
  }

  return { matched: false, similarity, subject, message: `Face did not match (${Math.round(similarity * 100)}% similarity). Please face the camera directly and try again.` };
}

// ── Internal helpers ──

/**
 * Ensure a CompreFace subject exists. CompreFace's POST /subjects/{id}
 * creates the subject or returns 200 if it already exists.
 */
async function ensureSubject(subjectId) {
  try {
    const res = await fetch(`${COMPRE_FACE_URL}/api/v1/recognition/subjects/${encodeURIComponent(subjectId)}`, {
      method: 'POST',
      headers: headers(),
    });
    if (res.status !== 200 && res.status !== 201 && res.status !== 409) {
      const text = await res.text().catch(() => 'unknown');
      throw new Error(`Failed to ensure subject ${subjectId} (${res.status}): ${text}`);
    }
  } catch (err) {
    if (err.message.includes('CompreFace')) throw err;
    throw new Error(`CompreFace subject creation failed: ${err.message}`);
  }
}

/**
 * Build multipart/form-data body with an image buffer.
 * CompreFace expects the file field named 'file'.
 */
function buildFormData(imageBuffer, fieldName = 'file') {
  const boundary = '----ESACompreFace' + Date.now();
  const parts = [];

  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="capture.jpg"\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`
  );

  const end = `\r\n--${boundary}--\r\n`;

  // Combine into a single Buffer
  const headerBuffer = Buffer.from(parts.join(''), 'utf8');
  const endBuffer = Buffer.from(end, 'utf8');
  const imageBuf = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);

  const fullBody = Buffer.concat([headerBuffer, imageBuf, endBuffer]);

  return new Blob([fullBody], {
    type: `multipart/form-data; boundary=${boundary}`,
  });
}

module.exports = {
  isConfigured,
  detectFaces,
  recognize,
  enroll,
  deleteSubject,
  evaluateResult,
  COMPRE_FACE_THRESHOLD,
};
