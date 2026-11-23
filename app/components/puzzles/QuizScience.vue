<script setup lang="ts">
import { QUESTIONS } from '../../utils/puzzles/quizScience'

defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
</script>

<template>
  <PuzzlesQuiz game="quiz-science" :questions="QUESTIONS" :day="day" @finish="emit('finish', $event)" />
</template>
