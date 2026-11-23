<script setup lang="ts">
import type { Exercise } from '../utils/lang'
/** runs a list of exercises one after another; the result screen has a slot for what to do next */
const props = defineProps<{ exercises: Exercise[], cta?: string, lang?: string }>()
const emit = defineEmits<{ finish: [{ right: number, total: number }], continue: [{ right: number, total: number }] }>()
const at = ref(0)
const right = ref(0)
const fin = ref(false)
watch(() => props.exercises, () => { at.value = 0; right.value = 0; fin.value = false })
function done(ok: boolean) {
  if (ok) right.value++
  if (at.value + 1 >= props.exercises.length) { fin.value = true; emit('finish', { right: right.value, total: props.exercises.length }) }
  else at.value++
}
</script>

<template>
  <div class="prac">
    <template v-if="!fin">
      <div class="prog faint small">{{ at + 1 }} / {{ exercises.length }}</div>
      <LangExercise :key="at" :ex="exercises[at]!" :lang="lang" @done="done" />
    </template>
    <div v-else class="res">
      <b class="score" :class="right === exercises.length ? 'ok' : right ? 'warn' : 'bad'">{{ langT('lang.ex.score', { n: right, total: exercises.length }) }}</b>
      <button v-if="cta" type="button" class="btn primary go" @click="emit('continue', { right, total: exercises.length })">{{ cta }}</button>
      <slot :right="right" :total="exercises.length" />
    </div>
  </div>
</template>

<style scoped>
.prac { display: flex; flex-direction: column; gap: 10px; }
.res { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 0; text-align: center; }
.score { font-size: 20px; }
.score.ok { color: var(--ok); } .score.warn { color: var(--warn); } .score.bad { color: var(--bad); }
.go { min-height: 48px; min-width: 200px; }
</style>
