<script setup lang="ts">
import { isRandomDay } from '../../utils/puzzles/registry'
/**
 * A hint costs coins: the button shows the price, asks the server to spend it and emits `bought` only once it was
 * accepted (the game then reveals the hint and keeps it in its saved state). Disabled when the balance is too low.
 */
const props = defineProps<{ game: string, day: string, disabled?: boolean, label?: string }>()
const emit = defineEmits<{ bought: [] }>()
const { t } = usePuzzleI18n()
const { coins, hintCost, buyHint } = usePuzzleCoins()
const busy = ref(false)
const free = computed(() => isRandomDay(props.day)) // random games: hints are free practice
const cost = computed(() => hintCost(props.game))
const poor = computed(() => !free.value && coins.value < cost.value)

async function buy() {
  if (busy.value || props.disabled || poor.value) return
  busy.value = true
  try { if (await buyHint(props.game, props.day)) emit('bought') } finally { busy.value = false }
}
</script>

<template>
  <button type="button" class="btn sm ghost pzs-tool pz-hintbtn" :disabled="disabled || poor || busy" :aria-label="poor ? t('puzzles.coins.tooPoor', { n: cost }) : `${label || t('puzzles.hint.label')}, ${free ? t('puzzles.random.free') : t('puzzles.coins.price', { n: cost })}`" :title="poor ? t('puzzles.coins.tooPoor', { n: cost }) : undefined" @click="buy">
    <Icon :name="free ? 'lightbulb' : 'hand-coins'" :size="15" />
    <span>{{ label || t('puzzles.hint.label') }}</span>
    <b v-if="!free" class="num">{{ cost }}</b>
  </button>
</template>

<style scoped>
.pz-hintbtn b { font-weight: 700; color: var(--warn); }
.pz-hintbtn:disabled b { color: inherit; }
</style>
