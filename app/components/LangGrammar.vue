<script setup lang="ts">
import type { GrammarPoint } from '../utils/lang'
/**
 * The Grammar tab: lessons → points → one point (explanation, examples with audio, practice, mark learned).
 * The open point is ?p=<id> in the URL, so the phone's back button returns to the list.
 */
const props = defineProps<{ lang: string, lesson: number }>()
const emit = defineEmits<{ changed: [], study: [] }>()
const t = langT
const route = useRoute(), router = useRouter()

type Status = { state: string, ivl: number, due: number, mature: boolean }
const data = ref<{ points: GrammarPoint[], status: Record<string, Status> } | null>(null)
const error = ref('')
async function load() {
  try { data.value = await $fetch('/api/lang/grammar', { query: { l: props.lang } }); error.value = '' } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
}
onMounted(load)
defineExpose({ load })

const pid = computed(() => (typeof route.query.p === 'string' ? route.query.p : ''))
const point = computed(() => data.value?.points.find(p => p.id === pid.value) ?? null)
const open = (id: string) => router.push({ query: { ...route.query, p: id } })
function back() { if (window.history.state?.back) router.back(); else router.replace({ query: { ...route.query, p: undefined } }) }

const lessons = computed(() => {
  const m = new Map<number, GrammarPoint[]>()
  for (const p of data.value?.points ?? []) { const l = effLesson(p.lesson); m.set(l, [...(m.get(l) ?? []), p]) }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
})
const folded = ref<Record<number, boolean>>({})
const isOpen = (l: number) => folded.value[l] ?? l === props.lesson
const st = (id: string) => data.value?.status[id]
const learnedIn = (pts: GrammarPoint[]) => pts.filter(p => st(p.id)).length
const tone = (id: string) => { const s = st(id); return !s ? 0 : s.state !== 'review' ? 1 : s.mature ? 3 : 2 }

// practice + learned
const practicing = ref(false)
const practiceKey = ref(0)
const busy = ref(false)
watch(pid, () => { practicing.value = false })
async function learn() {
  if (!point.value || busy.value) return
  busy.value = true
  try { await $fetch('/api/lang/action', { method: 'POST', body: { action: 'grammar-learn', lang: props.lang, k: point.value.id } }); await load(); emit('changed') } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
  finally { busy.value = false }
}
const { armed, arm } = useArm()
async function forget() {
  if (!point.value || !arm('forget')) return
  try { await $fetch('/api/lang/action', { method: 'POST', body: { action: 'forget', deck: `${props.lang}-grammar`, k: `g:${point.value.id}` } }); await load(); emit('changed') } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
}
</script>

<template>
  <div class="gr">
    <p v-if="error" class="errbox">{{ error }}</p>
    <Skeleton v-if="!data && !error" kind="rows" :n="5" />

    <!-- one point -->
    <template v-else-if="data && point">
      <button type="button" class="lnk back" @click="back"><Icon name="chevron-left" :size="16" />{{ langT('lang.grammar.all') }}</button>
      <Panel :title="point.title" :sub="langT('lang.lessonN', { n: effLesson(point.lesson) })">
        <p class="muted sum">{{ point.summary }}</p>
        <LangMd :md="point.explain" />
        <ul v-if="point.examples?.length" class="exs">
          <li v-for="(e, i) in point.examples" :key="i">
            <div class="ja"><span :lang="props.lang">{{ e.t }}</span><LangSpeak :text="e.t" :size="15" /></div>
            <div v-if="e.tr" class="tr muted small">{{ e.tr }}</div>
            <div class="en muted small">{{ e.en }}</div>
          </li>
        </ul>
      </Panel>

      <Panel v-if="point.exercises?.length" :title="langT('lang.grammar.practice')">
        <template v-if="practicing">
          <LangPractice :key="practiceKey" :exercises="point.exercises" :lang="props.lang">
            <button type="button" class="btn" @click="practiceKey++">{{ langT('lang.grammar.again') }}</button>
          </LangPractice>
        </template>
        <button v-else type="button" class="btn primary" @click="practicing = true">{{ langT('lang.grammar.start', { n: point.exercises.length }) }}</button>
      </Panel>

      <div class="learn">
        <template v-if="st(point.id)">
          <span class="pill ok">{{ langT('lang.grammar.learned') }}</span>
          <button type="button" class="btn sm" :class="{ sure: armed === 'forget' }" @click="forget">{{ armed === 'forget' ? langT('lang.sure') : langT('lang.reset') }}</button>
        </template>
        <template v-else>
          <button type="button" class="btn primary" :disabled="busy || effLesson(point.lesson) > lesson" @click="learn">{{ langT('lang.grammar.markLearned') }}</button>
          <span v-if="effLesson(point.lesson) > lesson" class="faint small">{{ langT('lang.grammar.reachLesson', { n: effLesson(point.lesson) }) }}</span>
        </template>
      </div>
    </template>

    <!-- lessons -->
    <template v-else-if="data">
      <p v-if="!data.points.length" class="empty-state">{{ langT('lang.grammar.empty') }}</p>
      <section v-for="[l, pts] in lessons" :key="l" class="les">
        <button type="button" class="head" :aria-expanded="isOpen(l)" @click="folded[l] = !isOpen(l)">
          <Icon :name="isOpen(l) ? 'chevron-down' : 'chevron-right'" :size="16" />
          <b>{{ langT('lang.lessonN', { n: l }) }}</b>
          <span class="faint small">{{ learnedIn(pts) }} / {{ pts.length }}</span>
          <span v-if="l === lesson" class="pill accent">{{ langT('lang.current') }}</span>
        </button>
        <ul v-if="isOpen(l)" class="pts">
          <li v-for="p in pts" :key="p.id">
            <button type="button" class="pt" @click="open(p.id)">
              <i class="dot-s" :class="`s${tone(p.id)}`" />
              <span class="tt"><b>{{ p.title }}</b><span class="muted small">{{ p.summary }}</span></span>
              <Icon name="chevron-right" :size="16" />
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.gr { display: flex; flex-direction: column; gap: 12px; }
.back { align-self: flex-start; display: inline-flex; align-items: center; gap: 2px; min-height: 32px; }
.sum { margin: 0 0 10px; }
.exs { list-style: none; margin: 12px 0 0; padding: 0; border-top: 1px solid var(--line); }
.exs li { padding: 9px 2px; border-bottom: 1px solid var(--line); }
.tr { margin-top: 1px; }
.ja { display: flex; align-items: center; gap: 4px; font-size: 18px; }
.learn { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.les { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); overflow: hidden; }
.head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer; text-align: left; min-height: 48px; }
.pts { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.pts li + li { border-top: 1px solid var(--line); }
.pt { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer; text-align: left; min-height: 52px; }
.pt:hover { background: var(--panel-2); }
.tt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.tt .small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dot-s { width: 10px; height: 10px; border-radius: 50%; flex: none; background: var(--panel-2); border: 1px solid var(--line-2); }
.dot-s.s1 { background: var(--warn); border-color: transparent; } .dot-s.s2 { background: var(--accent); border-color: transparent; } .dot-s.s3 { background: var(--ok); border-color: transparent; }
</style>
