<script setup lang="ts">
/** a deck's counts and its Study button (the top of every deck tab) */
const props = defineProps<{ c: { new: number, learn: number, review: number }, grammar?: boolean, nextUp?: number }>()
const emit = defineEmits<{ study: [] }>()
const due = computed(() => props.c.learn + props.c.review + (props.grammar ? 0 : props.c.new))
</script>

<template>
  <section class="hero">
    <div class="counts">
      <div><b class="c-new">{{ c.new }}</b><span>{{ grammar ? langT('lang.suggested') : langT('lang.new') }}</span></div>
      <div><b class="c-learn">{{ c.learn }}</b><span>{{ langT('lang.learning') }}</span></div>
      <div><b class="c-rev">{{ c.review }}</b><span>{{ langT('lang.toReview') }}</span></div>
    </div>
    <button v-if="due" type="button" class="btn primary go" @click="emit('study')">{{ langT('lang.studyNow') }}</button>
    <div v-else class="muted small doneline">{{ langT('lang.doneToday') }}<template v-if="nextUp"> · {{ langT('lang.dueTomorrow', { n: nextUp }) }}</template></div>
  </section>
</template>

<style scoped>
.hero { background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius); padding: 16px 18px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.counts { display: flex; gap: 22px; flex: 1; }
.counts > div { display: flex; flex-direction: column; }
.counts b { font-size: 26px; font-weight: 650; line-height: 1.1; }
.counts span { font-size: 12px; color: var(--muted); }
.c-new { color: var(--accent); } .c-learn { color: var(--bad); } .c-rev { color: var(--ok); }
.go { min-height: 44px; padding: 0 22px; font-size: 15px; }
.doneline { font-size: 13px; }
@media (max-width: 640px) { .go { width: 100%; } .counts { justify-content: space-around; } }
</style>
