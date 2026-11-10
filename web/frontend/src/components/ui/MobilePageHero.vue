<template>
  <section class="mobile-page-hero">
    <div class="mobile-page-hero__eyebrow"><span class="mobile-page-hero__dot"></span> ESA · {{ dateLabel }}</div>
    <div class="mobile-page-hero__content">
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </div>
    <div class="mobile-page-hero__glow"></div>
  </section>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ title: { type: String, required: true }, subtitle: { type: String, default: '' } })
const dateLabel = computed(() => new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }))
</script>
<style>
.mobile-page-hero { display:none; }
@media(max-width:768px) {
  .mobile-page-hero { display:flex; position:relative; isolation:isolate; flex-direction:column; justify-content:space-between; overflow:hidden; min-height:208px; margin:-16px -16px 0; padding:24px 20px 78px; color:#fff; background:linear-gradient(145deg,#102447 0%,#0b1730 58%,#081326 100%); }
  .mobile-page-hero__eyebrow { display:flex; align-items:center; gap:7px; color:rgba(226,237,255,.72); font-size:10px; font-weight:750; letter-spacing:.11em; text-transform:uppercase; }
  .mobile-page-hero__dot { width:6px; height:6px; border-radius:50%; background:#38bdf8; box-shadow:0 0 0 4px rgba(56,189,248,.13); }
  .mobile-page-hero__content { position:relative; z-index:1; margin-top:22px; }
  .mobile-page-hero h1 { font-size:24px; line-height:1.12; font-weight:850; letter-spacing:-.035em; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mobile-page-hero p { margin-top:7px; color:rgba(226,237,255,.68); font-size:12px; line-height:1.45; max-width:34ch; }
  .mobile-page-hero__glow { position:absolute; z-index:0; width:220px; height:220px; border-radius:50%; right:-90px; bottom:-135px; background:radial-gradient(circle,rgba(37,99,235,.35),transparent 70%); pointer-events:none; }
  .mobile-page-hero + .insights-header { position:relative; z-index:2; margin:-59px 0 14px !important; padding:0 !important; }
  .mobile-page-hero + .insights-header > div:first-child { display:none !important; }
  .mobile-page-hero + .insights-header > button { width:100%; min-height:44px; justify-content:center; }
  .mobile-page-hero + .section-header { position:relative; z-index:2; margin:-59px 0 14px !important; padding:0 !important; }
  .mobile-page-hero + .section-header > div:first-child { display:none !important; }
  .mobile-page-hero + .section-header .btn, .mobile-page-hero + .section-header .header-actions { width:100%; }
  .mobile-page-hero + .section-header .header-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .mobile-page-hero + .section-header .btn { min-height:44px; justify-content:center; white-space:nowrap; }
}
</style>
