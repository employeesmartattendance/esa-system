<template>
  <div class="empty-state">
    <div class="empty-icon-wrap">
      <AppIcon :name="icon" :size="36" color="var(--text-muted)" />
    </div>
    <h3>{{ title }}</h3>
    <p>{{ message }}</p>
    <slot />
  </div>
</template>

<script setup>
import AppIcon from './AppIcon.vue'
defineProps({
  icon: { type: String, default: 'info' },
  title: { type: String, default: 'Nothing here yet' },
  message: { type: String, default: '' },
})
</script>

<style scoped>
.empty-state { text-align: center; padding: 56px 24px; color: var(--text-secondary); }
.empty-icon-wrap {
  width: 72px; height: 72px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--surface-border);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
}
h3 { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: var(--text); }
p { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
</style>
