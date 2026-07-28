// ─────────────────────────────────────────────────────────────────────────
// Client-side image compression, run before any avatar/logo file is
// uploaded. Resizes to a sane max dimension and re-encodes as JPEG at a
// quality that keeps the file small while staying visually indistinguishable
// from the original — a typical ~2MB phone photo comes down to well under
// 100KB, often in the tens-of-KB range depending on content.
//
// SVG and GIF files are passed straight through untouched: SVG is vector
// (canvas re-encoding would rasterize and break it) and GIF may be animated
// (re-encoding would flatten it to a single frame).
// ─────────────────────────────────────────────────────────────────────────

const MAX_DIMENSION = 1024      // px, longest side
const TARGET_BYTES = 200 * 1024 // stop stepping down quality once under this
const MIN_QUALITY = 0.5

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Compress an image file for upload. Returns a new File (same base name,
 * .jpg extension) or the original file unchanged if compression isn't
 * applicable/safe (SVG, GIF, or if compression fails for any reason).
 */
export async function compressImage(file, { maxDimension = MAX_DIMENSION, targetBytes = TARGET_BYTES } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file

  try {
    const img = await loadImage(file)
    let { width, height } = img

    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height / width) * maxDimension)
        width = maxDimension
      } else {
        width = Math.round((width / height) * maxDimension)
        height = maxDimension
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)
    URL.revokeObjectURL(img.src)

    // Step quality down until we're under the target size, without going
    // below a floor that would start showing visible artifacts.
    let quality = 0.9
    let blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    while (blob && blob.size > targetBytes && quality > MIN_QUALITY) {
      quality -= 0.1
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }

    if (!blob) return file
    // Never make things worse — keep the original if compression somehow
    // produced a larger file (rare, e.g. already-tiny source images).
    if (blob.size >= file.size) return file

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Any failure (decode error, canvas taint, unsupported format) falls
    // back to uploading the original file rather than blocking the user.
    return file
  }
}
