<template>
  <span class="badge" :class="`badge-${variant}`">
    <span v-if="dot" class="badge-dot"></span>
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'info' },
  label: { type: String, default: '' },
  dot: { type: Boolean, default: false },
})
</script>

<style scoped>
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  font-size: 12px; font-weight: 600; white-space: nowrap;
}
.badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
}
.badge-present { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-late    { background: rgba(245,158,11,0.15);  color: #f59e0b; }
.badge-absent  { background: rgba(239,68,68,0.15);   color: #ef4444; }
.badge-active  { background: rgba(16,185,129,0.15);  color: #10b981; }
.badge-inactive{ background: rgba(239,68,68,0.15);   color: #ef4444; }
.badge-info    { background: rgba(139,92,246,0.15);  color: #8b5cf6; }
.badge-primary { background: rgba(37,99,235,0.15);   color: var(--primary); }
.badge-warning { background: rgba(245,158,11,0.15);  color: #f59e0b; }
.badge-success { background: rgba(16,185,129,0.15);  color: #10b981; }
.badge-danger  { background: rgba(239,68,68,0.15);   color: #ef4444; }
</style>
