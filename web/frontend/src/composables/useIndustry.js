import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { getIndustry } from '../industries'

// Reads the industry off the logged-in user's company record
// (auth.user.school.industry, populated by /api/auth/login and
// /api/auth/me for school_admin users). An explicit companyRef can be
// passed to read from a different record (e.g. a row in a super-admin
// table) instead of the logged-in user's own company.
// Falls back to 'school' — the original, pre-industry behavior — whenever
// no industry value is available yet (data still loading, or a company
// created before this field existed), so labels never render blank.
export function useIndustry(companyRef = null) {
  const auth = useAuthStore()

  const vocab = computed(() => {
    const key = companyRef?.value?.industry || auth.user?.school?.industry || 'school'
    return getIndustry(key)
  })

  return { vocab }
}
