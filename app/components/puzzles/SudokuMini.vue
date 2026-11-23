<script setup lang="ts">
defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
</script>

<template>
  <PuzzlesSudoku :day="day" mini @finish="emit('finish', $event)" />
</template>
