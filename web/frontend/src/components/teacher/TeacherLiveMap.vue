<template>
  <div class="map-wrapper">
    <!-- Map canvas -->
    <div ref="mapEl" class="map-canvas"></div>

    <!-- Loading screen -->
    <div v-if="!mapReady" class="map-loading">
      <div class="map-spinner"></div>
      <span>Loading map...</span>
    </div>

    <!-- HUD top bar -->
    <div class="hud-top" v-if="mapReady">
      <div class="hud-pill">
        <div class="hud-dot school-dot"></div>
        <div class="hud-info">
          <div class="hud-label">School</div>
          <div class="hud-val">{{ schoolName || 'Not configured' }}</div>
        </div>
      </div>

    </div>

    <!-- Bottom distance bar -->
    <div class="hud-bottom" v-if="mapReady && distInfo">
      <div class="dist-bar">
        <div class="dist-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span class="dist-label">Distance</span>
          <span class="dist-val">{{ distInfo.dist }}</span>
        </div>


      </div>
    </div>

    <!-- Map control buttons -->
    <div class="map-ctrl-btns" v-if="mapReady">
      <button class="ctrl-btn" @click="centerMe" title="Center on my location">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
      </button>
      <button class="ctrl-btn" @click="fitBoth" title="Fit both markers">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        </svg>
      </button>
      <button class="ctrl-btn" :class="{ 'ctrl-active': tracking }" @click="toggleTracking" title="Toggle live tracking">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import api from '../../api'
import { getSocket } from '../../socket'

const props = defineProps({
  schoolLat:    { type: Number, default: null },
  schoolLng:    { type: Number, default: null },
  schoolName:   { type: String, default: '' },
  schoolRadius: { type: Number, default: 200 },
})
const emit = defineEmits(['location-update'])

const mapEl      = ref(null)
const mapReady   = ref(false)
const tracking   = ref(false)
const teacherPos = ref(null)

let map           = null
let teacherMarker = null
let schoolMarker  = null
let watchId       = null
let broadcastTimer = null
let lastRouteTime  = 0
let pulseAnimId    = null

