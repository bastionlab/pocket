<script setup lang="ts">
import { byCode } from '../../utils/puzzles/countries'
import { WORLD_BOX, WORLD_DOTS, WORLD_H, WORLD_PATHS, WORLD_W } from '../../utils/puzzles/worldMap'

/**
 * World map for the geography games: every country in a quiet fill, guesses in the game's closeness colours (`heat`: ok / warn / bad per
 * ISO2, from the same thresholds as the distance tile), the answer ringed once `target` is given (never before). Micro states are dots.
 * "Zoom in" frames the guesses + answer (small countries); when zoomed, drag pans and two fingers pinch. Tap a country for its name.
 * `collapsible` (default) = a "Map" row that opens it (PC: open by default; phone: closed, so it never pushes the controls down).
 */
const props = withDefaults(defineProps<{ guesses?: string[], target?: string | null, heat?: Record<string, 'ok' | 'warn' | 'bad'>, collapsible?: boolean, zoomed?: boolean }>(), { guesses: () => [], target: null, collapsible: true })
const uid = `pzwm-${Math.random().toString(36).slice(2, 8)}`
const open = ref(!props.collapsible)
onMounted(() => { if (props.collapsible && window.matchMedia('(min-width: 641px)').matches) open.value = true })

const svg = ref<SVGSVGElement>()
const picked = ref('')
const pickedName = computed(() => byCode(picked.value)?.name ?? '')

const codes = Object.keys(WORLD_PATHS).sort()
const dots = Object.entries(WORLD_DOTS)
const guessed = computed(() => new Set(props.guesses))
const tone = (c: string) => props.heat?.[c] ?? 'ok'
const last = computed(() => props.guesses[props.guesses.length - 1] ?? '')

/** where a country sits on the map: its main land mass centre, or its dot */
function centre(c: string): [number, number] | null {
  const b = WORLD_BOX[c]
  if (b) return [b[0] + b[2] / 2, b[1] + b[3] / 2]
  return WORLD_DOTS[c] ?? null
}
const ring = computed(() => (props.target ? centre(props.target) : null))

// view = scale + translation in map units (the world is 1 = whole map)
const MAXK = 14
const view = reactive({ k: 1, x: 0, y: 0 })
const dragging = ref(false)
const clamp = () => {
  view.k = Math.min(MAXK, Math.max(1, view.k))
  view.x = Math.min(0, Math.max(WORLD_W - WORLD_W * view.k, view.x))
  view.y = Math.min(0, Math.max(WORLD_H - WORLD_H * view.k, view.y))
}
function frame() {
  // bounding box of everything worth seeing: the guesses and the answer (micro states count as a point)
  const pts: number[][] = []
  for (const c of [...props.guesses, ...(props.target ? [props.target] : [])]) {
    const b = WORLD_BOX[c]
    if (b) pts.push([b[0], b[1]], [b[0] + b[2], b[1] + b[3]])
    else if (WORLD_DOTS[c]) pts.push(WORLD_DOTS[c]!)
  }
  if (!pts.length) return false
  const x0 = Math.min(...pts.map(p => p[0]!)), x1 = Math.max(...pts.map(p => p[0]!))
  const y0 = Math.min(...pts.map(p => p[1]!)), y1 = Math.max(...pts.map(p => p[1]!))
  const pad = 26
  const w = Math.max(x1 - x0 + pad * 2, 90), h = Math.max(y1 - y0 + pad * 2, 90 * WORLD_H / WORLD_W)
  view.k = Math.min(WORLD_W / w, WORLD_H / h, 8)
  view.x = WORLD_W / 2 - (x0 + x1) / 2 * view.k
  view.y = WORLD_H / 2 - (y0 + y1) / 2 * view.k
  clamp()
  return true
}
const isZoomed = computed(() => view.k > 1.01)
const canFrame = computed(() => props.guesses.length > 0 || !!props.target)
function toggleZoom() {
  if (isZoomed.value) { view.k = 1; view.x = 0; view.y = 0 } else frame()
}
// keep the frame on the action: a new guess re-frames while zoomed in
watch(() => [props.guesses.length, props.target], () => { if (isZoomed.value) frame() })
onMounted(() => { if (props.zoomed) frame() })

