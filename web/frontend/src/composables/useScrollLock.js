import { watch } from 'vue'

// Shared lock counter — several modals/panels can theoretically be open
// at once (e.g. sidebar + a CRUD modal on mobile), so we only unlock
// scrolling once every consumer has released its lock.
let lockCount = 0

function lockScroll() {
  lockCount++
  if (lockCount === 1) {
    // The dashboard's real scroll container is `.layout-content` (see
    // DashboardLayout.vue), not <body> — the app now scrolls inside that
    // element rather than at the document level. Lock scrolling there;
    // also guard <body> so this works the same way on the /website page
    // and any other place a modal might be teleported over.
    const contentEl = document.querySelector('.layout-content')
    if (contentEl) contentEl.classList.add('scroll-locked')
    document.body.classList.add('scroll-locked-body')
  }
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    const contentEl = document.querySelector('.layout-content')
    if (contentEl) contentEl.classList.remove('scroll-locked')
    document.body.classList.remove('scroll-locked-body')
  }
}

/**
 * Locks background scroll while `isOpenRef` is true. Safe to use in
 * multiple components simultaneously (sidebar, CRUD modals, notification
 * panel, profile panel) — scrolling is only restored once nothing is open.
 */
export function useScrollLock(isOpenRef) {
  watch(isOpenRef, (open) => {
    if (open) lockScroll()
    else unlockScroll()
  }, { immediate: true })
}
