<script setup lang="ts">
/**
 * on-screen QWERTY keyboard (buttons) + the physical keyboard on a PC. As wide as its parent (the stage), at most 520px,
 * centred; keys are 46px tall (44 at least).
 * `marks` colours keys by the best known state of a letter: g right place, y elsewhere, x not in it, r wrong guess.
 * `lock` disables the marked keys (hangman); `bare` drops Enter / Delete.
 * `quad` (Quordle) paints each key in four quarters instead, one state per board, in reading order.
 * The colours come from --c-hit / --c-near / --c-miss / --c-bad of the game around it (own defaults below, from the palette).
 */
const props = defineProps<{ marks?: Record<string, string>, quad?: Record<string, string[]>, disabled?: boolean, bare?: boolean, lock?: boolean }>()
const emit = defineEmits<{ key: [l: string], enter: [], back: [] }>()
const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

const locked = (l: string) => !!props.lock && !!props.marks?.[l]
const buzz = () => navigator.vibrate?.(10)
const letter = (l: string) => { buzz(); emit('key', l) }
const enter = () => { buzz(); emit('enter') }
const back = () => { buzz(); emit('back') }

function onKey(e: KeyboardEvent) {
  if (props.disabled || e.ctrlKey || e.metaKey || e.altKey) return
  if (/input|textarea|select/i.test((e.target as HTMLElement)?.tagName || '')) return
  if (e.key === 'Enter' && !props.bare) {
    e.preventDefault(); if (!e.repeat) emit('enter')
  } else if (e.key === 'Backspace' && !props.bare) emit('back')
  else if (/^[a-z]$/i.test(e.key)) {
    const l = e.key.toLowerCase()
    if (!locked(l)) emit('key', l)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="kb" :class="{ off: disabled }" role="group" :aria-label="$t('puzzles.words.keyboard')">
    <div v-for="(r, i) in rows" :key="i" class="row">
      <span v-if="i === 1" class="gap" />
      <span v-if="i === 2 && bare" class="gap big" />
      <button v-if="i === 2 && !bare" class="k wide" :disabled="disabled" @mousedown.prevent @click="enter">{{ $t('puzzles.enter') }}</button>
      <button v-for="l in r" :key="l" class="k" :class="[quad ? 'quad' : marks?.[l]]" :disabled="disabled || locked(l)" :aria-label="l" @mousedown.prevent @click="letter(l)">
        <span v-if="quad" class="q" aria-hidden="true"><i v-for="b in 4" :key="b" :class="quad[l]?.[b - 1]" /></span>
        <span class="ch">{{ l }}</span>
      </button>
      <button v-if="i === 2 && !bare" class="k wide" :disabled="disabled" :aria-label="$t('puzzles.delete')" @mousedown.prevent @click="back">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" /><path d="m18 9-6 6M12 9l6 6" /></svg>
      </button>
      <span v-if="i === 1" class="gap" />
      <span v-if="i === 2 && bare" class="gap big" />
    </div>
  </div>
</template>

<style scoped>
.kb {
  --k-hit: var(--c-hit, var(--pz-c3)); --k-near: var(--c-near, var(--pz-c12)); --k-miss: var(--c-miss, color-mix(in oklab, var(--text) 8%, var(--panel)));
  --k-bad: var(--c-bad, var(--pz-c1)); --k-base: color-mix(in oklab, var(--text) 15%, var(--panel));
  width: 100%; max-width: 520px; margin: 0 auto; display: flex; flex-direction: column; gap: 6px; user-select: none; -webkit-user-select: none; touch-action: manipulation;
}
.row { display: flex; gap: 5px; }
.gap { flex: .5 1 0; }
.gap.big { flex: 1.5 1 0; }
.k { flex: 1 1 0; min-width: 0; height: 48px; padding: 0; display: grid; place-items: center; border: 0; border-radius: 7px; background: var(--k-base); color: var(--text); font: inherit; font-size: 16px; font-weight: 700; text-transform: uppercase; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.k.wide { flex: 1.5 1 0; font-size: 12px; letter-spacing: .02em; }
.k.g { background: var(--k-hit); color: var(--pz-ink); }
.k.y { background: var(--k-near); color: var(--pz-ink); }
.k.x { background: var(--k-miss); color: var(--faint); }
.k.r { background: var(--k-bad); color: var(--pz-ink); }
.k.quad { position: relative; overflow: hidden; }
.k .ch { position: relative; }
.k.quad .ch { text-shadow: 0 0 3px var(--panel), 0 0 5px var(--panel); }
.q { position: absolute; inset: 0; display: grid; grid-template: 1fr 1fr / 1fr 1fr; background: var(--k-base); }
.q i.g { background: var(--k-hit); }
.q i.y { background: var(--k-near); }
.q i.x { background: var(--k-miss); }
.k:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.k:disabled { cursor: default; opacity: .5; }
.k.g:disabled, .k.r:disabled { opacity: .85; }
.kb.off .k { opacity: .45; }
@media (prefers-reduced-motion: no-preference) {
  .k { transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .k:active:not(:disabled) { transform: scale(.92); }
}
@media (hover: hover) { .k:hover:not(:disabled):not(.g):not(.y):not(.x):not(.r):not(.quad) { background: color-mix(in oklab, var(--text) 22%, var(--panel)); } }
@media (max-width: 640px) and (max-height: 840px) { .k { height: 44px; } .kb { gap: 5px; } }
</style>
