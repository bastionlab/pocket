import { dayLabel } from '../utils/puzzles/registry'

/**
 * What a game hands to the page when it ends. `summary` is the one line the finish popup shows ("4 of 5 right");
 * `detail` is stored with the result (small JSON). `detail.share` is no longer used by the page.
 */
export interface PuzzleResult { solved: boolean, attempts: number, score: number, summary?: string, detail: { share?: string, [k: string]: unknown } }

const keyOf = (game: string, day: string) => `puzzles:${game}:${day}`
/** set once the saved state differs from a fresh board (so merely opening a game is not "in progress") */
const startedKey = (game: string, day: string) => `${keyOf(game, day)}:started`
/** the timer's seconds tick on their own: they do not make a game "started" */
const IGNORE = new Set(['sec'])
const fingerprint = (st: object) => JSON.stringify(st, (k, v) => (IGNORE.has(k) ? undefined : v))

export const hasPuzzleState = (game: string, day: string) => {
  try { return !!localStorage.getItem(keyOf(game, day)) } catch { return false }
}

/**
 * a board that was actually played on this device: it changed from its fresh state. A state saved before the marker
 * existed counts as started (the key is only written after a change, except for timer ticks).
 */
export const startedPuzzleState = (game: string, day: string) => {
  try {
    const flag = localStorage.getItem(startedKey(game, day))
    return flag ? flag === '1' : !!localStorage.getItem(keyOf(game, day))
  } catch { return false }
}

/** forget a game's saved board (the page's "Play again") */
export const resetPuzzleState = (game: string, day: string) => {
  try { localStorage.removeItem(keyOf(game, day)); localStorage.removeItem(startedKey(game, day)) } catch { /* blocked */ }
}

/** a game's in-progress state, kept in localStorage per game + day so a reload does not lose it (client only) */
export function usePuzzleState<T extends object>(game: string, day: string, init: () => T): T {
  let start = init()
  const key = keyOf(game, day)
  const fresh = fingerprint(start)
  try {
    const raw = localStorage.getItem(key)
    const saved = raw ? JSON.parse(raw) : null
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      // a board saved by an older version of the game may have another shape for a field: keep only fields that still
      // have the type of the fresh board (array / object / primitive), so a stale save cannot crash the game
      const kind = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)
      const ok: Record<string, unknown> = {}
      for (const k of Object.keys(saved)) {
        const f = (start as Record<string, unknown>)[k]
        if (f === undefined || f === null || saved[k] === null || kind(f) === kind(saved[k])) ok[k] = saved[k]
      }
      start = { ...start, ...ok }
    }
  } catch { /* private mode or corrupt: start fresh */ }
  const st = reactive(start) as T
  watch(st, () => {
    try {
      localStorage.setItem(key, JSON.stringify(st))
      localStorage.setItem(startedKey(game, day), fingerprint(st) !== fresh ? '1' : '0')
    } catch { /* full or blocked */ }
  }, { deep: true })
  return st
}

/** emits the result once it exists (also on load, when the game was already finished) */
export function useFinish(st: { res: PuzzleResult | null }, emit: (e: 'finish', r: PuzzleResult) => void) {
  watch(() => st.res, (r) => { if (r) emit('finish', r) }, { immediate: true })
}

/** counts seconds while the game is open, visible and not finished */
export function useTimer(st: { sec: number, res: PuzzleResult | null }) {
  let id: ReturnType<typeof setInterval> | undefined
  onMounted(() => { id = setInterval(() => { if (!st.res && document.visibilityState === 'visible') st.sec++ }, 1000) })
  onBeforeUnmount(() => clearInterval(id))
  return computed(() => `${Math.floor(st.sec / 60)}:${String(st.sec % 60).padStart(2, '0')}`)
}

/** share-text pieces: coloured squares as escapes so the source stays emoji-free */
export const SQ = { g: '\u{1F7E9}', y: '\u{1F7E8}', x: '⬛', w: '⬜', r: '\u{1F7E5}', b: '\u{1F7E6}', o: '\u{1F7E7}', p: '\u{1F7EA}' } as Record<string, string>
export const shareHead = (name: string, day: string, tail = '') => `${name} ${dayLabel(day)}${tail ? ' ' + tail : ''}`
