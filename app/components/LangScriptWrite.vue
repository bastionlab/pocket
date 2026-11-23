<script setup lang="ts">
/**
 * Write card input of the alphabet languages (Armenian, Russian; ported from the Armenian add-on). Letters: a guided trace pad.
 * Without Hint the pad is blank (from memory); Hint shows the target glyph as a faint ghost to trace. Check rasterises the glyph
 * (in a system font that covers the script) and scores the ink against it (coverage / spill, see utils/langScript.ts). Words:
 * typed on the on-screen keyboard of the language (SCRIPT_KEYS) or on a hardware keyboard (the field is a real input, with the
 * phone's own keyboard kept away), exact match after trimming and case-folding (Russian: stress marks and ё = е don't count);
 * Hint shows the transliteration. A hint caps the suggested rating at Good.
 */
import type { HyItem } from '../utils/lang'
const props = defineProps<{ c: HyItem & { id: string, lang: string }, locked?: boolean }>()
const emit = defineEmits<{ check: [{ ok: boolean, typed: string, cov?: number, hint: boolean, sugg: number }] }>()
const t = langT

const typed = ref('')
const word = computed(() => props.c.t === 'w')
const target = computed(() => scriptAnswer(props.c))
const rows = computed(() => SCRIPT_KEYS[props.c.lang] ?? [])
const FONT = computed(() => SCRIPT_FONT[props.c.lang] ?? 'sans-serif')
const norm = (s: string) => scriptNorm(props.c.lang, s)
const inp = ref<HTMLInputElement>()

const type = (k: string) => { if (!props.locked && typed.value.length < 60) typed.value += k }
const back = () => { if (!props.locked) typed.value = [...typed.value].slice(0, -1).join('') }

// --- pad: guide canvas (ghost, reveal) under the ink canvas ---
const cv = ref<HTMLCanvasElement>()
const gcv = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let last: [number, number] | null = null
let W = 0, H = 0
const inked = ref(false)
const hinted = ref(false) // Hint used on this card (the card remounts per card)
const showHint = ref(false)
let revealed = false

function setup() {
  const el = cv.value!, g = gcv.value!, r = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
  W = Math.round(r.width); H = Math.round(r.height)
  for (const c of [el, g]) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr) }
  ctx = el.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.strokeStyle = getComputedStyle(el).color
  g.getContext('2d')!.scale(dpr, dpr)
}
const at = (e: PointerEvent): [number, number] => { const r = cv.value!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
function down(e: PointerEvent) {
  if (props.locked) return
  cv.value!.setPointerCapture(e.pointerId)
  last = at(e); inked.value = true
  ctx!.beginPath(); ctx!.arc(last[0], last[1], 2.5, 0, 7); ctx!.fillStyle = ctx!.strokeStyle; ctx!.fill()
}
function move(e: PointerEvent) {
  if (!last) return
  for (const c of (e.getCoalescedEvents?.() ?? [e])) {
    const p = at(c)
    ctx!.beginPath(); ctx!.moveTo(last[0], last[1]); ctx!.lineTo(p[0], p[1]); ctx!.stroke()
    last = p
  }
}
const up = () => { last = null }
function clear() { ctx!.clearRect(0, 0, W, H); inked.value = false }

/** the target glyph, auto-sized to fill the canvas, centred, thickened with a stroke so a finger can follow it */
function paintGlyph(c: CanvasRenderingContext2D, fill: string) {
  const text = target.value
  c.font = `100px ${FONT.value}`
  const m = c.measureText(text)
  const asc = m.actualBoundingBoxAscent || 75, desc = m.actualBoundingBoxDescent || 0
  const k = Math.min((W * 0.9) / (m.width || 100), (H * 0.8) / (asc + desc || 100))
  c.font = `${100 * k}px ${FONT.value}`
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.fillStyle = fill; c.strokeStyle = fill; c.lineWidth = Math.max(4, 100 * k * 0.06); c.lineJoin = 'round'
  const y = H / 2 + ((asc - desc) * k) / 2
  c.strokeText(text, W / 2, y); c.fillText(text, W / 2, y)
}
function drawGuide() {
  const g = gcv.value!.getContext('2d')!
  g.save(); g.clearRect(0, 0, W, H)
  if (showHint.value && !revealed) { g.globalAlpha = 0.16; paintGlyph(g, getComputedStyle(gcv.value!).color) }
  g.restore()
}
function toggleHint() {
  if (props.locked) return
  showHint.value = !showHint.value
  if (showHint.value) hinted.value = true
  if (!word.value) drawGuide()
}
/** the target in the accent colour over the ink (after Check / giving up) */
function reveal() {
  if (word.value || revealed || !ctx) return
  revealed = true
  drawGuide()
  ctx.save(); ctx.globalAlpha = 0.55; paintGlyph(ctx, getComputedStyle(cv.value!).getPropertyValue('--accent').trim() || 'currentColor'); ctx.restore()
}
watch(() => props.locked, (l) => { if (l) reveal() })

/** CSS-pixel masks of the glyph and of the ink */
function masks() {
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c }
  const gc = mk(), ic = mk()
  const g = gc.getContext('2d', { willReadFrequently: true })!, i = ic.getContext('2d', { willReadFrequently: true })!
  paintGlyph(g, '#000')
  i.drawImage(cv.value!, 0, 0, W, H)
  const bits = (c: CanvasRenderingContext2D) => { const d = c.getImageData(0, 0, W, H).data, o = new Uint8Array(W * H); for (let n = 0; n < o.length; n++) o[n] = d[n * 4 + 3]! > 100 ? 1 : 0; return o }
  return { glyph: bits(g), ink: bits(i) }
}