const gStyle = computed(() => ({ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }))
const dotR = computed(() => 2.6 / Math.sqrt(view.k))
const ringR = computed(() => 9 / Math.sqrt(view.k))

// pointer: one finger / mouse drags (only when zoomed in, so the page still scrolls on a phone), two fingers pinch
const ptrs = new Map<number, { x: number, y: number }>()
let moved = 0, pinch = 0
const unit = () => WORLD_W / (svg.value?.getBoundingClientRect().width || WORLD_W)
function down(e: PointerEvent) {
  if (!isZoomed.value) return
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  moved = 0
  pinch = ptrs.size === 2 ? dist() : 0
  svg.value?.setPointerCapture?.(e.pointerId)
}
const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a!.x - b!.x, a!.y - b!.y) }
function move(e: PointerEvent) {
  const p = ptrs.get(e.pointerId)
  if (!p) return
  const dx = e.clientX - p.x, dy = e.clientY - p.y
  p.x = e.clientX; p.y = e.clientY
  moved += Math.abs(dx) + Math.abs(dy)
  if (moved > 5) dragging.value = true
  if (ptrs.size === 2 && pinch) {
    const d = dist(), r = svg.value!.getBoundingClientRect()
    const [a, b] = [...ptrs.values()]
    const mx = ((a!.x + b!.x) / 2 - r.left) * unit(), my = ((a!.y + b!.y) / 2 - r.top) * unit()
    const k0 = view.k
    view.k = Math.min(MAXK, Math.max(1, k0 * d / pinch))
    const f = view.k / k0
    view.x = mx - (mx - view.x) * f
    view.y = my - (my - view.y) * f
    pinch = d
  } else if (ptrs.size === 1 && dragging.value) {
    view.x += dx * unit(); view.y += dy * unit()
  }
  clamp()
}
function up(e: PointerEvent) {
  ptrs.delete(e.pointerId)
  pinch = 0
  if (!ptrs.size) setTimeout(() => { dragging.value = false }, 0)
}
function tap(e: MouseEvent) {
  if (dragging.value) return
  const c = (e.target as SVGElement).dataset?.c
  picked.value = c && c !== picked.value ? c : ''
}
function key(e: KeyboardEvent) {
  if (!isZoomed.value) return
  const s = 40, m: Record<string, [number, number]> = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }
  const d = m[e.key]
  if (d) { e.preventDefault(); view.x += d[0]; view.y += d[1]; clamp() }
}
</script>

<template>
  <section class="wm" :class="{ open }" :aria-label="$t('puzzles.map.title')">
    <header class="bar">
      <button v-if="collapsible" type="button" class="tg" :aria-expanded="open" :aria-controls="uid" @click="open = !open">
        <Icon name="globe" :size="16" />
        <span class="tt">{{ $t('puzzles.map.title') }}</span>
        <span v-if="guesses.length" class="n num">{{ guesses.length }}</span>
        <Icon :name="open ? 'chevron-up' : 'chevron-down'" :size="16" class="cv" />
      </button>
      <span v-else class="tt only"><Icon name="globe" :size="16" />{{ $t('puzzles.map.title') }}</span>
      <button v-if="open" type="button" class="btn sm ghost zm" :aria-pressed="isZoomed" :disabled="!isZoomed && !canFrame" @click="toggleZoom">
        <Icon name="expand" :size="16" />{{ isZoomed ? $t('puzzles.map.world') : $t('puzzles.map.zoom') }}
      </button>
    </header>
    <div v-if="open" :id="uid" class="body">
      <svg
        ref="svg" class="map" :class="{ pan: isZoomed, drag: dragging }" :viewBox="`0 0 ${WORLD_W} ${WORLD_H}`" preserveAspectRatio="xMidYMid meet"
        role="group" :aria-label="$t('puzzles.map.alt')" :tabindex="isZoomed ? 0 : undefined"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @click="tap" @keydown="key"
      >
        <g class="view" :class="{ still: dragging }" :style="gStyle">
          <g class="land">
            <path v-for="c in codes" :key="c" :d="WORLD_PATHS[c]" :data-c="c" fill-rule="evenodd" :class="{ pk: c === picked }" />
          </g>
          <g class="hits">
            <path v-for="c in guesses.filter(x => WORLD_PATHS[x])" :key="c" :d="WORLD_PATHS[c]" :data-c="c" fill-rule="evenodd" :class="[`t-${tone(c)}`, { last: c === last, pk: c === picked }]" />
            <path v-if="target && WORLD_PATHS[target]" :d="WORLD_PATHS[target]" :data-c="target" fill-rule="evenodd" class="tgt" :class="guessed.has(target) ? `t-${tone(target)}` : 'miss'" />
          </g>
          <g class="dots">
            <circle v-for="[c, p] in dots" :key="c" :cx="p[0]" :cy="p[1]" :r="guessed.has(c) ? dotR * 1.5 : dotR" :data-c="c" :class="[guessed.has(c) ? `t-${tone(c)}` : 'q', { pk: c === picked }]" />
          </g>
          <g v-if="ring" class="ring" aria-hidden="true">
            <circle class="halo" :cx="ring[0]" :cy="ring[1]" :r="ringR" />
            <circle class="core" :cx="ring[0]" :cy="ring[1]" :r="ringR" />
          </g>
        </g>
      </svg>
      <p class="lab" aria-live="polite">{{ pickedName }}</p>
    </div>
  </section>
