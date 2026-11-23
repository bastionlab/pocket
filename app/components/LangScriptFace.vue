<script setup lang="ts">
import type { HyItem } from '../utils/lang'
/** the back of an alphabet-language card (Armenian, Russian): meaning, transliteration, example with sound (shared by the study screen and the info sheet) */
const props = defineProps<{ c: HyItem & { lang?: string }, lang?: string }>()
const lg = computed(() => props.lang ?? props.c.lang)
</script>

<template>
  <div class="face">
    <div v-if="c.t === 'w'" class="mean">{{ c.en.join(', ') }}</div>
    <div class="sound">
      <span class="tr">{{ c.tr }}</span>
      <LangSpeak :text="c.t === 'l' ? c.id.replace(/^w:/, '') : c.f" :size="18" />
    </div>
    <div v-if="c.t === 'l'" class="mean small-mean">{{ c.en[0] }}</div>
    <div v-if="c.cat && c.t === 'w'" class="cat"><span class="pill">{{ c.cat }}</span></div>
    <div v-if="c.ex" class="ex" @click.stop>
      <span class="exw"><span :lang="lg" class="exf">{{ c.ex[0] }}</span><LangSpeak :text="c.ex[0]" :size="15" /></span>
      <span class="muted small">{{ c.ex[1] }}</span>
      <span class="small">{{ c.ex[2] }}</span>
    </div>
  </div>
</template>

<style scoped>
.face { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.mean { font-size: 20px; font-weight: 600; text-align: center; }
.small-mean { font-size: 15px; font-weight: 400; color: var(--muted); }
.sound { display: flex; align-items: center; gap: 6px; font-size: 22px; font-weight: 600; }
.cat { display: flex; justify-content: center; }
.ex { display: flex; flex-direction: column; gap: 2px; align-items: center; text-align: center; border-top: 1px solid var(--line); padding-top: 10px; width: 100%; }
.exf { font-size: 18px; }
.exw { display: inline-flex; align-items: center; gap: 4px; }
</style>
