<template>
  <div class="stat-card glass animate-in" :style="`animation-delay:${delay}`">
    <div class="stat-icon-wrap" :style="`background:${computedBgColor}`">
      <AppIcon :name="icon" :size="22" :color="computedIconColor" />
    </div>
    <div class="stat-value" :style="`color:${computedValueColor}`">{{ value ?? '–' }}</div>
    <div class="stat-label" :style="`color:${computedLabelColor}`">{{ label }}</div>
    <div v-if="trend !== undefined" class="stat-trend" :class="trend >= 0 ? 'up' : 'down'">
      <AppIcon :name="trend >= 0 ? 'trending-up' : 'trending-up'" :size="12" />
      {{ Math.abs(trend) }}% {{ trend >= 0 ? 'increase' : 'decrease' }}
    </div>
    <div class="stat-glow" :style="`background:${computedGlowColor}`"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  icon: { type: String, default: 'dashboard' },
  label: { type: String, required: true },
  value: { type: [Number, String], default: null },
  status: { type: String, default: null }, // 'success', 'warning', 'danger', 'info', 'primary', 'accent'
  bgColor: { type: String, default: null },
  iconColor: { type: String, default: null },
  valueColor: { type: String, default: null },
  labelColor: { type: String, default: null },
  glowColor: { type: String, default: null },
  trend: { type: Number, default: undefined },
  delay: { type: String, default: '0s' },
})

// Status color mappings
const statusColorMap = {
  success: {
    icon: 'var(--success)',
    value: 'var(--success)',
    label: 'var(--text-secondary)',
    bg: 'rgba(16,185,129,0.12)',
    glow: 'rgba(16,185,129,0.06)'
  },
  warning: {
    icon: 'var(--warning)',
    value: 'var(--warning)',
    label: 'var(--text-secondary)',
    bg: 'rgba(245,158,11,0.12)',
    glow: 'rgba(245,158,11,0.06)'
  },
  danger: {
    icon: 'var(--danger)',
    value: 'var(--danger)',
    label: 'var(--text-secondary)',
    bg: 'rgba(239,68,68,0.12)',
    glow: 'rgba(239,68,68,0.06)'
  },
  info: {
    icon: 'var(--accent)',
    value: 'var(--accent)',
    label: 'var(--text-secondary)',
    bg: 'rgba(6,182,212,0.12)',
    glow: 'rgba(6,182,212,0.06)'
  },
  primary: {
    icon: 'var(--primary)',
    value: 'var(--primary)',
    label: 'var(--text-secondary)',
    bg: 'rgba(37,99,235,0.12)',
    glow: 'rgba(37,99,235,0.06)'
  },
  accent: {
    icon: 'var(--accent)',
    value: 'var(--accent)',
    label: 'var(--text-secondary)',
    bg: 'rgba(6,182,212,0.12)',
    glow: 'rgba(6,182,212,0.06)'
  }
}

// Compute colors based on status or use provided colors
const computedIconColor = computed(() => {
  if (props.iconColor) return props.iconColor
  if (props.status && statusColorMap[props.status]) {
    return statusColorMap[props.status].icon
  }
  return 'var(--primary)'
})

const computedValueColor = computed(() => {
  if (props.valueColor) return props.valueColor
  if (props.status && statusColorMap[props.status]) {
    return statusColorMap[props.status].value
  }
  return 'var(--primary)'
})

const computedLabelColor = computed(() => {
  if (props.labelColor) return props.labelColor
  if (props.status && statusColorMap[props.status]) {
    return statusColorMap[props.status].label
  }
  return 'var(--text-secondary)'
})

const computedBgColor = computed(() => {
  if (props.bgColor) return props.bgColor
  if (props.status && statusColorMap[props.status]) {
    return statusColorMap[props.status].bg
  }
  return 'rgba(37,99,235,0.12)'
})

const computedGlowColor = computed(() => {
  if (props.glowColor) return props.glowColor
  if (props.status && statusColorMap[props.status]) {
    return statusColorMap[props.status].glow
  }
  return 'rgba(37,99,235,0.06)'
})
</script>

<style scoped>
.stat-card {
  padding: 22px;
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
  cursor: default;
  transition: transform var(--transition), box-shadow var(--transition);
}

.stat-card:hover { 
  transform: translateY(-4px); 
  box-shadow: 0 12px 40px rgba(37,99,235,0.18); 
}

.stat-icon-wrap {
  width: 48px; 
  height: 48px;
  border-radius: var(--radius);
  display: flex; 
  align-items: center; 
  justify-content: center;
  margin-bottom: 16px;
  transition: background var(--transition);
}

.stat-value { 
  font-size: 32px; 
  font-weight: 800; 
  line-height: 1;
  transition: color var(--transition);
}

.stat-label { 
  font-size: 13px; 
  margin-top: 5px; 
  font-weight: 500;
  transition: color var(--transition);
}

.stat-trend { 
  font-size: 12px; 
  margin-top: 8px; 
  display: flex; 
  align-items: center; 
  gap: 4px; 
  font-weight: 600; 
}

.stat-trend.up { 
  color: var(--success); 
}

.stat-trend.down { 
  color: var(--danger); 
}

.stat-glow {
  position: absolute; 
  bottom: -20px; 
  right: -20px;
  width: 80px; 
  height: 80px;
  border-radius: 50%;
  filter: blur(20px);
  pointer-events: none;
  transition: background var(--transition);
}
</style>
