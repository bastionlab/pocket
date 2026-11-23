<script setup lang="ts">
/** one word (Genki, or an Armenian / Russian word / letter): written + read forms, meaning, audio and how its cards are doing */
const props = defineProps<{ id: string, deck: string }>()
const key = computed(() => vocabKey(props.deck, props.id))
const emit = defineEmits<{ close: [], changed: [] }>()
const t = langT
const x = ref<any>(null)
const error = ref('')
async function load() {
  try { x.value = await $fetch('/api/lang/card', { query: { deck: props.deck, k: key.value } }); error.value = '' } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
}
watch(() => [props.id, props.deck], load, { immediate: true })
const { armed, arm } = useArm()
async function forget() {
  if (!arm('forget')) return
  try { await $fetch('/api/lang/action', { method: 'POST', body: { action: 'forget', deck: props.deck, k: key.value } }); await load(); emit('changed') } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
}
const fmt = (ts: number) => langDate(ts)
const ivl = (n: number) => (n < 30 ? `${n} d` : n < 365 ? `${(n / 30).toFixed(1)} mo` : `${(n / 365).toFixed(1)} y`)
const lg = computed(() => props.deck.split('-')[0])
const stateName = (s: string) => t(`lang.state.${s}`)
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div class="sheet">
      <button type="button" class="btn ghost icon x" :aria-label="langT('lang.close')" @click="emit('close')"><Icon name="x" :size="16"/></button>
      <p v-if="error" class="errbox">{{ error }}</p>
      <template v-if="x">
        <template v-if="x.f">
          <div class="top"><div :lang="lg" class="w hyw">{{ x.f }}</div></div>
          <LangScriptFace :c="x" :lang="lg" />
        </template>
        <template v-else>
          <div class="top"><div class="w"><LangRuby :v="x" :ruby="true" /></div><LangSpeak :text="x.r" :size="18" /></div>
          <div v-if="x.r !== x.ja" lang="ja" class="rd muted">{{ x.r }}</div>
          <div class="mean">{{ x.en }}</div>
        </template>
        <div class="pills">
          <span v-if="x.t === 'l'" class="pill">{{ langT('lang.tabs.alpha') }}</span>
          <span v-else-if="x.f" class="pill">{{ langT('lang.packN', { n: x.l }) }}</span>
          <span v-else class="pill">{{ langT('lang.lessonN', { n: effLesson(x.l) }) }}</span>
          <span v-if="!x.f" class="pill">{{ x.cat }}</span>
          <span v-if="x.card" class="pill accent">{{ stateName(x.card.state) }}</span>
          <span v-else class="pill">{{ langT('lang.state.new') }}</span>
        </div>
        <div v-if="x.card" class="card small muted">
          <span>{{ langT('lang.interval') }} {{ x.card.state === 'review' ? ivl(x.card.ivl) : '–' }}</span>
          <span>{{ langT('lang.due') }} {{ fmt(x.card.due) }}</span>
          <span>{{ langT('lang.reviewsLapses', { n: x.card.reps, l: x.card.lapses }) }}</span>
        </div>
        <div v-if="x.write" class="card small muted">
          <span>{{ langT(x.t === 'l' ? 'lang.writing' : 'lang.production') }}: {{ x.write.state === 'review' ? langT('lang.every', { t: ivl(x.write.ivl) }) : stateName(x.write.state) }}</span>
        </div>
        <div class="foot">
          <span />
          <button v-if="x.card" type="button" class="btn sm" :class="{ sure: armed === 'forget' }" @click="forget">{{ armed === 'forget' ? langT('lang.sure') : langT('lang.reset') }}</button>
        </div>
      </template>
      <Skeleton v-else-if="!error" kind="lines" :n="2" />
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, .55); display: flex; justify-content: center; align-items: flex-start; padding: 5vh 16px; overflow-y: auto; }
.sheet { position: relative; width: 100%; max-width: 520px; background: var(--panel); border: 1px solid var(--line-2); border-radius: 16px; padding: 22px 20px 14px; display: flex; flex-direction: column; gap: 12px; text-align: center; }
.x { position: absolute; top: 8px; right: 8px; }
.top { display: flex; align-items: center; justify-content: center; gap: 4px; }
.w { font-size: 40px; line-height: 1.6; font-family: 'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', sans-serif; overflow-wrap: anywhere; }
.w.hyw { font-family: inherit; line-height: 1.3; }
.rd { font-size: 18px; }
.mean { font-size: 20px; font-weight: 600; }
.pills { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.card { display: flex; flex-wrap: wrap; gap: 4px 14px; justify-content: center; }
.foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); padding-top: 10px; }
@media (max-width: 640px) { .scrim { padding: 12px 8px; } .sheet { padding: 20px 14px 12px; } }
</style>
