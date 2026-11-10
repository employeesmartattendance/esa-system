import { ref, watch, onBeforeUnmount } from 'vue'

/** Show a loading indicator only when a request outlasts the cache lookup window. */
export function useDelayedLoading(source, delay = 180) {
  const visible = ref(false)
  let timer = null
  watch(source, loading => {
    if (timer) clearTimeout(timer)
    timer = null
    visible.value = false
    if (loading) timer = window.setTimeout(() => { visible.value = true }, Math.max(0, delay))
  }, { immediate: true })
  onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
  return visible
}
