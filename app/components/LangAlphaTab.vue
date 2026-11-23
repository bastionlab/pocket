<script setup lang="ts">
import type { HyItem } from '../utils/lang'
/** the Alphabet tab (Armenian, Russian): Study, progress and the letter grid (colour = how well the letter is known); search by letter, sound or word */
const props = defineProps<{ deck: string, o: any }>()
const emit = defineEmits<{ study: [], info: [string] }>()
const d = computed(() => props.o.decks[props.deck])
const status = computed<Record<string, number>>(() => props.o.status[props.deck] ?? {})
const nextUp = computed(() => props.o.forecast?.[1] ?? 0)
const letters = useLangDeck<HyItem>(props.deck)
const lg = props.deck.split('-')[0] // the page keys this component by deck

const q = ref('')
const shown = computed(() => {
  const list = letters.value ?? []
  const s = q.value.trim().toLowerCase(), ns = s.normalize('NFC')
  if (!s) return list
  return list.filter(x => x.f.toLowerCase().includes(ns) || x.tr.toLowerCase().includes(s) || x.en.some(e => e.toLowerCase().includes(s))
    || (x.ex && (x.ex[0].includes(ns) || x.ex[1].toLowerCase().includes(s) || x.ex[2].toLowerCase().includes(s))))
})
const st = (k: string) => status.value[k] ?? 0
</script>

<template>
  <div>
    <LangDeckHero :c="d" :next-up="nextUp" @study="emit('study')" />

    <Panel :title="langT('lang.progress')" :id="`${props.deck}-progress`">
      <div class="lv">
        <span class="name">{{ langT('lang.tabs.alpha') }}</span>
        <div class="bar">
          <i class="seen" :style="{ width: `${d.total ? (100 * d.seen) / d.total : 0}%` }" />
          <i class="mat" :style="{ width: `${d.total ? (100 * d.mature) / d.total : 0}%` }" />
        </div>
        <span class="num small muted">{{ d.seen }}<span class="faint">/{{ d.total }}</span></span>
      </div>
      <div class="legend faint small"><i class="sw seen" /> {{ langT('lang.seen') }} <i class="sw mat" /> {{ langT('lang.mature21') }}</div>
    </Panel>

    <div class="filters">
      <input v-model="q" class="search" type="search" :placeholder="langT('lang.hy.searchAlpha')" enterkeyhint="search">
    </div>
    <div v-if="letters" class="kgrid">
      <button v-for="x in shown" :key="x.id" type="button" :lang="lg" :class="`s${st(x.id)}`" :title="`${x.tr}: ${x.en[0]}`" @click="emit('info', x.id)">{{ x.f }}</button>
    </div>
    <Skeleton v-else kind="lines" :n="4" />
    <p v-if="letters && !shown.length" class="faint small">{{ langT('lang.noMatch') }}</p>
    <div class="legend faint small"><i class="sw s0" /> {{ langT('lang.state.new') }} <i class="sw s1" /> {{ langT('lang.state.learning') }} <i class="sw s2" /> {{ langT('lang.young') }} <i class="sw s3" /> {{ langT('lang.matureWord') }}</div>
  </div>
</template>

<style scoped>
.lv { display: grid; grid-template-columns: 84px 1fr 74px; gap: 10px; align-items: center; }
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
.kgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 5px; }
.kgrid button { min-height: 52px; font: inherit; font-size: 22px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--panel); color: var(--faint); cursor: pointer; padding: 0; }
.kgrid button:hover { border-color: var(--line-2); }
.s1 { color: var(--warn) !important; background: var(--warn-soft) !important; border-color: transparent !important; }
.s2 { color: var(--accent) !important; background: var(--accent-soft) !important; border-color: transparent !important; }
.s3 { color: var(--ok) !important; background: var(--ok-soft) !important; border-color: transparent !important; }
.sw.s0 { background: var(--panel-2); border: 1px solid var(--line-2); }
.sw.s1 { background: var(--warn); } .sw.s2 { background: var(--accent); } .sw.s3 { background: var(--ok); }
</style>
