import { ref, onBeforeUnmount } from 'vue'

/** Small, handle-only swipe-to-dismiss controller for custom mobile sheets. */
export function useMobileSheetDrag(onDismiss, canDismiss = () => true) {
  const sheetRef = ref(null)
  const state = { active: false, startY: 0, lastY: 0, startedAt: 0, offset: 0 }
  let closeTimer = null
  let resetTimer = null

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!canDismiss()) return
    const sheet = sheetRef.value
    if (!sheet) return
    state.active = true
    state.startY = event.clientY
    state.lastY = event.clientY
    state.startedAt = performance.now()
    state.offset = 0
    sheet.style.transition = 'none'
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    if (!state.active) return
    const offset = Math.max(0, event.clientY - state.startY)
    state.lastY = event.clientY
    state.offset = offset
    if (sheetRef.value) sheetRef.value.style.transform = `translate3d(0, ${offset}px, 0)`
  }

  function onPointerCancel() {
    if (!state.active) return
    state.active = false
    state.offset = 0
    const sheet = sheetRef.value
    if (sheet) {
      sheet.style.transition = 'transform .18s ease-out'
      sheet.style.transform = 'translate3d(0, 0, 0)'
    }
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = window.setTimeout(() => {
      if (sheetRef.value) {
        sheetRef.value.style.transform = ''
        sheetRef.value.style.transition = ''
      }
    }, 190)
  }

  function onPointerUp() {
    if (!state.active) return
    state.active = false
    const elapsed = Math.max(1, performance.now() - state.startedAt)
    const velocity = (state.lastY - state.startY) / elapsed
    const shouldClose = canDismiss() && (state.offset > 112 || (state.offset > 34 && velocity > 0.65))
    const sheet = sheetRef.value
    if (sheet) {
      sheet.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'
      sheet.style.transform = shouldClose ? 'translate3d(0, 110%, 0)' : 'translate3d(0, 0, 0)'
    }
    if (closeTimer) clearTimeout(closeTimer)
    if (resetTimer) clearTimeout(resetTimer)
    if (shouldClose) closeTimer = window.setTimeout(() => onDismiss(), 220)
    else resetTimer = window.setTimeout(() => {
      if (sheetRef.value) {
        sheetRef.value.style.transform = ''
        sheetRef.value.style.transition = ''
      }
    }, 230)
    state.offset = 0
  }

  onBeforeUnmount(() => { if (closeTimer) clearTimeout(closeTimer); if (resetTimer) clearTimeout(resetTimer) })
  return { sheetRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
