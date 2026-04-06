import { inject } from 'vue'

export function useToast() {
  const toast = inject('toast', {
    success: () => {},
    error:   () => {},
    info:    () => {},
    warning: () => {},
  })

  // Universal dispatcher — accepts both:
  //   showToast({ type: 'success', message: 'Done' })
  //   showToast('Done', 'success')
  function showToast(msgOrObj, type, title) {
    try {
      if (msgOrObj && typeof msgOrObj === 'object') {
        const t   = msgOrObj.type || 'info'
        const msg = msgOrObj.message || msgOrObj.msg || ''
        const fn  = toast[t] || toast.info || (() => {})
        fn(msg, title || msgOrObj.title)
      } else {
        const fn = toast[type || 'info'] || toast.info || (() => {})
        fn(msgOrObj || '', title)
      }
    } catch (_) { /* never let toast errors break calling code */ }
  }

  return {
    ...toast,
    showToast,
  }
}
