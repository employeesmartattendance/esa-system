<template>
  <section class="glass attendance-chart-card" :aria-label="title">
    <div class="attendance-chart-heading">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <span class="attendance-chart-period">{{ periodLabel }}</span>
    </div>

    <div class="attendance-chart-main">
      <div class="attendance-donut" role="img" :aria-label="chartDescription">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="47" fill="none" stroke="var(--surface-border)" stroke-width="12" />
          <circle
            v-for="segment in segments"
            :key="segment.label"
            cx="60" cy="60" r="47" fill="none"
            :stroke="segment.color"
            stroke-width="12"
            stroke-linecap="butt"
            :stroke-dasharray="`${segment.length} ${circumference - segment.length}`"
            :stroke-dashoffset="-segment.offset"
            transform="rotate(-90 60 60)"
            class="attendance-donut-segment"
          />
        </svg>
        <div class="attendance-donut-center">
          <strong>{{ totalValue.toLocaleString() }}</strong>
          <span>{{ centerLabel }}</span>
        </div>
      </div>

      <div class="attendance-chart-breakdown">
        <div class="attendance-stack" aria-hidden="true">
          <span v-for="segment in segments" :key="segment.label" :style="{ width: `${segment.percent}%`, background: segment.color }"></span>
        </div>
        <div class="attendance-chart-legend">
          <div v-for="item in normalizedItems" :key="item.label" class="attendance-chart-legend-item">
            <span class="attendance-chart-dot" :style="{ background: item.color }"></span>
            <span class="attendance-chart-legend-label">{{ item.label }}</span>
            <strong>{{ item.value.toLocaleString() }}</strong>
            <small>{{ item.percent }}%</small>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Attendance overview' },
  subtitle: { type: String, default: 'A clear breakdown of recorded attendance' },
  total: { type: [Number, String], default: 0 },
  items: { type: Array, default: () => [] },
  centerLabel: { type: String, default: 'People' },
  periodLabel: { type: String, default: 'Today' },
})

const circumference = 2 * Math.PI * 47
const totalValue = computed(() => Math.max(0, Number(props.total) || 0))
const normalizedItems = computed(() => {
  const base = props.items.map(item => ({
    label: item.label,
    color: item.color || 'var(--primary)',
    value: Math.max(0, Number(item.value) || 0),
  }))
  const sum = base.reduce((total, item) => total + item.value, 0)
  return base.map(item => ({ ...item, percent: sum ? Math.round(item.value / sum * 100) : 0 }))
})
const segments = computed(() => {
  let offset = 0
  return normalizedItems.value.map(item => {
    const length = totalValue.value ? circumference * item.value / totalValue.value : 0
    const segment = { ...item, length, offset, percent: totalValue.value ? item.value / totalValue.value * 100 : 0 }
    offset += length
    return segment
  })
})
const chartDescription = computed(() => normalizedItems.value.map(item => `${item.label}: ${item.value}`).join(', '))
</script>

<style scoped>
.attendance-chart-card { padding: 22px; min-width: 0; }
.attendance-chart-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:18px; }
.attendance-chart-heading h3 { font-size:15px; font-weight:750; }
.attendance-chart-heading p { font-size:12px; color:var(--text-muted); margin-top:3px; }
.attendance-chart-period { flex:0 0 auto; font-size:10px; font-weight:700; color:var(--primary); background:rgba(37,99,235,.09); padding:5px 9px; border-radius:999px; }
.attendance-chart-main { display:grid; grid-template-columns:150px minmax(0,1fr); align-items:center; gap:22px; }
.attendance-donut { width:144px; height:144px; position:relative; margin:auto; }
.attendance-donut svg { display:block; width:100%; height:100%; }
.attendance-donut-segment { transition:stroke-dasharray .45s ease, stroke-dashoffset .45s ease; }
.attendance-donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.attendance-donut-center strong { font-size:26px; line-height:1.05; font-weight:800; }
.attendance-donut-center span { font-size:10px; font-weight:600; color:var(--text-muted); margin-top:3px; }
.attendance-chart-breakdown { min-width:0; }
.attendance-stack { display:flex; width:100%; height:9px; overflow:hidden; border-radius:99px; background:var(--surface-border); margin-bottom:13px; }
.attendance-stack span { min-width:0; transition:width .45s ease; }
.attendance-chart-legend { display:grid; gap:9px; }
.attendance-chart-legend-item { display:grid; grid-template-columns:9px minmax(0,1fr) auto 38px; align-items:center; gap:8px; font-size:12px; }
.attendance-chart-dot { width:8px; height:8px; border-radius:3px; }
.attendance-chart-legend-label { min-width:0; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.attendance-chart-legend-item strong { font-weight:750; font-variant-numeric:tabular-nums; }
.attendance-chart-legend-item small { color:var(--text-muted); text-align:right; font-size:10px; }
@media (max-width:768px) {
  .attendance-chart-card { padding:17px 15px; }
  .attendance-chart-main { grid-template-columns:105px minmax(0,1fr); gap:13px; }
  .attendance-donut { width:104px; height:104px; }
  .attendance-donut-center strong { font-size:20px; }
  .attendance-chart-legend { gap:7px; }
  .attendance-chart-legend-item { grid-template-columns:8px minmax(0,1fr) auto 32px; gap:6px; font-size:11px; }
}
@media (prefers-reduced-motion: reduce) { .attendance-donut-segment, .attendance-stack span { transition:none; } }
</style>
