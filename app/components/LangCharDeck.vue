<script setup lang="ts">
import { lvName } from '../utils/lang'
import type { KanjiCard } from '../utils/lang'
/** the Kana and Kanji tabs: Study, level progress and the browse grid (colour = how well the card is known) */
const props = defineProps<{ deck: string, o: any }>()
const emit = defineEmits<{ study: [], info: [string] }>()
const d = computed(() => props.o.decks[props.deck])
const levels = computed<any[]>(() => props.o.levels[props.deck] ?? [])
const on = computed<number[]>(() => props.o.settings.decks[props.deck].levels ?? [])
const status = computed<Record<string, number>>(() => props.o.status[props.deck] ?? {})
const nextUp = computed(() => props.o.forecast?.[1] ?? 0)
const deck = useLangDeck<KanjiCard>(props.deck) // the page keys this component by deck

const lvl = ref<number>(0)
watch(() => props.deck, () => { lvl.value = levels.value[0]?.n ?? 5 }, { immediate: true })
const q = ref('')
const shown = computed(() => {
  const list = deck.value ?? []
  const s = q.value.trim().toLowerCase()
  if (!s) return list.filter(x => x.n === lvl.value)
  const ks = s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
  return list.filter(x => x.k === s || x.m.some(m => m.toLowerCase().includes(s))
    || [...x.on, ...x.kun].some(r => r.replace(/[.-]/g, '').startsWith(ks))).slice(0, 300)
})
const kanaGrid = computed(() => props.deck === 'ja-kana' && !q.value.trim())
const st = (k: string) => status.value[k] ?? 0
</script>

<template>
  <div>
    <LangDeckHero :c="d" :next-up="nextUp" @study="emit('study')" />
    <p v-if="!on.length" class="faint small off">{{ langT('lang.deckOff') }}</p>

    <Panel :title="langT('lang.progress')" :id="`${props.deck}-levels`">
      <div class="levels">
        <div v-for="l in levels.filter(x => x.n <= 5 || x.seen || on.includes(x.n))" :key="l.n" class="lv">
          <span class="name">{{ lvName(l.n) }}</span>
          <div class="bar">
            <i class="seen" :style="{ width: `${(100 * l.seen) / l.total}%` }" />
            <i class="mat" :style="{ width: `${(100 * l.mature) / l.total}%` }" />
          </div>
          <span class="num small muted">{{ l.seen }}<span class="faint">/{{ l.total }}</span></span>
        </div>
      </div>
      <div class="legend faint small"><i class="sw seen" /> {{ langT('lang.seen') }} <i class="sw mat" /> {{ langT('lang.mature21') }}</div>
    </Panel>

    <div class="filters">
      <input v-model="q" class="search" type="search" :placeholder="langT(props.deck === 'ja-kana' ? 'lang.searchKana' : 'lang.searchKanji')" enterkeyhint="search">
    </div>
    <div v-if="!q.trim() && levels.length > 1" class="chips">
      <button v-for="l in levels" :key="l.n" type="button" class="chip" :class="{ on: lvl === l.n }" @click="lvl = l.n">{{ lvName(l.n) }}</button>
    </div>
    <div v-if="deck" class="kgrid" :class="{ kana: kanaGrid }">
      <button v-for="x in shown" :key="x.k" type="button" lang="ja" :class="`s${st(x.k)}`" :title="x.m.join(', ')" @click="emit('info', x.k)">{{ x.k }}</button>
    </div>
    <Skeleton v-else kind="lines" :n="4" />
    <p v-if="deck && !shown.length" class="faint small">{{ langT('lang.noMatch') }}</p>
    <div class="legend faint small"><i class="sw s0" /> {{ langT('lang.state.new') }} <i class="sw s1" /> {{ langT('lang.state.learning') }} <i class="sw s2" /> {{ langT('lang.young') }} <i class="sw s3" /> {{ langT('lang.matureWord') }}</div>
  </div>
</template>

<style scoped>
.off { margin: -6px 0 12px; }
.levels { display: flex; flex-direction: column; gap: 8px; }
.lv { display: grid; grid-template-columns: 64px 1fr 74px; gap: 10px; align-items: center; }
.name { font-weight: 600; font-size: 13px; }
.bar { position: relative; height: 8px; border-radius: 8px; background: var(--track); overflow: hidden; }
.bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px; }
.seen { background: var(--accent); opacity: .45; }
.mat { background: var(--ok); }
.num { text-align: right; }
.legend { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-left: 4px; }
.sw.seen { opacity: .6; }
.filters { display: flex; gap: 8px; margin: 14px 0 8px; }
.search { flex: 1; min-width: 0; padding: 7px 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.kgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 5px; }
.kgrid button { aspect-ratio: 1; font: inherit; font-size: 22px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--panel); color: var(--faint); cursor: pointer; padding: 0; }
.kgrid.kana { grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); }
.kgrid button:hover { border-color: var(--line-2); }
.s1 { color: var(--warn) !important; background: var(--warn-soft) !important; border-color: transparent !important; }
.s2 { color: var(--accent) !important; background: var(--accent-soft) !important; border-color: transparent !important; }
.s3 { color: var(--ok) !important; background: var(--ok-soft) !important; border-color: transparent !important; }
.sw.s0 { background: var(--panel-2); border: 1px solid var(--line-2); }
.sw.s1 { background: var(--warn); } .sw.s2 { background: var(--accent); } .sw.s3 { background: var(--ok); }
</style>
