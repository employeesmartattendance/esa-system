// ── Cloudinary Upload Storage ──────────────────────────────────────────────
// Render's free/starter web services spin down after inactivity and wipe
// their local disk on the next boot, so anything saved to ./uploads
// (avatars, company logos, trusted-client badges) disappears. This module
// swaps local disk storage for Cloudinary, which keeps uploaded images
// permanently and serves them from a CDN.
//
// Configure by setting these three environment variables (see .env.example):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//
// If they are not set, every function below transparently falls back to the
// existing local-disk multer storage — so the app keeps working exactly as
// before until you add Cloudinary credentials. No other file needs to know
// which mode is active: uploaded files always end up with a `.path` (or the
// route reads `.secure_url` when Cloudinary is active) that resolves to a
// permanent, publicly-servable URL.

const multer = require('multer');
const path = require('path');

const CLOUDINARY_ENABLED = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let cloudinary = null;
if (CLOUDINARY_ENABLED) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[Cloudinary] Enabled — uploaded images will be stored permanently on Cloudinary.');
} else {
  console.warn('[Cloudinary] Not configured — falling back to local disk storage. ' +
    'Uploaded images will be LOST whenever the server restarts or spins down. ' +
    'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to fix this permanently.');
}

/**
 * Uploads a buffer to Cloudinary inside the given folder and returns the
 * Cloudinary result (which includes `secure_url` and `public_id`).
 */
function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `esa/${folder}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

/**
 * Deletes a previously-uploaded Cloudinary asset by its full secure URL
 * (best-effort — errors are swallowed since this only runs as cleanup when
 * replacing an old avatar/logo, same as the old local-disk fs.unlink calls).
 */
async function deleteFromCloudinaryByUrl(url) {
  if (!CLOUDINARY_ENABLED || !cloudinary || !url) return;
  try {
    const marker = '/esa/';
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    let publicId = url.slice(idx + 1); // "esa/<folder>/<name>.ext"
    publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, ''); // strip extension
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn('[Cloudinary] Cleanup delete failed (non-fatal):', err.message);
  }
}

/**
 * Returns a multer instance for the given upload folder ('avatars',
 * 'school-logos', 'trusted-logos'). When Cloudinary is configured, files
 * are buffered in memory (multer.memoryStorage) so the route handler can
 * stream them to Cloudinary; otherwise falls back to the original disk
 * storage under UPLOADS_DIR/<folder>.
 */
function makeUploader({ folder, uploadsDir, limits, fileFilter }) {
  if (CLOUDINARY_ENABLED) {
    return multer({ storage: multer.memoryStorage(), limits, fileFilter });
  }
  const diskStorage = multer.diskStorage({
    destination: (r, f, cb) => cb(null, path.join(uploadsDir, folder)),
    filename: (r, f, cb) => cb(null, `${folder.split('-')[0]}-${Date.now()}${path.extname(f.originalname)}`),
  });
  return multer({ storage: diskStorage, limits, fileFilter });
}

/**
 * After multer has run (req.file populated), resolves the final public URL
 * for the uploaded file — uploading the buffer to Cloudinary if enabled, or
 * returning the local `/uploads/...` relative path otherwise (unchanged
 * behavior from before).
 */
async function resolveUploadedFileUrl(req, folder) {
  if (!req.file) return null;
  if (CLOUDINARY_ENABLED) {
    const result = await uploadBufferToCloudinary(req.file.buffer, folder);
    return result.secure_url;
  }
  return `/uploads/${folder}/${req.file.filename}`;
}

module.exports = {
  CLOUDINARY_ENABLED,
  makeUploader,
  resolveUploadedFileUrl,
  deleteFromCloudinaryByUrl,
};
