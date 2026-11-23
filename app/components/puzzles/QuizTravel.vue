<script setup lang="ts">
import { QUESTIONS } from '../../utils/puzzles/quizTravel'

defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
</script>

<template>
  <PuzzlesQuiz game="quiz-travel" :questions="QUESTIONS" :day="day" @finish="emit('finish', $event)" />
</template>
