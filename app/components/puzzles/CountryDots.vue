<script setup lang="ts">
/** progress dots for a quiz: done rounds green / red, the current one outlined */
defineProps<{ n: number, i: number, log: boolean[] }>()
</script>

<template>
  <div class="dots" role="img" :aria-label="$t('puzzles.quiz.round', { n: Math.min(i + 1, n), of: n })">
    <i v-for="k in n" :key="k" :class="[k - 1 < log.length ? (log[k - 1] ? 'ok' : 'bad') : '', { cur: k - 1 === i && k - 1 >= log.length }]" />
  </div>
</template>

<style scoped>
.dots { display: flex; gap: 8px; align-items: center; }
.dots i { width: 14px; height: 14px; border-radius: 50%; background: var(--track); border: 2px solid transparent; box-sizing: border-box; }
.dots i.ok { background: var(--ok); }
.dots i.bad { background: var(--bad); }
.dots i.cur { background: transparent; border-color: var(--accent); }
@media (prefers-reduced-motion: no-preference) {
  .dots i { transition: background-color .2s var(--ease-out), border-color .2s var(--ease-out); }
}
</style>
