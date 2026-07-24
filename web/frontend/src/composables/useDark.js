import { ref, watchEffect } from 'vue'

// Determine initial theme:
// 1. Use saved user preference from localStorage if present.
// 2. Otherwise default to light mode (do NOT follow OS/system preference)
//    until the user explicitly chooses a theme.
const savedTheme = localStorage.getItem('esa-theme')
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

const isDark = ref(
  savedTheme ? savedTheme === 'dark' : false
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

export function useDark() {
  function toggleDark() {
    isDark.value = !isDark.value
  }

  // Allow callers to explicitly reset to the default (light) theme, clearing saved choice.
  function resetToSystem() {
    localStorage.removeItem('esa-theme')
    isDark.value = false
  }

  return { isDark, toggleDark, resetToSystem }
}
