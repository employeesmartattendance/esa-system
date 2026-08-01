// download-face-models.js
//
// Downloads the face detection / landmark / recognition model weights used
// by the server-side biometric engine (services/faceRecognitionEngine.js).
//
// Models come from the vladmandic/face-api GitHub repo (MIT licensed,
// openly redistributable — no API key or account needed). Total size is
// ~12MB. This runs automatically via the backend's "postinstall" npm
// script, so a fresh `npm install` (e.g. on Render) always has the models
// in place before the server starts.
//
// Safe to re-run: existing files are skipped unless FORCE=1 is set.
//
// Usage: node scripts/download-face-models.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_DIR = path.join(__dirname, '..', 'models', 'face-api');
const BASE_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];

function download(url, destPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        return resolve(download(res.headers.location, destPath, redirects + 1));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });

  const force = process.env.FORCE === '1';
  let downloaded = 0;
  let skipped = 0;

  for (const name of FILES) {
    const dest = path.join(MODEL_DIR, name);
    if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skipped++;
      continue;
    }
    try {
      console.log(`[face-models] Downloading ${name}...`);
      await download(`${BASE_URL}/${name}`, dest);
      const size = fs.statSync(dest).size;
      if (size === 0) throw new Error('Downloaded file is empty');
      console.log(`[face-models] ✅ ${name} (${(size / 1024).toFixed(0)} KB)`);
      downloaded++;
    } catch (err) {
      console.error(`[face-models] ❌ Failed to download ${name}:`, err.message);
      console.error('[face-models] The server will still start, but biometric verification will not work until this is resolved.');
      console.error('[face-models] Re-run manually with: node scripts/download-face-models.js');
      // Don't crash the whole install/deploy over a model download hiccup —
      // let it be retried, and let the engine report a clear error if used
      // before models are present.
      process.exitCode = 0;
    }
  }

  console.log(`[face-models] Done. Downloaded ${downloaded}, already present ${skipped}, total ${FILES.length}.`);
}

main();
