<template>
  <section class="glass metric-bars-card" :aria-label="title">
    <div class="metric-bars-heading">
      <div><h3>{{ title }}</h3><p>{{ subtitle }}</p></div>
      <span v-if="periodLabel" class="metric-bars-period">{{ periodLabel }}</span>
    </div>
    <div class="metric-bars-list">
      <div v-for="item in normalizedItems" :key="item.label" class="metric-bars-row">
        <div class="metric-bars-label"><span>{{ item.label }}</span><strong>{{ item.value.toLocaleString() }}</strong></div>
        <div class="metric-bars-track"><span :style="{ width: `${item.percent}%`, background: item.color }"></span></div>
      </div>
    </div>
  </section>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({
  title: { type: String, default: 'Overview' },
  subtitle: { type: String, default: 'Visual summary' },
  items: { type: Array, default: () => [] },
  periodLabel: { type: String, default: '' },
})
const normalizedItems = computed(() => {
  const values = props.items.map(item => ({ ...item, value: Math.max(0, Number(item.value ?? item.val) || 0) }))
  const max = Math.max(1, ...values.map(item => item.value))
  return values.map(item => ({ ...item, percent: item.percent != null ? Math.max(0, Math.min(100, Number(item.percent))) : item.value / max * 100 }))
})
</script>
<style scoped>
.metric-bars-card { padding:20px; min-width:0; }
.metric-bars-heading { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:18px; }
.metric-bars-heading h3 { font-size:15px; font-weight:750; }
.metric-bars-heading p { color:var(--text-muted); font-size:12px; margin-top:3px; }
.metric-bars-period { flex:0 0 auto; font-size:10px; font-weight:700; color:var(--primary); background:rgba(37,99,235,.09); border-radius:99px; padding:5px 9px; }
.metric-bars-list { display:grid; gap:14px; }
.metric-bars-row { display:grid; gap:6px; }
.metric-bars-label { display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:12px; }
.metric-bars-label span { min-width:0; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.metric-bars-label strong { flex:0 0 auto; font-weight:750; font-variant-numeric:tabular-nums; }
.metric-bars-track { height:9px; border-radius:99px; overflow:hidden; background:var(--surface-border); }
.metric-bars-track span { display:block; height:100%; border-radius:inherit; transition:width .45s ease; }
@media(max-width:768px) { .metric-bars-card { padding:16px; } .metric-bars-list { gap:11px; } }
@media(prefers-reduced-motion:reduce) { .metric-bars-track span { transition:none; } }
</style>
