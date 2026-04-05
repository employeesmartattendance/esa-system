import { ref, watchEffect } from 'vue'

const isDark = ref(localStorage.getItem('esa-theme') === 'dark')

watchEffect(() => {
  const root = document.documentElement
  if (isDark.value) {
    root.classList.add('dark')
    localStorage.setItem('esa-theme', 'dark')
  } else {
    root.classList.remove('dark')
    localStorage.setItem('esa-theme', 'light')
  }
})

export function useDark() {
  function toggleDark() { isDark.value = !isDark.value }
  return { isDark, toggleDark }
}
