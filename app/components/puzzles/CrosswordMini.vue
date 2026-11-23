<script setup lang="ts">
/** the daily 5x5 mini: the shared crossword board at size 5 (its own game id, saves and results) */
defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
</script>

<template>
  <PuzzlesCrossword :day="day" :size="5" @finish="emit('finish', $event)" />
</template>
