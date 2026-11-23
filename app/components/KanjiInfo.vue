<script setup lang="ts">
import { lvName, isKana } from '../utils/lang'
/** one kanji: everything on the card, stroke order and how the card is doing */
const props = defineProps<{ k: string, deck: string }>()
const emit = defineEmits<{ close: [], changed: [] }>()
const x = ref<any>(null)
const error = ref('')
async function load() {
  try { x.value = await $fetch('/api/lang/card', { query: { deck: props.deck, k: props.k } }); error.value = '' } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
}
watch(() => [props.k, props.deck], load, { immediate: true })

const { armed, arm } = useArm()
async function forget() {
  if (!arm('forget')) return
  try { await $fetch('/api/lang/action', { method: 'POST', body: { action: 'forget', deck: props.deck, k: props.k } }); await load(); emit('changed') } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
}
const fmt = (ts: number) => langDate(ts)
const ivl = (d: number) => (d < 30 ? `${d} d` : d < 365 ? `${(d / 30).toFixed(1)} mo` : `${(d / 365).toFixed(1)} y`)
const t = langT
const RATE = computed(() => ['', t('lang.again'), t('lang.hard'), t('lang.good'), t('lang.easy')])
const practice = ref(0)
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div class="sheet">
      <button type="button" class="btn ghost icon x" :aria-label="langT('lang.close')" @click="emit('close')"><Icon name="x" :size="16"/></button>
      <p v-if="error" class="errbox">{{ error }}</p>
      <template v-if="x">
        <div class="top">
          <div class="kj"><div lang="ja" class="kanji">{{ x.k }}</div><LangSpeak v-if="kjMain(x)" :text="kjMain(x)" :size="18" /></div>
          <KanjiStrokes v-if="!practice" :k="x.k" />
          <KanjiTrace v-else :key="practice" :k="x.k" guide />
        </div>
        <div class="practice">
          <button type="button" class="btn sm" @click="practice++">{{ practice ? langT('lang.again') : langT('lang.practiceWriting') }}</button>
          <button v-if="practice" type="button" class="lnk small" @click="practice = 0">{{ langT('lang.strokeOrder') }}</button>
        </div>
        <div class="pills">
          <span class="pill">{{ lvName(x.n) }}</span>
          <span class="pill">{{ langT('lang.strokesN', { n: x.s }) }}</span>
          <span v-if="x.card" class="pill accent">{{ langT(`lang.state.${x.card.state}`) }}</span>
          <span v-else class="pill">{{ langT('lang.state.new') }}</span>
        </div>
        <KanjiFace :c="x" />
        <div v-if="x.card" class="card small muted">
          <span>{{ langT('lang.interval') }} {{ x.card.state === 'review' ? ivl(x.card.ivl) : '–' }}</span>
          <span>{{ langT('lang.due') }} {{ fmt(x.card.due) }}</span>
          <span>{{ langT('lang.ease', { n: x.card.ease }) }}</span>
          <span>{{ langT('lang.reviewsLapses', { n: x.card.reps, l: x.card.lapses }) }}</span>
        </div>
        <div v-if="x.write" class="card small muted">
          <span>{{ langT('lang.writing') }}: {{ x.write.state === 'review' ? langT('lang.every', { t: ivl(x.write.ivl) }) : langT(`lang.state.${x.write.state}`) }}</span>
          <span>{{ langT('lang.writtenLapses', { n: x.write.reps, l: x.write.lapses }) }}</span>
        </div>
        <div v-if="x.history.length" class="hist faint small">
          <span v-for="(h, i) in x.history" :key="i" :class="{ bad: h.rating === 1 }" :title="fmt(h.ts)">{{ h.w ? `${langT('lang.writeShort')} ` : '' }}{{ RATE[h.rating] }}</span>
        </div>
        <div class="foot">
          <a v-if="!isKana(x.n)" class="lnk small" :href="`https://jisho.org/search/${encodeURIComponent(x.k)}%20%23kanji`" target="_blank" rel="noopener">{{ langT('lang.jisho') }}</a>
          <button v-if="x.card" type="button" class="btn sm" :class="{ sure: armed === 'forget' }" @click="forget">{{ armed === 'forget' ? langT('lang.sure') : langT('lang.reset') }}</button>
        </div>
      </template>
      <Skeleton v-else-if="!error" kind="lines" :n="2" />
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, .55); display: flex; justify-content: center; align-items: flex-start; padding: 5vh 16px; overflow-y: auto; }
.sheet { position: relative; width: 100%; max-width: 560px; background: var(--panel); border: 1px solid var(--line-2); border-radius: 16px; padding: 18px 20px 14px; display: flex; flex-direction: column; gap: 12px; }
.x { position: absolute; top: 8px; right: 8px; }
.top { display: flex; align-items: center; justify-content: center; gap: 24px; flex-wrap: wrap; }
.kj { display: flex; align-items: center; gap: 4px; }
.kanji { font-size: 100px; line-height: 1.1; font-family: 'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', sans-serif; }
.practice { display: flex; gap: 14px; align-items: center; justify-content: center; }
.pills { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.card { display: flex; flex-wrap: wrap; gap: 4px 14px; justify-content: center; }
.hist { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); padding-top: 10px; }
@media (max-width: 640px) { .scrim { padding: 12px 8px; } .sheet { padding: 16px 14px 12px; } }
</style>
