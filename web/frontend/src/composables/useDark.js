import { ref, watchEffect } from 'vue'

// Determine initial theme:
// 1. Use saved user preference from localStorage if present.
// 2. Otherwise fall back to OS / browser system preference.
const savedTheme = localStorage.getItem('esa-theme')
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

const isDark = ref(
  savedTheme ? savedTheme === 'dark' : systemDark.matches
)

// Apply theme class to <html> and persist user-selected preference.
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

// Respond to live OS theme changes, but only when the user has NOT
// saved an explicit preference (i.e., they are still on system default).
systemDark.addEventListener('change', (e) => {
  if (!localStorage.getItem('esa-theme')) {
    isDark.value = e.matches
  }
})

export function useDark() {
  function toggleDark() {
    isDark.value = !isDark.value
  }

  // Allow callers to explicitly reset to system preference (clears saved choice).
  function resetToSystem() {
    localStorage.removeItem('esa-theme')
    isDark.value = systemDark.matches
  }

  return { isDark, toggleDark, resetToSystem }
}