const canCheck = computed(() => (word.value ? !!norm(typed.value) : inked.value))
function check() {
  if (props.locked || !canCheck.value) return
  let cov: number | undefined, pass = false
  if (!word.value && inked.value) { const { glyph, ink } = masks(); const s = scriptTraceScore(glyph, ink, W, H); cov = s.cov; pass = s.pass }
  const typedOk = !!norm(typed.value) && norm(typed.value) === norm(target.value)
  const ok = word.value ? typedOk : pass
  // pass = Good (Easy when done from memory and clean), fail = Again; the hint caps it at Good
  let sugg = ok ? ((!hinted.value && (typedOk || (cov ?? 0) >= 0.8)) ? 4 : 3) : 1
  if (hinted.value) sugg = Math.min(sugg, 3)
  emit('check', { ok, typed: typed.value, cov, hint: hinted.value, sugg })
}
onMounted(() => {
  if (!word.value) setup()
  else if (!window.matchMedia('(pointer: coarse)').matches) inp.value?.focus() // a hardware keyboard types at once; a phone uses the keys
})
defineExpose({ typed, check, canCheck, toggleHint, showHint, hinted, reveal })
</script>

<template>
  <div class="aw">
    <div v-if="!word" class="padwrap">
      <canvas ref="gcv" class="pad guide" />
      <canvas ref="cv" class="pad ink" @pointerdown.prevent="down" @pointermove="move" @pointerup="up" @pointercancel="up" />
      <button type="button" class="btn sm ghost clr" :disabled="!inked || locked" @click="clear">{{ t('lang.hy.clear') }}</button>
    </div>
    <template v-else>
      <input ref="inp" v-model="typed" :lang="c.lang" class="typed" type="text" inputmode="none" maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
        :disabled="locked" :placeholder="t('lang.hy.typeWord')" @keydown.enter.prevent="check">
      <div v-if="showHint && !locked" class="hintline muted">{{ t('lang.hy.translit') }}: {{ c.tr }}</div>
      <p v-if="c.lang === 'ru' && !locked" class="hintline faint">{{ t('lang.ru.looseNote') }}</p>
      <div v-if="!locked" class="kb">
        <div v-for="(row, i) in rows" :key="i" class="kbrow">
          <button v-for="k in row" :key="k" type="button" :lang="c.lang" class="key" @mousedown.prevent @click="type(k)">{{ k }}</button>
        </div>
        <div class="kbrow">
          <button type="button" class="key wide" @mousedown.prevent @click="type(' ')">{{ t('lang.hy.space') }}</button>
          <button type="button" class="key wide" :aria-label="t('lang.hy.backspace')" @mousedown.prevent @click="back"><Icon name="chevron-left" :size="16"/></button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.aw { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
.padwrap { position: relative; width: min(100%, 420px); }
.pad { display: block; width: 100%; height: min(220px, 30vh); color: var(--text); background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius); touch-action: none; user-select: none; -webkit-user-select: none; cursor: crosshair; }
.pad.guide { position: absolute; inset: 0; pointer-events: none; }
.pad.ink { position: relative; background: transparent; }
.clr { position: absolute; top: 6px; right: 6px; }
.typed { min-height: 46px; width: min(100%, 420px); box-sizing: border-box; text-align: center; font-size: 26px; background: none; color: var(--text); border: 0; border-radius: 0; border-bottom: 2px solid var(--accent); padding: 2px 8px; outline: 0; }
.typed::placeholder { font-size: 14px; color: var(--faint); }
.hintline { font-size: 14px; }
.kb { display: flex; flex-direction: column; gap: 6px; align-items: center; width: 100%; max-width: 440px; }
.kbrow { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; width: 100%; }
.key { min-width: 40px; flex: 0 1 auto; height: 44px; padding: 0 8px; font: inherit; font-size: 20px; border-radius: var(--radius-sm); border: 1px solid var(--line-2); background: var(--panel); color: var(--text); cursor: pointer; touch-action: manipulation; display: inline-flex; align-items: center; justify-content: center; }
.key:active { background: var(--accent-soft); }
.key.wide { min-width: 84px; font-size: 14px; }
@media (max-width: 420px) { .key { min-width: 36px; padding: 0 4px; } }
@media (pointer: coarse) { .key { height: 46px; } }
</style>
