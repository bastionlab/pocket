<script setup lang="ts">
import { QUESTIONS } from '../../utils/puzzles/quizHistory'

defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
</script>

<template>
  <PuzzlesQuiz game="quiz-history" :questions="QUESTIONS" :day="day" @finish="emit('finish', $event)" />
</template>
