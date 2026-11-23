<script setup lang="ts">
import { flagOf, flagSrc } from '../../utils/puzzles/countries'

/** a country's flag as a 4:3 image (emoji flags do not render on Windows); `w` is the width (px, or any CSS length such as `min(100%, 240px)`), `blur` softens it (Flaggle) */
const props = defineProps<{ code: string, w?: number | string, blur?: number }>()
const failed = ref(false)
watch(() => props.code, () => { failed.value = false })
</script>

<template>
  <span class="cflag" :class="{ soft: !!blur }" :style="{ '--w': typeof w === 'string' ? w : `${w ?? 28}px`, '--blur': `${blur ?? 0}px` }">
    <span v-if="failed" class="emo" aria-hidden="true">{{ flagOf(code) }}</span>
    <img v-else :src="flagSrc(code)" alt="" draggable="false" decoding="async" @error="failed = true">
  </span>
</template>

<style scoped>
.cflag { display: inline-block; flex: none; width: var(--w); aspect-ratio: 4 / 3; max-width: 100%; border-radius: 3px; overflow: hidden; line-height: 0; vertical-align: middle; background: var(--panel-2); outline: 1px solid var(--line-2); outline-offset: -1px; }
.cflag img { width: 100%; height: 100%; display: block; object-fit: cover; user-select: none; -webkit-user-drag: none; }
.cflag.soft img { filter: blur(var(--blur)); transform: scale(1.12); }
.emo { display: grid; place-items: center; width: 100%; height: 100%; font-size: 28px; line-height: 1; font-family: "Twemoji Country Flags", "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif; }
@media (prefers-reduced-motion: no-preference) {
  .cflag.soft img { transition: filter .5s var(--ease-out); }
}
</style>
