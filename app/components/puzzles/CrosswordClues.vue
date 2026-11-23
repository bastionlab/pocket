<script setup lang="ts">
import type { CwSlot } from '../../utils/puzzles/crossword'
/** the across / down clue lists of a crossword: the current clue is marked, locked (done) ones are struck through */
const props = defineProps<{ across: CwSlot[], down: CwSlot[], cur: CwSlot, done: Set<CwSlot>, follow?: boolean }>()
const emit = defineEmits<{ go: [s: CwSlot] }>()
const root = ref<HTMLElement | null>(null)
// `follow`: the lists scroll in their own box (beside the grid): keep the current clue in view without moving the page
watch(() => props.cur, () => {
  if (!props.follow) return
  nextTick(() => {
    const box = root.value?.parentElement
    const el = root.value?.querySelector<HTMLElement>('.li.on')
    if (!box || !el) return
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top < box.scrollTop) box.scrollTop = top - 8
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight + 8
  })
})
</script>

<template>
  <div ref="root" class="lists">
    <section v-for="(list, k) in [across, down]" :key="k">
      <h3>{{ $t(k ? 'puzzles.crossword.down' : 'puzzles.crossword.across') }}</h3>
      <button v-for="s in list" :key="s.n + s.dir" class="li" :class="{ on: s === cur, done: done.has(s) }" @click="emit('go', s)">
        <b class="num">{{ s.n }}</b><span>{{ s.clue }}</span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.lists { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.lists h3 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.li { display: flex; gap: 6px; width: 100%; min-height: 40px; padding: 6px 4px; border: 0; background: none; color: var(--text); font: inherit; font-size: 13px; text-align: left; border-radius: 6px; cursor: pointer; }
.li b { color: var(--muted); min-width: 16px; }
.li.on { background: var(--accent-soft); }
.li.done { opacity: .45; text-decoration: line-through; }
.side .lists, .lists.col { grid-template-columns: 1fr; gap: 8px; }
@media (max-width: 420px) { .lists { grid-template-columns: 1fr; } }
@media (pointer: fine) { .li { min-height: 30px; padding: 4px; } }
</style>
