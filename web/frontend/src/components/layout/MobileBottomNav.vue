<template>
  <Teleport to="body">
    <nav
      v-if="mobileItems.length"
      class="esa-mobile-bottom-nav"
      :class="{ 'is-hidden': sidebarOpen }"
      :style="navStyle"
      aria-label="Mobile primary navigation"
    >
      <div class="esa-mobile-nav-indicator" aria-hidden="true"><span /></div>

      <div class="esa-mobile-nav-items">
        <template v-for="(item, index) in mobileItems" :key="item.to || 'more'">
          <RouterLink
            v-if="!item.isMore"
            :to="item.to"
            class="esa-mobile-nav-item"
            :class="{ 'is-active': isItemActive(item), 'is-primary-action': index === 2 }"
            :aria-current="isItemActive(item) ? 'page' : undefined"
            :title="item.label"
            :aria-label="item.label"
          >
            <span class="esa-mobile-nav-icon">
              <AppIcon :name="item.icon || 'info'" :size="20" />
            </span>
            <span class="esa-mobile-nav-label">{{ item.label }}</span>
          </RouterLink>

          <button
            v-else
            type="button"
            class="esa-mobile-nav-item esa-mobile-nav-more"
            :class="{ 'is-active': isMoreActive }"
            :aria-expanded="sidebarOpen ? 'true' : 'false'"
            :aria-label="isMoreActive ? `More: ${item.label}` : 'Open navigation menu'"
            :title="item.label"
            @click="emit('open-sidebar')"
          >
            <span class="esa-mobile-nav-icon">
              <AppIcon :name="item.icon || 'menu'" :size="20" />
            </span>
            <span class="esa-mobile-nav-label">{{ item.label }}</span>
          </button>
        </template>
      </div>
    </nav>
  </Teleport>
