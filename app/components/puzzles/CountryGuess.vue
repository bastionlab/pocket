<script setup lang="ts">
import { CONTINENTS, fmtPop, type Country } from '../../utils/puzzles/countries'
import type { GuessInfo } from '../../utils/puzzles/geo'

/** one guess as a row: flag + name, then how close it is (distance, direction, continent, population); `compact` = name, distance, direction only */
defineProps<{ c: Country, info: GuessInfo, compact?: boolean, fresh?: boolean }>()
</script>

<template>
  <li class="cg" :class="{ win: info.same, fresh, compact }">
    <div class="head">
      <PuzzlesCountryFlag :code="c.code" :w="34" />
      <b class="nm">{{ c.name }}</b>
      <span v-if="info.same" class="pill ok">{{ $t('puzzles.cw.correct') }}</span>
      <template v-else-if="compact">
        <span class="km num" :class="info.kmTone">{{ $t('puzzles.cw.km', { n: info.km.toLocaleString('en-US') }) }}</span>
        <span class="dir" :aria-label="$t('puzzles.geo.dirAria', { d: info.deg })"><PuzzlesCountryDir :deg="info.deg" :size="18" /></span>
      </template>
    </div>
    <div v-if="!compact" class="tiles">
      <div class="tile" :class="info.kmTone" style="--i: 0">
        <span class="lab">{{ $t('puzzles.geo.col.dist') }}</span>
        <b class="val num">{{ $t('puzzles.cw.km', { n: info.km.toLocaleString('en-US') }) }}</b>
      </div>
      <div class="tile" :class="info.same ? 'ok' : 'neutral'" style="--i: 1" :aria-label="info.same ? $t('puzzles.cw.correct') : $t('puzzles.geo.dirAria', { d: info.deg })">
        <span class="lab">{{ $t('puzzles.geo.col.dir') }}</span>
        <b class="val"><Icon v-if="info.same" name="check" :size="18" /><PuzzlesCountryDir v-else :deg="info.deg" :size="20" /></b>
      </div>
      <div class="tile" :class="info.cont ? 'ok' : 'bad'" style="--i: 2">
        <span class="lab">{{ $t('puzzles.geo.col.cont') }}</span>
        <b class="val sm">{{ CONTINENTS[c.cont] }}</b>
      </div>
      <div class="tile" :class="info.popTone" style="--i: 3" :aria-label="`${fmtPop(c.pop)}: ${$t(`puzzles.cw.pop.${info.pop}`)}`">
        <span class="lab">{{ $t('puzzles.geo.col.pop') }}</span>
        <b class="val num">{{ fmtPop(c.pop) }}<PuzzlesCountryDir v-if="info.pop !== 'same'" :deg="info.pop === 'higher' ? 0 : 180" :size="13" /></b>
      </div>
    </div>
  </li>
</template>

<style scoped>
.cg { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); list-style: none; min-width: 0; }
.cg.win { border-color: var(--ok); }
.head { display: flex; align-items: center; gap: 10px; min-height: 40px; min-width: 0; }
.compact .head { min-height: 44px; }
.nm { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.km { font-size: 13px; font-weight: 600; white-space: nowrap; }
.km.ok, .tile.ok { color: var(--ok); }
.km.warn, .tile.warn { color: var(--warn); }
.km.bad, .tile.bad { color: var(--bad); }
.dir { display: inline-flex; width: 32px; justify-content: center; color: var(--accent); }
.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 54px; padding: 6px 4px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel); text-align: center; min-width: 0; }
.tile.ok { background: var(--ok-soft); border-color: var(--ok); }
.tile.warn { background: var(--warn-soft); border-color: var(--warn); }
.tile.bad { background: var(--bad-soft); border-color: var(--bad); }
.tile.neutral { color: var(--accent); }
.lab { font-size: 10px; line-height: 1; color: var(--muted); letter-spacing: .03em; text-transform: uppercase; }
.val { display: inline-flex; align-items: center; justify-content: center; gap: 3px; min-height: 20px; font-size: 13px; line-height: 1.15; }
.val.sm { font-size: 11.5px; }
@media (prefers-reduced-motion: no-preference) {
  .fresh { animation: cg-in .22s var(--ease-out); }
  .fresh .tile { animation: cg-tile .28s var(--ease-out) backwards; animation-delay: calc(var(--i) * 70ms + 60ms); }
  @keyframes cg-in { from { opacity: 0; transform: translateY(-8px); } }
  @keyframes cg-tile { from { opacity: 0; transform: scale(.88); } }
}
</style>
