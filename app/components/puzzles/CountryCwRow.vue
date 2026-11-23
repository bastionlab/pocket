<script setup lang="ts">
import { CONTINENTS, fmtArea, fmtPop, isLandlocked, type Country } from '../../utils/puzzles/countries'
import { CW_TILES, type CwInfo, type CwTile } from '../../utils/puzzles/geo'

/** one Country Wordle guess: flag + name, then six tiles (green = same, yellow = close, grey = no); `noDir` hides the direction arrow (hard) */
const props = defineProps<{ c: Country, info: CwInfo, fresh?: boolean, noDir?: boolean }>()
const { t } = usePuzzleI18n()

const tiles = computed(() => CW_TILES.map((k) => {
  const { c, info } = props
  const km = t('puzzles.cw.km', { n: info.km.toLocaleString('en-US') })
  const v = { dist: km, sub: c.sub, border: info.border ? t('puzzles.cwg.yes') : t('puzzles.cwg.no'), pop: fmtPop(c.pop), area: fmtArea(c.area), land: isLandlocked(c) ? t('puzzles.cwg.landlocked') : t('puzzles.cwg.sea') }[k]
  // arrow = where the answer lies: a bearing for the distance, up / down for more / less
  const dir = k === 'dist' ? (props.noDir || info.same ? null : info.deg) : k === 'pop' || k === 'area' ? (info[k] === 'same' ? null : info[k] === 'higher' ? 0 : 180) : null
  const way = k === 'dist' ? (dir === null ? '' : t('puzzles.geo.dirAria', { d: info.deg })) : dir === null ? '' : t(dir === 0 ? 'puzzles.cwg.more' : 'puzzles.cwg.less')
  return { k, v, dir, tone: info.tone[k], aria: [t(`puzzles.cwg.tile.${k}`), v, k === 'sub' ? CONTINENTS[c.cont] : '', way, t(`puzzles.cwg.state.${info.tone[k]}`)].filter(Boolean).join(', ') }
}))
</script>

<template>
  <li class="cg" :class="{ win: info.same, fresh }">
    <div class="head">
      <PuzzlesCountryFlag :code="c.code" :w="34" />
      <b class="nm">{{ c.name }}</b>
      <span v-if="info.same" class="pill ok">{{ $t('puzzles.cw.correct') }}</span>
    </div>
    <div class="tiles">
      <div v-for="(x, i) in tiles" :key="x.k" class="tile" :class="x.tone" :style="{ '--i': i }" role="group" :aria-label="x.aria">
        <span class="lab" aria-hidden="true">{{ $t(`puzzles.cwg.tile.${x.k}`) }}</span>
        <b class="val" :class="{ num: x.k !== 'sub' && x.k !== 'land' && x.k !== 'border', sm: x.k === 'sub' || x.k === 'land' }" aria-hidden="true">
          {{ x.v }}<PuzzlesCountryDir v-if="x.dir !== null" :deg="x.dir" :size="14" />
        </b>
        <span v-if="x.k === 'sub'" class="cont" aria-hidden="true">{{ CONTINENTS[c.cont] }}</span>
      </div>
    </div>
  </li>
</template>

<style scoped>
.cg { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); list-style: none; min-width: 0; container-type: inline-size; }
.cg.win { border-color: var(--ok); }
.head { display: flex; align-items: center; gap: 10px; min-height: 40px; min-width: 0; }
.nm { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 64px; padding: 6px 4px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel); color: var(--muted); text-align: center; min-width: 0; }
.tile.ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.tile.warn { background: var(--warn-soft); border-color: var(--warn); color: var(--warn); }
.lab { font-size: 10px; line-height: 1; letter-spacing: .03em; text-transform: uppercase; opacity: .85; }
.val { display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 3px; font-size: 13px; line-height: 1.15; color: var(--text); overflow-wrap: anywhere; }
.val.sm { font-size: 11.5px; }
/* wide stage: all six tiles in one row; narrow: 3 x 2 */
@container (min-width: 500px) { .tiles { grid-template-columns: repeat(6, minmax(0, 1fr)); } .tile { min-height: 72px; } }
.cont { font-size: 10px; line-height: 1; color: var(--muted); }
@media (prefers-reduced-motion: no-preference) {
  .fresh { animation: cw-in .22s var(--ease-out); }
  .fresh .tile { animation: cw-tile .28s var(--ease-out) backwards; animation-delay: calc(var(--i) * 60ms + 60ms); }
  @keyframes cw-in { from { opacity: 0; transform: translateY(-8px); } }
  @keyframes cw-tile { from { opacity: 0; transform: scale(.88); } }
}
</style>