</template>
    </div>
    </nav>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({
  navSections: { type: Array, default: () => [] },
  sidebarOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['open-sidebar'])
const route = useRoute()
const auth = useAuthStore()

// The shortcuts are drawn from the same role-aware links used by the sidebar.
// This keeps route names, permissions, industry labels, and destinations in
// one source of truth while giving each role a predictable five-slot layout.
const preferredRoutes = {
  super_admin: ['/super/dashboard', '/super/companies', '/super/logs', '/super/settings'],
  school_admin: ['/school/dashboard', '/school/teachers', '/school/attendance', '/school/reports'],
  teacher: ['/teacher/dashboard', '/teacher/map', '/teacher/history', '/teacher/profile'],
}

const allItems = computed(() => props.navSections.flatMap(section =>
  Array.isArray(section.items) ? section.items : []
))

const quickItems = computed(() => {
  const preferred = preferredRoutes[auth.user?.role] || []
  const selected = preferred
    .map(path => allItems.value.find(item => item.to === path))
    .filter(Boolean)

  // Preserve a usable bar if a role's navigation is extended or customized.
  for (const item of allItems.value) {
    if (selected.length >= 4) break
    if (!selected.some(existing => existing.to === item.to)) selected.push(item)
  }

  return selected.slice(0, 4)
})

function routeMatches(path) {
  return !!path && (route.path === path || route.path.startsWith(`${path}/`))
}

const currentSidebarItem = computed(() =>
  allItems.value.find(item => routeMatches(item.to)) || null
)

const isMoreActive = computed(() =>
  !quickItems.value.some(item => routeMatches(item.to))
)

const mobileItems = computed(() => {
  const moreItem = isMoreActive.value && currentSidebarItem.value
    ? currentSidebarItem.value
    : { label: 'More', icon: 'menu' }

  return [...quickItems.value, { ...moreItem, isMore: true }]
})

const activeIndex = computed(() => {
  const index = quickItems.value.findIndex(item => routeMatches(item.to))
  return index < 0 ? mobileItems.value.length - 1 : index
})

const navStyle = computed(() => ({
  '--esa-mobile-nav-count': String(mobileItems.value.length),
  '--esa-mobile-nav-index': String(activeIndex.value),
}))

function isItemActive(item) {
  return routeMatches(item.to)
}
</script>

<style scoped>
.esa-mobile-bottom-nav { display: none; }

@media (max-width: 768px) {
  .esa-mobile-bottom-nav {
    display: block;
    --esa-mobile-nav-count: 5;
    --esa-mobile-nav-index: 0;
    position: fixed;
    z-index: 80;
    left: max(9px, env(safe-area-inset-left));
    right: max(9px, env(safe-area-inset-right));
    bottom: max(8px, env(safe-area-inset-bottom));
    height: 76px;
    color: var(--text);
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    isolation: isolate;
    transition: transform .38s cubic-bezier(.22, 1.18, .36, 1), opacity .25s ease;
  }

  .esa-mobile-bottom-nav::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 15px 0 0;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: 27px;
    box-shadow: 0 12px 30px rgba(11, 18, 32, .16), 0 2px 8px rgba(11, 18, 32, .07);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  :global(.dark) .esa-mobile-bottom-nav::before {
    box-shadow: 0 14px 34px rgba(0, 0, 0, .44), 0 2px 8px rgba(0, 0, 0, .25);
  }

  .esa-mobile-nav-indicator {
    position: absolute;
    z-index: 1;
    top: -13px;
    left: calc((100% / var(--esa-mobile-nav-count)) * (var(--esa-mobile-nav-index) + .5));
    width: 54px;
    height: 54px;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    border: 3px solid var(--primary);
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 5px 13px rgba(11, 18, 32, .15), 0 1px 2px rgba(11, 18, 32, .12);
    pointer-events: none;
    transition: left .42s cubic-bezier(.22, 1.18, .36, 1), box-shadow .2s ease;
  }

  .esa-mobile-nav-indicator span {
    position: absolute;
    inset: 8px;
    border: 2px solid rgba(37, 99, 235, .16);
    border-radius: 50%;
    background: rgba(37, 99, 235, .055);
  }

  :global(.dark) .esa-mobile-nav-indicator span {
    border-color: rgba(96, 165, 250, .24);
    background: rgba(37, 99, 235, .16);
  }

  .esa-mobile-nav-items {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(var(--esa-mobile-nav-count), minmax(0, 1fr));
  }

  .esa-mobile-nav-item {
    position: relative;
    z-index: 2;
    min-width: 0;
    width: 100%;
    height: 100%;
    padding: 30px 2px 5px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    color: var(--text-muted);
    background: transparent;
    border: 0;
    border-radius: 0;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;
  }

  .esa-mobile-nav-item:hover,
  .esa-mobile-nav-item:focus { color: var(--text); text-decoration: none; }

  .esa-mobile-nav-icon {
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    display: grid;
    place-items: center;
    transform: translateY(0) scale(1);
    transition: transform .36s cubic-bezier(.22, 1.18, .36, 1), color .2s ease, background .24s ease, box-shadow .24s ease, border-color .24s ease;
  }

  .esa-mobile-nav-icon :deep(svg) { width: 20px; height: 20px; stroke-width: 1.75; }

  .esa-mobile-nav-label {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: clamp(8px, 2.55vw, 10px);
    line-height: 1.1;
    font-weight: 600;
    letter-spacing: -.015em;
    transition: color .2s ease, transform .34s cubic-bezier(.22, 1.18, .36, 1);
  }

  .esa-mobile-nav-item.is-active { color: var(--primary); }
  .esa-mobile-nav-item.is-active .esa-mobile-nav-icon { transform: translateY(-24px) scale(1.08); color: var(--primary); }
  .esa-mobile-nav-item.is-active .esa-mobile-nav-label { transform: translateY(-1px); color: var(--text); font-weight: 700; }

  .esa-mobile-nav-item:active .esa-mobile-nav-icon { transform: scale(.88); }
  .esa-mobile-nav-item.is-active:active .esa-mobile-nav-icon { transform: translateY(-24px) scale(1.02); }

  /* The middle shortcut is the prominent action, like LapTrack's raised Scan
     control. It remains a normal in-app route and uses ESA's blue ring system. */
  .esa-mobile-nav-item.is-primary-action:not(.is-active) .esa-mobile-nav-icon {
    width: 46px;
    height: 46px;
    flex-basis: 46px;
    margin-top: -21px;
    border: 3px solid var(--surface);
    border-radius: 50%;
    background: linear-gradient(145deg, var(--primary-light), var(--primary-dark));
    color: #fff;
    box-shadow: 0 9px 18px rgba(37, 99, 235, .3), 0 2px 6px rgba(11, 18, 32, .13);
  }
  .esa-mobile-nav-item.is-primary-action:not(.is-active) .esa-mobile-nav-icon :deep(svg) { width: 21px; height: 21px; stroke-width: 2; }
  .esa-mobile-nav-item.is-primary-action:not(.is-active) .esa-mobile-nav-label { color: var(--primary); font-weight: 700; }
  .esa-mobile-nav-item.is-primary-action:not(.is-active):active .esa-mobile-nav-icon { transform: scale(.92); }

  .esa-mobile-nav-item:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -4px;
    border-radius: 14px;
  }

  .esa-mobile-bottom-nav.is-hidden {
    transform: translateY(calc(100% + env(safe-area-inset-bottom) + 20px));
    opacity: 0;
    pointer-events: none;
  }
}

@media (max-width: 360px) {
  .esa-mobile-bottom-nav { left: max(7px, env(safe-area-inset-left)); right: max(7px, env(safe-area-inset-right)); height: 72px; }
  .esa-mobile-nav-item { padding-left: 1px; padding-right: 1px; }
  .esa-mobile-nav-label { font-size: 8.5px; }
}

@media (prefers-reduced-motion: reduce) {
  .esa-mobile-nav-indicator,
  .esa-mobile-nav-icon,
  .esa-mobile-nav-label,
  .esa-mobile-bottom-nav { transition-duration: .001ms !important; }
}
</style>