</template>

<style scoped>
.wm { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); overflow: hidden; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 8px 0 0; min-height: 44px; }
.tg { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 44px; padding: 0 12px; border: 0; background: transparent; color: var(--text); font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer; }
.tg:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.tg .cv { margin-left: auto; color: var(--muted); }
.tt { display: inline-flex; align-items: center; gap: 8px; }
.tt.only { padding: 0 12px; font-size: 14px; font-weight: 600; }
.n { min-width: 20px; height: 20px; padding: 0 6px; display: inline-grid; place-items: center; border-radius: 10px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 600; }
.zm { min-height: 36px; flex: none; }
@media (pointer: coarse) { .zm { min-height: 40px; } }
.body { padding: 0 8px 8px; }
.map { display: block; width: 100%; height: auto; border-radius: 6px; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; overflow: hidden; }
.map.pan { touch-action: none; cursor: grab; }
.map.pan.drag { cursor: grabbing; }
.map:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.view { transform-origin: 0 0; }
.land path { fill: color-mix(in oklab, var(--text) 13%, var(--panel-2)); stroke: var(--panel-2); stroke-width: .6px; vector-effect: non-scaling-stroke; cursor: pointer; }
.land path.pk { fill: color-mix(in oklab, var(--text) 26%, var(--panel-2)); }
.hits path { stroke: var(--panel-2); stroke-width: 1px; vector-effect: non-scaling-stroke; cursor: pointer; }
.t-ok { fill: var(--ok); }
.t-warn { fill: var(--warn); }
.t-bad { fill: var(--bad); }
.hits path.last, .dots circle.last { stroke: var(--text); stroke-width: 1.3px; }
.hits path.pk { stroke: var(--text); }
.hits path.tgt { stroke: var(--accent); stroke-width: 2px; }
.hits path.miss { fill: color-mix(in oklab, var(--accent) 45%, var(--panel-2)); }
.dots circle { stroke: var(--panel-2); stroke-width: .8px; vector-effect: non-scaling-stroke; cursor: pointer; }
.dots circle.q { fill: color-mix(in oklab, var(--text) 30%, var(--panel-2)); }
.dots circle.pk { stroke: var(--text); }
.ring circle { fill: none; stroke: var(--accent); stroke-width: 2px; vector-effect: non-scaling-stroke; transform-box: fill-box; transform-origin: center; pointer-events: none; }
.ring .halo { opacity: .5; }
.lab { margin: 6px 0 0; min-height: 18px; font-size: 13px; line-height: 18px; text-align: center; font-weight: 600; }
@media (prefers-reduced-motion: no-preference) {
  .view { transition: transform .45s cubic-bezier(.2, .8, .3, 1); }
  .view.still { transition: none; }
  .ring .halo { animation: wm-pulse 1.8s ease-out infinite; }
  .hits path.tgt { animation: wm-in .5s var(--ease-out) backwards; }
  @keyframes wm-pulse { from { opacity: .7; transform: scale(1); } to { opacity: 0; transform: scale(2.6); } }
  @keyframes wm-in { from { opacity: 0; } }
}
</style>
