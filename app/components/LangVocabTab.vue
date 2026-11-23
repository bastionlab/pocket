<script setup lang="ts">
import type { VocabItem } from '../utils/lang'
/** the Vocabulary tab: Study + the word list by lesson / word pack (colour = how well the word is known), tap = word sheet */
const props = defineProps<{ o: any, deck: string }>()
const emit = defineEmits<{ study: [], info: [string] }>()
const DECK = props.deck // the page keys this component by deck
const pack = DECK !== 'ja-vocab' // Armenian, Russian: the lessons are word packs
const lg = DECK.split('-')[0]
const d = computed(() => props.o.decks[DECK])
const status = computed<Record<string, number>>(() => props.o.status[DECK] ?? {})
const lesson = computed<number>(() => props.o.lesson.n)
const words = useLangDeck<VocabItem>(DECK)
const nextUp = computed(() => props.o.forecast?.[1] ?? 0)

const q = ref('')
const lessons = computed(() => {
  const m = new Map<number, VocabItem[]>()
  for (const w of words.value ?? []) { const l = effLesson(w.l); m.set(l, [...(m.get(l) ?? []), w]) }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
})
const found = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return []
  const ns = s.normalize('NFC')
  return (words.value ?? []).filter((w: any) => w.f
    ? w.f.toLowerCase().includes(ns) || (lg === 'ru' && w.f.normalize('NFC').replace(/\u0301/g, '').toLowerCase().includes(ns.replace(/\u0301/g, ''))) || w.tr.toLowerCase().includes(ns) || w.en.some((e: string) => e.toLowerCase().includes(s))
    : w.ja.includes(s) || w.r.includes(s) || w.en.toLowerCase().includes(s)).slice(0, 200)
})
const folded = ref<Record<number, boolean>>({})
const isOpen = (l: number) => folded.value[l] ?? l === lesson.value
const st = (id: string) => status.value[id] ?? 0
const seenIn = (ws: VocabItem[]) => ws.filter(w => st(w.id)).length
</script>

<template>
  <div>
    <LangDeckHero :c="d" :next-up="nextUp" @study="emit('study')" />
    <div class="filters"><input v-model="q" class="search" type="search" :placeholder="langT(pack ? 'lang.hy.searchWords' : 'lang.searchVocab')" enterkeyhint="search"></div>

    <Skeleton v-if="!words" kind="rows" :n="6" />
    <ul v-else-if="q.trim()" class="list box">
      <li v-for="w in found" :key="w.id"><LangWordRow :w="w" :s="st(w.id)" :lang="lg" @pick="emit('info', w.id)" /></li>
      <li v-if="!found.length" class="faint small none">{{ langT('lang.noMatch') }}</li>
    </ul>
    <template v-else>
      <section v-for="[l, ws] in lessons" :key="l" class="les">
        <button type="button" class="head" :aria-expanded="isOpen(l)" @click="folded[l] = !isOpen(l)">
          <Icon :name="isOpen(l) ? 'chevron-down' : 'chevron-right'" :size="16" />
          <b>{{ langT(pack ? 'lang.packN' : 'lang.lessonN', { n: l }) }}</b>
          <span class="faint small">{{ seenIn(ws) }} / {{ ws.length }}</span>
          <span v-if="l === lesson" class="pill accent">{{ langT('lang.current') }}</span>
          <span v-else-if="l > lesson" class="faint small">{{ langT('lang.locked') }}</span>
        </button>
        <ul v-if="isOpen(l)" class="list">
          <li v-for="w in ws" :key="w.id"><LangWordRow :w="w" :s="st(w.id)" :lang="lg" @pick="emit('info', w.id)" /></li>
        </ul>
      </section>
    </template>
    <div class="legend faint small"><i class="sw s0" /> {{ langT('lang.state.new') }} <i class="sw s1" /> {{ langT('lang.state.learning') }} <i class="sw s2" /> {{ langT('lang.young') }} <i class="sw s3" /> {{ langT('lang.matureWord') }}</div>
  </div>
</template>

<style scoped>
.filters { display: flex; margin-bottom: 10px; }
.search { flex: 1; min-width: 0; padding: 7px 12px; }
.les, .box { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); overflow: hidden; margin-bottom: 8px; }
.head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer; text-align: left; min-height: 48px; }
.list { list-style: none; margin: 0; padding: 0; }
.les .list { border-top: 1px solid var(--line); }
.list li + li { border-top: 1px solid var(--line); }
.none { padding: 12px 14px; }
.legend { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-left: 4px; }
.sw.s0 { background: var(--panel-2); border: 1px solid var(--line-2); }
.sw.s1 { background: var(--warn); } .sw.s2 { background: var(--accent); } .sw.s3 { background: var(--ok); }
</style>
