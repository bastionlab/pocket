<script setup lang="ts">
import { QUESTIONS } from '../../utils/puzzles/quizKnowledge'

defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
</script>

<template>
  <PuzzlesQuiz game="quiz-knowledge" :questions="QUESTIONS" :day="day" @finish="emit('finish', $event)" />
</template>
