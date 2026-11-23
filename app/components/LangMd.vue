<script setup lang="ts">
/** markdown from the deck data; md() shows any raw HTML as text */
const props = defineProps<{ md: string }>()
const html = computed(() => md(props.md))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="lmd" v-html="html" />
</template>

<style scoped>
.lmd { font-size: 14.5px; line-height: 1.6; overflow-wrap: anywhere; }
.lmd :deep(p) { margin: 0 0 .7em; }
.lmd :deep(ul), .lmd :deep(ol) { margin: 0 0 .7em; padding-left: 1.3em; }
.lmd :deep(table) { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; margin: 0 0 .8em; }
.lmd :deep(th), .lmd :deep(td) { border: 1px solid var(--line); padding: 4px 9px; text-align: left; }
.lmd :deep(code) { font-family: inherit; background: var(--panel-2); border-radius: 4px; padding: 0 4px; }
.lmd :deep(blockquote) { margin: 0 0 .7em; padding-left: 12px; border-left: 3px solid var(--line-2); color: var(--muted); }
.lmd :deep(h1), .lmd :deep(h2), .lmd :deep(h3), .lmd :deep(h4) { font-size: 1em; margin: 1em 0 .4em; }
</style>
