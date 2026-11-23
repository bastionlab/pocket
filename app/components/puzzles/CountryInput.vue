<script setup lang="ts">
import { findCountries } from '../../utils/puzzles/countries'

/**
 * Country search box (combobox): type to filter (accents, case and alternate names like USA / UK / Czech Republic work),
 * Up / Down / Enter / Escape or tap a row; the list opens upward when there is no room below. `exclude` = already guessed.
 */
const props = defineProps<{ exclude?: string[], disabled?: boolean }>()
const emit = defineEmits<{ pick: [code: string] }>()
const uid = `pzac-${Math.random().toString(36).slice(2, 8)}`
const root = ref<HTMLElement>()
const inp = ref<HTMLInputElement>()
const listEl = ref<HTMLElement>()
const q = ref('')
const open = ref(false)
const active = ref(0)
const up = ref(false)
const room = ref(276) // max height of the list: what is left above / below the field

const list = computed(() => findCountries(q.value, props.exclude ?? [], 8))
const showList = computed(() => open.value && !props.disabled && q.value.trim() !== '')
const current = computed(() => list.value[Math.min(active.value, list.value.length - 1)])

watch(q, () => { active.value = 0; if (q.value.trim()) { open.value = true; place() } })
watch(active, () => nextTick(() => listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })))

/** open upward when the list would run under the bottom of the screen (keyboard and tab bar included) */
function place() {
  const el = root.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vh = window.visualViewport?.height ?? window.innerHeight
  const bar = window.innerWidth <= 640 ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tabbar')) || 0 : 0
  const need = Math.min(Math.max(list.value.length, 1), 6) * 44 + 8
  const below = vh - r.bottom - bar
  up.value = below < need && r.top > below
  room.value = Math.max(132, Math.min(276, (up.value ? r.top : below) - 12))
}

function pick(code?: string) {
  if (!code || props.disabled) return
  emit('pick', code)
  q.value = ''
  open.value = false
  active.value = 0
  inp.value?.focus({ preventScroll: true })
}
function move(d: number) {
  if (!showList.value) { open.value = true; place(); return }
  const n = list.value.length
  if (n) active.value = (active.value + d + n) % n
}
function key(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  else if (e.key === 'Enter') { e.preventDefault(); pick(current.value?.code) }
  else if (e.key === 'Escape') { if (showList.value) { e.preventDefault(); open.value = false } else q.value = '' }
}
let t: ReturnType<typeof setTimeout> | undefined
const onBlur = () => { t = setTimeout(() => { open.value = false }, 150) }
const onFocus = () => { clearTimeout(t); if (q.value.trim()) { open.value = true; place() } }
onMounted(() => { if (!props.disabled && window.matchMedia('(hover: hover) and (pointer: fine)').matches) inp.value?.focus({ preventScroll: true }) }) // mouse + keyboard: type at once
onBeforeUnmount(() => clearTimeout(t))
</script>

<template>
  <div ref="root" class="cin" :class="{ up }">
    <div class="row">
      <div class="field">
        <input
          ref="inp" v-model="q" type="text" role="combobox" aria-autocomplete="list" :aria-expanded="showList" :aria-controls="`${uid}-l`"
          :aria-activedescendant="showList && current ? `${uid}-${current.code}` : undefined" :aria-label="$t('puzzles.typeCountry')"
          :placeholder="$t('puzzles.typeCountry')" :disabled="disabled" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
          @keydown="key" @focus="onFocus" @blur="onBlur" @click="onFocus"
        >
        <div v-show="showList" :id="`${uid}-l`" ref="listEl" class="list" role="listbox" :style="{ maxHeight: `${room}px` }" :aria-label="$t('puzzles.typeCountry')" @mousedown.prevent>
          <button
            v-for="(c, i) in list" :id="`${uid}-${c.code}`" :key="c.code" type="button" role="option" tabindex="-1" class="opt"
            :class="{ on: i === active }" :aria-selected="i === active" @mousemove="active = i" @click="pick(c.code)"
          >
            <PuzzlesCountryFlag :code="c.code" :w="32" />
            <span class="nm">{{ c.name }}</span>
          </button>
          <p v-if="!list.length" class="none">{{ $t('puzzles.geo.noMatch') }}</p>
        </div>
      </div>
      <button type="button" class="btn primary go" :disabled="disabled || !current" @click="pick(current?.code)">{{ $t('puzzles.geo.guess') }}</button>
    </div>
  </div>
</template>

<style scoped>
.cin { position: relative; width: 100%; }
.row { display: flex; gap: 8px; align-items: stretch; }
.field { position: relative; flex: 1; min-width: 0; }
input { width: 100%; box-sizing: border-box; min-height: 46px; }
.go { min-height: 46px; padding: 0 18px; font-size: 14px; }
.list { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 4px); overflow-y: auto; overscroll-behavior: contain; padding: 4px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel); box-shadow: 0 10px 28px rgba(0, 0, 0, .28); }
.up .list { top: auto; bottom: calc(100% + 4px); }
.opt { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 4px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.opt.on { background: var(--accent-soft); }
.nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.none { margin: 0; padding: 12px; color: var(--muted); font-size: 13px; }
@media (prefers-reduced-motion: no-preference) {
  .list { animation: cin-in .12s var(--ease-out) }
  .up .list { --dy: 4px; }
  @keyframes cin-in { from { opacity: 0; transform: translateY(var(--dy, -4px)); } }
}
</style>