// ── Distance info ──────────────────────────────────────────────────────────
const distInfo = computed(() => {
  if (!teacherPos.value || !props.schoolLat || !props.schoolLng) return null
  const d = haversineKm(teacherPos.value.lat, teacherPos.value.lng, props.schoolLat, props.schoolLng)
  const mins = Math.round(d / 5 * 60)
  return {
    dist: d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(2)} km`,
    eta:  mins < 1 ? '<1 min' : mins < 60 ? `${mins} min` : `${Math.round(mins/60)}h`,
  }
})

// ── Dark map style ─────────────────────────────────────────────────────────
function darkStyle() {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [
      { id: 'bg',  type: 'background', paint: { 'background-color': '#060d1f' } },
      {
        id: 'osm', type: 'raster', source: 'osm',
        paint: {
          'raster-brightness-min': 0,
          'raster-brightness-max': 0.12,
          'raster-saturation': -0.7,
          'raster-contrast': 0.2,
          'raster-hue-rotate': 210,
        },
      },
    ],
  }
}

// ── Init map ───────────────────────────────────────────────────────────────
onMounted(async () => {
  const center = props.schoolLat && props.schoolLng
    ? [props.schoolLng, props.schoolLat]
    : [30.0619, -1.9441]

  map = new maplibregl.Map({
    container: mapEl.value,
    style: darkStyle(),
    center, zoom: 14, pitch: 30, antialias: true,
  })
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

  map.on('load', () => {
    mapReady.value = true
    addRouteSources()
    addSchoolMarker()
    addRadiusCircle()
  })

  startTracking()
  listenSocket()
})

onUnmounted(() => {
  stopTracking()
  if (pulseAnimId) cancelAnimationFrame(pulseAnimId)
  if (map) { map.remove(); map = null }
})

// ── Route sources ──────────────────────────────────────────────────────────
function addRouteSources() {
  if (!map) return
  const empty = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
  map.addSource('route', { type: 'geojson', data: empty })
  // Glow layer
  map.addLayer({ id: 'route-glow', type: 'line', source: 'route',
    paint: { 'line-color': '#4a9eff', 'line-width': 18, 'line-opacity': 0.12, 'line-blur': 10 },
    layout: { 'line-cap': 'round', 'line-join': 'round' } })
  // Outer solid
  map.addLayer({ id: 'route-outer', type: 'line', source: 'route',
    paint: { 'line-color': '#1a5da8', 'line-width': 5, 'line-opacity': 0.85 },
    layout: { 'line-cap': 'round', 'line-join': 'round' } })
  // Bright center
  map.addLayer({ id: 'route-inner', type: 'line', source: 'route',
    paint: { 'line-color': '#7ec8ff', 'line-width': 2, 'line-opacity': 1 },
    layout: { 'line-cap': 'round', 'line-join': 'round' } })
  // Dotted white
  map.addLayer({ id: 'route-dots', type: 'line', source: 'route',
    paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [3, 7] },
    layout: { 'line-cap': 'round' } })
}

// ── Radius circle (blinking) ────────────────────────────────────────────────
function addRadiusCircle() {
  if (!map || !props.schoolLat || !props.schoolLng) return
  const center = [props.schoolLng, props.schoolLat]
  const radiusM = props.schoolRadius || 200

  // Build GeoJSON circle polygon
  function makeCircle(lng, lat, radius) {
    const pts = 64
    const coords = []
    for (let i = 0; i <= pts; i++) {
      const angle = (i / pts) * 2 * Math.PI
      const dx = radius / (111320 * Math.cos(lat * Math.PI / 180))
      const dy = radius / 110540
      coords.push([lng + dx * Math.cos(angle), lat + dy * Math.sin(angle)])
    }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
  }

  const circle = makeCircle(props.schoolLng, props.schoolLat, radiusM)
  const outerCircle = makeCircle(props.schoolLng, props.schoolLat, radiusM * 1.18)

  if (map.getSource('radius-zone')) {
    map.getSource('radius-zone').setData(circle)
    map.getSource('radius-outer').setData(outerCircle)
    return
  }

  map.addSource('radius-zone',  { type: 'geojson', data: circle })
  map.addSource('radius-outer', { type: 'geojson', data: outerCircle })

  // Solid fill
  map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-zone',
    paint: { 'fill-color': '#10b981', 'fill-opacity': 0.07 } }, 'route-glow')

  // Outer pulse ring
  map.addLayer({ id: 'radius-outer-ring', type: 'line', source: 'radius-outer',
    paint: { 'line-color': '#10b981', 'line-width': 1, 'line-opacity': 0.35, 'line-dasharray': [4, 4] } }, 'route-glow')

  // Main border
  map.addLayer({ id: 'radius-border', type: 'line', source: 'radius-zone',
    paint: { 'line-color': '#10b981', 'line-width': 2.5, 'line-opacity': 1 } }, 'route-glow')

  // Animate the border opacity to create blink/pulse effect
  let phase = 0
  let lastPulse = 0
  function animatePulse(now) {
    if (!map) return
    if (now - lastPulse < 60) { pulseAnimId = requestAnimationFrame(animatePulse); return }
    lastPulse = now
    phase = (phase + 0.04) % (Math.PI * 2)
    const opacity = 0.45 + 0.55 * Math.abs(Math.sin(phase))
    const outerOpacity = 0.12 + 0.25 * Math.abs(Math.sin(phase + 0.7))
    if (map.getLayer('radius-border')) map.setPaintProperty('radius-border', 'line-opacity', opacity)
    if (map.getLayer('radius-fill'))   map.setPaintProperty('radius-fill',   'fill-opacity',  0.04 + 0.06 * Math.abs(Math.sin(phase)))
    if (map.getLayer('radius-outer-ring')) map.setPaintProperty('radius-outer-ring', 'line-opacity', outerOpacity)
    pulseAnimId = requestAnimationFrame(animatePulse)
  }
  pulseAnimId = requestAnimationFrame(animatePulse)
}


function addSchoolMarker() {
  if (!props.schoolLat || !props.schoolLng || !map) return
  const el = document.createElement('div')
  el.className = 'esa-school-marker'
  el.innerHTML = `
    <div class="sm-ring"></div>
    <div class="sm-body">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
    <div class="sm-label">${props.schoolName || 'School'}</div>`
  schoolMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([props.schoolLng, props.schoolLat]).addTo(map)
}

// ── Teacher marker ─────────────────────────────────────────────────────────
function upsertTeacherMarker(lat, lng) {
  if (!map || !mapReady.value) return
  if (teacherMarker) { animateTo(teacherMarker, [lng, lat]); return }
  const el = document.createElement('div')
  el.className = 'esa-teacher-marker'
  el.innerHTML = `
    <div class="tm-pulse-outer"></div>
    <div class="tm-pulse-mid"></div>
    <div class="tm-body">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </div>`
  teacherMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([lng, lat]).addTo(map)
}

// ── Smooth marker animation ────────────────────────────────────────────────
function animateTo(marker, [toLng, toLat]) {
  const start = performance.now(), dur = 1400
  const { lng: fLng, lat: fLat } = marker.getLngLat()
  ;(function step(now) {
    const t    = Math.min((now - start) / dur, 1)
    const ease = t < .5 ? 2*t*t : -1+(4-2*t)*t
    marker.setLngLat([fLng + (toLng-fLng)*ease, fLat + (toLat-fLat)*ease])
    if (t < 1) requestAnimationFrame(step)
  })(performance.now())
}

// ── Draw route ─────────────────────────────────────────────────────────────
async function drawRoute(fLat, fLng, tLat, tLng) {
  if (!map || !mapReady.value) return
  let coords
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (r.ok) { const d = await r.json(); coords = d.routes?.[0]?.geometry?.coordinates }
  } catch {}
  if (!coords) {
    // Fallback: straight line
    coords = Array.from({ length: 20 }, (_, i) => {
      const t = i / 19
      return [fLng + (tLng-fLng)*t, fLat + (tLat-fLat)*t]
    })
  }
  map.getSource('route')?.setData({ type:'Feature', geometry:{ type:'LineString', coordinates: coords } })
}

// ── GPS Tracking ───────────────────────────────────────────────────────────
function startTracking() {
  if (!navigator.geolocation) return
  tracking.value = true
  watchId = navigator.geolocation.watchPosition(onGPS,
    err => console.warn('GPS:', err.message),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 })
}
function stopTracking() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }
  if (broadcastTimer) { clearTimeout(broadcastTimer); broadcastTimer = null }
  tracking.value = false
}
function toggleTracking() { tracking.value ? stopTracking() : startTracking() }

function onGPS(pos) {
  const lat = pos.coords.latitude, lng = pos.coords.longitude
  teacherPos.value = { lat, lng, accuracy: pos.coords.accuracy }
  emit('location-update', { lat, lng })
  if (mapReady.value) {
    upsertTeacherMarker(lat, lng)
    if (!schoolMarker && props.schoolLat && props.schoolLng) addSchoolMarker()
    
    // Always try to draw route on first valid position or every 15s
    const now = Date.now()
    if (props.schoolLat && props.schoolLng && (now - lastRouteTime > 15000 || lastRouteTime === 0)) {
      lastRouteTime = now
      drawRoute(lat, lng, props.schoolLat, props.schoolLng)
    }
  }
  if (!broadcastTimer) {
    broadcastTimer = setTimeout(() => {
      broadcast(lat, lng)
      broadcastTimer = null
    }, 10000)
  }
}

async function broadcast(lat, lng) {
  try { await api.post('/teacher/location', { latitude: lat, longitude: lng }) } catch {}
}

function listenSocket() {
  const s = getSocket()
  if (s) s.on('teacher-location-update', () => {})
}

// ── Controls ───────────────────────────────────────────────────────────────
function centerMe() {
  if (!map || !teacherPos.value) return
  map.flyTo({ center: [teacherPos.value.lng, teacherPos.value.lat], zoom: 16, duration: 1200 })
}
function fitBoth() {
  if (!map) return
  const b = new maplibregl.LngLatBounds()
  if (teacherPos.value) b.extend([teacherPos.value.lng, teacherPos.value.lat])
  if (props.schoolLat && props.schoolLng) b.extend([props.schoolLng, props.schoolLat])
  if (!b.isEmpty()) map.fitBounds(b, { padding: 80, duration: 1400, maxZoom: 15 })
}

// ── Watch school coords ────────────────────────────────────────────────────
watch(() => [props.schoolLat, props.schoolLng, props.schoolRadius], ([lat, lng]) => {
  if (!lat || !lng || !mapReady.value) return
  if (schoolMarker) schoolMarker.remove()
  addSchoolMarker()
  addRadiusCircle()
  if (teacherPos.value) drawRoute(teacherPos.value.lat, teacherPos.value.lng, lat, lng)
})

// ── Math ───────────────────────────────────────────────────────────────────
function haversineKm(la1,lo1,la2,lo2) {
  const R=6371, dL=(la2-la1)*Math.PI/180, dO=(lo2-lo1)*Math.PI/180
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}
function getBearing(la1,lo1,la2,lo2) {
  const dO=(lo2-lo1)*Math.PI/180
  const y=Math.sin(dO)*Math.cos(la2*Math.PI/180)
  const x=Math.cos(la1*Math.PI/180)*Math.sin(la2*Math.PI/180)-Math.sin(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.cos(dO)
  return ((Math.atan2(y,x)*180/Math.PI)+360)%360
}
</script>

<!-- Global styles for MapLibre custom markers -->
<style>
.esa-teacher-marker { position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center; }
.tm-pulse-outer { position:absolute; inset:0; border-radius:50%; background:rgba(74,158,255,0.14); animation:tmOuter 2.4s ease-out infinite; }
.tm-pulse-mid   { position:absolute; width:34px; height:34px; border-radius:50%; border:2px solid rgba(74,158,255,0.35); animation:tmMid 2.4s ease-out infinite 0.3s; }
.tm-body { position:relative; z-index:2; width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#1a4fc4,#2563eb); border:2.5px solid rgba(126,200,255,0.9); box-shadow:0 0 20px rgba(74,158,255,0.7),0 0 40px rgba(74,158,255,0.3); display:flex; align-items:center; justify-content:center; }
@keyframes tmOuter { 0%{transform:scale(0.85);opacity:0.6} 70%{transform:scale(1.8);opacity:0} 100%{transform:scale(0.85);opacity:0} }
@keyframes tmMid   { 0%{transform:scale(0.9);opacity:0.5}  70%{transform:scale(1.4);opacity:0} 100%{transform:scale(0.9);opacity:0} }

.esa-school-marker { position:relative; display:flex; flex-direction:column; align-items:center; }
.sm-ring  { position:absolute; top:0; left:50%; transform:translateX(-50%); width:50px; height:50px; border-radius:50%; border:1.5px solid rgba(255,165,60,0.4); animation:smRing 3s ease-in-out infinite; }
.sm-body  { position:relative; z-index:2; width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,#c45a00,#ff7722); border:2.5px solid rgba(255,180,80,0.9); box-shadow:0 0 20px rgba(255,120,30,0.7),0 0 40px rgba(255,100,0,0.3); display:flex; align-items:center; justify-content:center; }
.sm-label { position:absolute; bottom:-22px; left:50%; transform:translateX(-50%); white-space:nowrap; font-size:10px; font-weight:700; color:#ffaa50; text-shadow:0 0 8px rgba(255,120,30,0.8); background:rgba(6,13,31,0.85); padding:2px 7px; border-radius:4px; border:1px solid rgba(255,120,30,0.3); font-family:-apple-system,sans-serif; }
@keyframes smRing { 0%,100%{transform:translateX(-50%) scale(1);opacity:0.4} 50%{transform:translateX(-50%) scale(1.15);opacity:0.1} }

.maplibregl-ctrl-attrib { background:rgba(6,13,31,0.7) !important; color:#4a7cc7 !important; }
.maplibregl-ctrl-attrib a { color:#4a9eff !important; }
</style>

<style scoped>
.map-wrapper {
  position:relative; width:100%; height:520px;
  border-radius:var(--radius-lg); overflow:hidden;
  background:#060d1f;
  border:1px solid rgba(74,158,255,0.2);
  box-shadow:0 8px 40px rgba(0,0,0,0.5);
}
.map-canvas { position:absolute; inset:0; width:100%; height:100%; }

/* Loading */
.map-loading { position:absolute; inset:0; background:#060d1f; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:rgba(150,200,255,0.6); font-size:13px; font-weight:600; z-index:20; }
.map-spinner { width:36px; height:36px; border:3px solid rgba(74,158,255,0.2); border-top-color:#4a9eff; border-radius:50%; animation:spin 0.8s linear infinite; }

/* HUD top */
.hud-top { position:absolute; top:14px; left:50%; transform:translateX(-50%); display:flex; align-items:center; background:rgba(6,13,31,0.88); backdrop-filter:blur(16px); border:1px solid rgba(74,158,255,0.25); border-radius:var(--radius); padding:8px 16px; z-index:10; box-shadow:0 4px 24px rgba(0,0,0,0.4); white-space:nowrap; }
.hud-pill { display:flex; align-items:center; gap:8px; padding:0 12px; }
.hud-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.location-dot { background:#4a9eff; box-shadow:0 0 6px rgba(74,158,255,0.8); animation:dotPulse 2s ease-in-out infinite; }
.school-dot   { background:#ff8c40; box-shadow:0 0 6px rgba(255,120,30,0.8); }
.live-dot     { background:#10b981; box-shadow:0 0 6px rgba(16,185,129,0.8); animation:dotPulse 1.5s ease-in-out infinite; }
.off-dot      { background:#ef4444; }
@keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
.hud-label { font-size:10px; color:rgba(150,180,230,0.65); font-weight:600; text-transform:uppercase; letter-spacing:0.06em; }
.hud-val   { font-size:12px; font-weight:700; color:#c8deff; margin-top:1px; }
.hud-val.mono { font-family:'JetBrains Mono',monospace; }
.hud-val.dim  { color:rgba(150,180,230,0.4); }
.text-green { color:#10b981 !important; }
.text-red   { color:#ef4444 !important; }
.hud-divider { width:1px; height:32px; background:rgba(74,158,255,0.2); flex-shrink:0; }

/* HUD bottom */
.hud-bottom { position:absolute; bottom:14px; left:50%; transform:translateX(-50%); z-index:10; }
.dist-bar { display:flex; align-items:center; background:rgba(6,13,31,0.88); backdrop-filter:blur(16px); border:1px solid rgba(74,158,255,0.25); border-radius:var(--radius); padding:10px 20px; gap:0; box-shadow:0 4px 24px rgba(0,0,0,0.4); }
.dist-item  { display:flex; align-items:center; gap:6px; padding:0 14px; }
.dist-div   { width:1px; height:24px; background:rgba(74,158,255,0.2); }
.dist-label { font-size:10px; color:rgba(150,180,230,0.6); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
.dist-val   { font-size:13px; font-weight:700; color:#7ec8ff; font-family:'JetBrains Mono',monospace; }

/* Controls */
.map-ctrl-btns { position:absolute; top:14px; right:14px; display:flex; flex-direction:column; gap:6px; z-index:10; }
.ctrl-btn { width:38px; height:38px; border-radius:10px; background:rgba(6,13,31,0.88); border:1px solid rgba(74,158,255,0.3); color:rgba(150,200,255,0.7); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; backdrop-filter:blur(12px); }
.ctrl-btn:hover  { border-color:rgba(74,158,255,0.8); color:#7ec8ff; background:rgba(30,60,120,0.5); }
.ctrl-active     { border-color:#10b981 !important; color:#10b981 !important; background:rgba(16,185,129,0.1) !important; }

@keyframes spin { to { transform:rotate(360deg); } }

@media (max-width:640px) {
  .map-wrapper  { height:420px; }
  .hud-top      { flex-direction:column; gap:4px; padding:8px 12px; max-width:calc(100vw - 120px); }
  .hud-divider  { display:none; }
  .hud-pill     { padding:0 6px; }
  .dist-bar     { padding:8px 12px; }
  .dist-item    { padding:0 8px; }
}
</style>
