<script setup lang="ts">
/** a Japanese word with furigana: ruby segments from the deck (text + reading), built as elements, never as HTML */
const props = defineProps<{ v: { ja: string, ru?: [string, string | null][] }, ruby?: boolean }>()
</script>

<template>
  <span lang="ja" class="jw">
    <template v-if="ruby && v.ru"><template v-for="(s, i) in v.ru" :key="i"><ruby v-if="s[1]">{{ s[0] }}<rt>{{ s[1] }}</rt></ruby><template v-else>{{ s[0] }}</template></template></template>
    <template v-else>{{ props.v.ja }}</template>
  </span>
</template>

<style scoped>
rt { font-size: .42em; color: var(--muted); font-weight: 400; }
</style>
