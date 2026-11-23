<script setup lang="ts">
import type { Exercise } from '../utils/lang'
/** one grammar exercise (choice, fill the gap, put in order) with instant feedback and the reason */
const props = withDefaults(defineProps<{ ex: Exercise, lang?: string }>(), { lang: 'ja' })
const emit = defineEmits<{ done: [boolean] }>()

// Russian answers: stress marks (U+0301) don't count and ё = е
const norm = (s: string) => s.normalize('NFKC').replace(/[\s。、．，.,!?！？「」։՝՞՜՛\u0301]/g, '').toLowerCase().replace(/ё/g, 'е')
const answered = ref(false)
const right = ref(false)
const text = ref('')
const picked = ref<number[]>([]) // order: indexes into the shuffled tokens
const pool = ref<string[]>([])
watch(() => props.ex, (ex) => {
  answered.value = false; right.value = false; text.value = ''; picked.value = []
  const t = [...(ex.tokens ?? [])]
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j]!, t[i]!] }
  pool.value = t
}, { immediate: true })

// the data stores the answer as an option index (choice), a list of accepted answers (fill) or the tokens in order (order);
// a plain string ("x|y" for several) is accepted too
const accepted = computed<string[]>(() => {
  const { a, type, options } = props.ex as { a: unknown, type: string, options?: string[] }
  if (type === 'choice') return [typeof a === 'number' ? (options?.[a] ?? '') : String(a)]
  if (Array.isArray(a)) return type === 'order' ? [a.join('')] : a.map(String)
  return String(a ?? '').split('|')
})
const shown = computed(() => {
  const a = props.ex.a as unknown
  return Array.isArray(a) && props.ex.type === 'order' ? a.join(' ') : accepted.value[0] ?? ''
})
function settle(ok: boolean) { right.value = ok; answered.value = true }
const choose = (o: string) => { if (!answered.value) settle(o === accepted.value[0]) }
const check = () => {
  if (answered.value) return
  if (props.ex.type === 'fill') { if (text.value.trim()) settle(accepted.value.some(a => norm(a) === norm(text.value))) }
  else if (picked.value.length) settle(accepted.value.some(a => norm(a) === norm(picked.value.map(i => pool.value[i]).join(''))))
}
const built = computed(() => picked.value.map(i => pool.value[i]!))
const pick = (i: number) => { if (!answered.value && !picked.value.includes(i)) picked.value.push(i) }
const unpick = (n: number) => { if (!answered.value) picked.value.splice(n, 1) }
</script>

<template>
  <div class="ex">
    <div :lang="lang" class="q">{{ ex.q }}</div>

    <div v-if="ex.type === 'choice'" class="opts">
      <button v-for="o in ex.options" :key="o" type="button" class="btn opt" :lang="lang"
        :class="{ good: answered && o === accepted[0] }" :disabled="answered && o !== accepted[0]" @click="choose(o)">{{ o }}</button>
    </div>

    <div v-else-if="ex.type === 'fill'" class="fill">
      <input v-model="text" :lang="lang" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" :disabled="answered" :placeholder="langT('lang.ex.type')" @keydown.enter.prevent="check">
      <button v-if="!answered" type="button" class="btn primary" :disabled="!text.trim()" @click="check">{{ langT('lang.ex.check') }}</button>
    </div>

    <div v-else class="order">
      <div :lang="lang" class="line" :class="{ empty: !built.length }">
        <button v-for="(w, n) in built" :key="n" type="button" class="tok on" :disabled="answered" @click="unpick(n)">{{ w }}</button>
        <span v-if="!built.length" class="faint small">{{ langT('lang.ex.tapWords') }}</span>
      </div>
      <div :lang="lang" class="bank">
        <button v-for="(w, i) in pool" :key="i" type="button" class="tok" :class="{ used: picked.includes(i) }" :disabled="answered || picked.includes(i)" @click="pick(i)">{{ w }}</button>
      </div>
      <div v-if="!answered" class="row">
        <button type="button" class="lnk small" :disabled="!picked.length" @click="picked = []">{{ langT('lang.ex.reset') }}</button>
        <button type="button" class="btn primary" :disabled="!picked.length" @click="check">{{ langT('lang.ex.check') }}</button>
      </div>
    </div>

    <div v-if="answered" class="fb" :class="right ? 'ok' : 'bad'" role="status">
      <b>{{ right ? langT('lang.ex.right') : langT('lang.ex.wrong') }}</b>
      <span v-if="!right" :lang="lang" class="ans">{{ shown }}</span>
      <span v-if="ex.why" class="why">{{ ex.why }}</span>
      <button type="button" class="btn sm next" @click="emit('done', right)">{{ langT('lang.ex.next') }}</button>
    </div>
  </div>
</template>

<style scoped>
.ex { display: flex; flex-direction: column; gap: 12px; }
.q { font-size: 20px; line-height: 1.5; font-weight: 500; overflow-wrap: anywhere; }
.opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.opt { min-height: 44px; font-size: 17px; }
.opt.good { border-color: var(--ok); color: var(--ok); }
.fill { display: flex; gap: 8px; }
.fill input { flex: 1; min-width: 0; padding: 9px 12px; font-size: 18px; }
.line { min-height: 48px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px; border: 1px dashed var(--line-2); border-radius: var(--radius-sm); }
.bank { display: flex; flex-wrap: wrap; gap: 6px; }
.tok { font: inherit; font-size: 18px; min-height: 40px; padding: 0 12px; border-radius: var(--radius-sm); border: 1px solid var(--line-2); background: var(--panel); color: var(--text); cursor: pointer; }
.tok.on { background: var(--accent-soft); border-color: transparent; color: var(--accent); }
.tok.used { opacity: .3; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.fb { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid transparent; }
.fb.ok { background: var(--ok-soft); color: var(--ok); }
.fb.bad { background: var(--bad-soft); color: var(--bad); }
.ans { font-size: 17px; }
.why { flex-basis: 100%; color: var(--text); font-size: 13.5px; line-height: 1.5; }
.next { margin-left: auto; }
@media (pointer: coarse) { .tok { min-height: 44px; } }
</style>
