<script setup lang="ts">
/**
 * The finish popup: centred card on desktop, bottom sheet on phones. Esc, the close button and the backdrop close it,
 * focus moves in and Tab stays inside. The reward row counts up; it only exists when this session earned coins.
 */
const props = defineProps<{
  open: boolean
  solved: boolean
  name: string
  date: string
  summary?: string
  earned?: number
  bonus?: number
  streak?: number
  coins: number
  hasNext: boolean
  /** a random puzzle (`?r=<seed>`): no coins, no streak; the actions become Another random / Back to today */
  random?: boolean
}>()
const emit = defineEmits<{ close: [], next: [], all: [], replay: [], random: [], today: [] }>()
const { t } = usePuzzleI18n()

const card = ref<HTMLElement | null>(null)
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// count-up of the reward and of the balance
const shownEarned = ref(0)
const shownCoins = ref(props.coins)
let raf = 0
function countUp(to: number, from: number, set: (n: number) => void, delay: number, ms = 700) {
  if (reduced() || from === to) { set(to); return }
  set(from)
  const t0 = performance.now() + delay
  const tick = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - t0) / ms))
    set(Math.round(from + (to - from) * (1 - (1 - k) ** 3)))
    if (k < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

let lastFocus: HTMLElement | null = null
let prevOverflow = ''
watch(() => props.open, async (o) => {
  if (!import.meta.client) return
  cancelAnimationFrame(raf)
  if (o) {
    lastFocus = document.activeElement as HTMLElement | null
    prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const earned = props.earned ?? 0
    countUp(earned, 0, n => (shownEarned.value = n), 250)
    countUp(props.coins, props.coins - earned, n => (shownCoins.value = n), 250)
    await nextTick()
    card.value?.querySelector<HTMLElement>('[data-first]')?.focus({ preventScroll: true })
  } else {
    document.body.style.overflow = prevOverflow
    lastFocus?.focus?.({ preventScroll: true })
  }
}, { immediate: true })
onBeforeUnmount(() => { cancelAnimationFrame(raf); if (props.open && import.meta.client) document.body.style.overflow = prevOverflow })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close'); return }
  if (e.key !== 'Tab' || !card.value) return
  const f = [...card.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
  if (!f.length) return
  const first = f[0]!, last = f[f.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pz-fm">
      <div v-if="open" class="pz-fm" @click.self="emit('close')" @keydown="onKey">
        <div ref="card" class="pz-fm-card" :class="solved ? 'ok' : 'bad'" role="dialog" aria-modal="true" aria-labelledby="pz-fm-title" tabindex="-1">
          <button class="pz-fm-x" :aria-label="t('puzzles.finish.close')" @click="emit('close')"><Icon name="x" :size="18" /></button>
          <div class="pz-fm-head">
            <span class="pz-fm-ic"><Icon :name="solved ? 'trophy' : 'circle-x'" :size="26" /></span>
            <h2 id="pz-fm-title">{{ solved ? t('puzzles.result.solved') : t('puzzles.result.failed') }}</h2>
            <p class="muted">{{ name }} · {{ date }}</p>
            <p v-if="summary" class="pz-fm-sum">{{ summary }}</p>
          </div>

          <div v-if="!random" class="pz-fm-coins" :class="{ earned: !!earned }">
            <div v-if="earned" class="pz-fm-reward" role="status">
              <Icon name="hand-coins" :size="20" />
              <b class="num">{{ t('puzzles.finish.earned', { n: shownEarned }) }}</b>
              <span v-if="bonus" class="muted small">{{ t('puzzles.finish.bonus', { n: bonus }) }}</span>
            </div>
            <p v-if="earned && streak" class="pz-fm-streak small"><Icon name="flame" :size="13" />{{ t('puzzles.finish.streak', { n: streak }) }}</p>
            <p class="pz-fm-bal small muted">{{ t('puzzles.finish.balance') }} <b class="num">{{ shownCoins }}</b></p>
          </div>
          <p v-else class="pz-fm-free small muted">{{ t('puzzles.random.noCoins') }}</p>

          <div v-if="random" class="pz-fm-act">
            <button data-first class="btn primary" @click="emit('random')"><Icon name="refresh-cw" :size="16" />{{ t('puzzles.random.another') }}</button>
            <div class="pz-fm-row">
              <button class="btn" @click="emit('today')">{{ t('puzzles.random.back') }}</button>
              <button class="btn" @click="emit('all')">{{ t('puzzles.finish.all') }}</button>
            </div>
            <button class="btn ghost" @click="emit('replay')"><Icon name="rotate-ccw" :size="16" />{{ t('puzzles.result.replay') }}</button>
          </div>
          <div v-else class="pz-fm-act">
            <button v-if="hasNext" data-first class="btn primary" @click="emit('next')">{{ t('puzzles.result.next') }}<Icon name="arrow" :size="16" /></button>
            <button :data-first="hasNext ? undefined : ''" class="btn" :class="{ primary: !hasNext }" @click="emit('random')"><Icon name="refresh-cw" :size="16" />{{ t('puzzles.random.play') }}</button>
            <div class="pz-fm-row">
              <button class="btn" @click="emit('all')">{{ t('puzzles.finish.all') }}</button>
              <button class="btn ghost" @click="emit('replay')"><Icon name="rotate-ccw" :size="16" />{{ t('puzzles.result.replay') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pz-fm { position: fixed; inset: 0; z-index: 400; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, .5); }
.pz-fm-card { position: relative; width: min(100%, 400px); max-height: calc(100dvh - 32px); overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 24px 20px 20px; border: 1px solid var(--line-2); border-top: 3px solid var(--ok); border-radius: var(--radius); background: var(--panel); color: var(--text); box-shadow: 0 18px 50px rgba(0, 0, 0, .35); outline: none; }
.pz-fm-card.bad { border-top-color: var(--bad); }
.pz-fm-x { position: absolute; top: 6px; right: 6px; display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--muted); cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
@media (hover: hover) { .pz-fm-x:hover { background: var(--panel-2); color: var(--text); } }
.pz-fm-x:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.pz-fm-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.pz-fm-ic { display: grid; place-items: center; width: 52px; height: 52px; margin-bottom: 4px; border-radius: 50%; background: var(--ok-soft); color: var(--ok); }
.bad .pz-fm-ic { background: var(--bad-soft); color: var(--bad); }
.pz-fm-head h2 { margin: 0; font-size: 28px; font-weight: 700; line-height: 1.15; }
.pz-fm-head p { margin: 0; font-size: 13.5px; }
.pz-fm-sum { color: var(--text); font-weight: 500; margin-top: 6px !important; }
.pz-fm-coins { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); }
.pz-fm-reward { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px; color: var(--warn); }
.pz-fm-reward b { font-size: 24px; font-weight: 700; min-width: 5.5ch; text-align: center; }
.pz-fm-reward .muted { flex-basis: 100%; text-align: center; }
.pz-fm-streak { display: inline-flex; align-items: center; gap: 5px; margin: 0; color: var(--accent); }
.pz-fm-bal { margin: 0; }
.pz-fm-bal b { color: var(--text); }
.pz-fm-act { display: flex; flex-direction: column; gap: 8px; }
.pz-fm-act .btn { min-height: 44px; justify-content: center; }
.pz-fm-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pz-fm-free { margin: 0; text-align: center; }

.pz-fm-enter-active, .pz-fm-leave-active { transition: opacity var(--dur) var(--ease-out); }
.pz-fm-enter-active .pz-fm-card, .pz-fm-leave-active .pz-fm-card { transition: transform var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out); }
.pz-fm-enter-from, .pz-fm-leave-to { opacity: 0; }
.pz-fm-enter-from .pz-fm-card { transform: translateY(12px) scale(.97); opacity: 0; }
.pz-fm-leave-to .pz-fm-card { transform: translateY(8px) scale(.98); opacity: 0; }

@media (max-width: 640px) {
  .pz-fm { place-items: end center; padding: 0; }
  .pz-fm-card { width: 100%; max-width: none; max-height: 92dvh; border-radius: var(--radius) var(--radius) 0 0; border-left: 0; border-right: 0; border-bottom: 0; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }
  .pz-fm-enter-from .pz-fm-card, .pz-fm-leave-to .pz-fm-card { transform: translateY(40px); }
}
@media (prefers-reduced-motion: reduce) {
  .pz-fm-enter-active, .pz-fm-leave-active, .pz-fm-enter-active .pz-fm-card, .pz-fm-leave-active .pz-fm-card { transition: none; }
}
</style>
