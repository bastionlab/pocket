<script setup lang="ts">
import type { VocabItem } from '../utils/lang'
/** one word in the list: a state dot, the word, its meaning */
defineProps<{ w: VocabItem & { f?: string }, s: number, lang?: string }>()
const emit = defineEmits<{ pick: [] }>()
</script>

<template>
  <button type="button" class="row" @click="emit('pick')">
    <i class="dot-s" :class="`s${s}`" />
    <span :lang="w.f ? lang : 'ja'" class="ja">{{ w.f ?? w.ja }}</span>
    <span class="en muted small">{{ Array.isArray(w.en) ? w.en.join('; ') : w.en }}</span>
  </button>
</template>

<style scoped>
.row { width: 100%; display: grid; grid-template-columns: 10px minmax(0, 40%) minmax(0, 1fr); gap: 12px; align-items: center; padding: 9px 14px; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer; text-align: left; min-height: 44px; }
.row:hover { background: var(--panel-2); }
.ja { font-size: 17px; overflow-wrap: anywhere; }
.en { overflow-wrap: anywhere; }
.dot-s { width: 10px; height: 10px; border-radius: 50%; background: var(--panel-2); border: 1px solid var(--line-2); }
.dot-s.s1 { background: var(--warn); border-color: transparent; } .dot-s.s2 { background: var(--accent); border-color: transparent; } .dot-s.s3 { background: var(--ok); border-color: transparent; }
</style>
