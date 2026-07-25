// Tracks the screen position of the most recently clicked button/element,
// so modals can animate open/closed "from" that point — the same genie-like
// effect macOS uses when minimizing/restoring windows to/from the Dock.
//
// A single capture-phase listener on `document` records the center point of
// whatever <button> (or clickable element) was clicked, right before Vue's
// own click handlers run and (usually synchronously) flip a `v-model` that
// opens a modal. AppModal then reads this shared origin to set its
// transform-origin for the open/close transition — no changes needed in the
// many files that already call AppModal with `@click="openCreate"` etc.

import { reactive } from 'vue'

const origin = reactive({ x: null, y: null })

function isClickable(el) {
  if (!el) return false
  return !!el.closest('button, [role="button"], a, .icon-btn, .btn')
}

function recordOrigin(e) {
  const target = isClickable(e.target) ? e.target.closest('button, [role="button"], a, .icon-btn, .btn') : null
  if (!target) return
  const rect = target.getBoundingClientRect()
  origin.x = rect.left + rect.width / 2
  origin.y = rect.top + rect.height / 2
}

let installed = false
export function installGenieOriginTracking() {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('click', recordOrigin, true)
}

export function useGenieOrigin() {
  installGenieOriginTracking()
  return origin
}
