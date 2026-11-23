<script setup lang="ts">
/**
 * The shared game frame (docs: add-on CLAUDE.md, "Game frame"). One column that is exactly as wide as the shell's level
 * switch above it (the shell sets the width, see `max` / `fit` in the registry): a stats bar (label over value, left;
 * actions, right), the board, a fixed-height message line and the tools row. Nothing in it changes height while playing.
 *   <PuzzlesStage :stats="[{ label, value }]" :msg="toast" tone="warn">
 *     <template #actions><PuzzlesHintButton .../></template>
 *     <board: any element; width:100%, square boards use aspect-ratio:1>
 *     <template #tools><PuzzlesTool icon="undo-2" :label="$t('...')" @click="..."/></template>
 *   </PuzzlesStage>
 */
interface StageStat { label: string, value: string | number, tone?: 'ok' | 'warn' | 'bad' }
defineProps<{
  stats?: StageStat[]
  /** the one-line feedback under the board ("One away"). Pass '' to reserve the line; leave undefined to have none */
  msg?: string
  tone?: 'ok' | 'warn' | 'bad'
}>()
</script>

<template>
  <div class="pzs">
    <div v-if="stats?.length || $slots.actions" class="pzs-bar">
      <div class="pzs-stats">
        <div v-for="s in stats" :key="s.label" class="pzs-stat" :class="s.tone">
          <span class="pzs-lbl">{{ s.label }}</span>
          <b class="pzs-val">{{ s.value }}</b>
        </div>
      </div>
      <div v-if="$slots.actions" class="pzs-act"><slot name="actions" /></div>
    </div>
    <div class="pzs-board"><slot /></div>
    <p v-if="msg !== undefined" class="pzs-msg" :class="tone" role="status" aria-live="polite">{{ msg }}</p>
    <div v-if="$slots.tools" class="pzs-tools"><slot name="tools" /></div>
  </div>
</template>
