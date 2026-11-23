/** the one-line feedback of a game (`msg` of <PuzzlesStage>): `say('Not in the word list')` shows it for a moment, then it clears */
export function usePuzzleNote(ms = 1800) {
  const note = ref('')
  const tone = ref<'ok' | 'warn' | 'bad'>('warn')
  let timer: ReturnType<typeof setTimeout> | undefined
  function say(msg: string, t: 'ok' | 'warn' | 'bad' = 'warn', dur = ms) {
    note.value = msg
    tone.value = t
    clearTimeout(timer)
    if (dur > 0) timer = setTimeout(() => { note.value = '' }, dur)
  }
  function clear() { clearTimeout(timer); note.value = '' }
  onBeforeUnmount(() => clearTimeout(timer))
  return { note, tone, say, clear }
}
