/**
 * Crossword play rules (pure, tested in node): a word is judged the moment its last square is filled. A right word LOCKS
 * (its squares can no longer be changed), a wrong word is cleared again (except squares a locked word owns), so nothing
 * wrong is ever kept. Locks are derived from the letters: a slot whose letters equal its answer is locked, plus the squares
 * a hint revealed. Nothing else is stored, so a reload restores them.
 */
export interface PlaySlot { cells: number[] }

/** a slot's letters equal the solution (every square filled with the solution letter) */
export const slotRight = (solution: string[], letters: string[], s: PlaySlot) => s.cells.every(c => letters[c] === solution[c])
/** every square of a slot has a letter */
export const slotFull = (letters: string[], s: PlaySlot) => s.cells.every(c => !!letters[c])

/** the locked squares: those of every right word, and the ones a hint revealed */
export function lockedCells(solution: string[], slots: PlaySlot[], letters: string[], revealed: number[]): Set<number> {
  const out = new Set<number>()
  for (const c of revealed) if (letters[c] === solution[c]) out.add(c)
  for (const s of slots) if (slotRight(solution, letters, s)) for (const c of s.cells) out.add(c)
  return out
}

/** slots that are completely filled but not right */
export const wrongSlots = <S extends PlaySlot>(solution: string[], slots: S[], letters: string[]): S[] =>
  slots.filter(s => slotFull(letters, s) && !slotRight(solution, letters, s))

/** the squares of a wrong word that a reject clears: the ones no locked square protects */
export const clearable = (s: PlaySlot, locked: Set<number>) => s.cells.filter(c => !locked.has(c))

/** letters with every wrong full word cleared (reload, or old saves): returns a new array */
export function sanitize(solution: string[], slots: PlaySlot[], letters: string[], revealed: number[]): string[] {
  const out = [...letters]
  const locked = lockedCells(solution, slots, letters, revealed)
  for (const s of wrongSlots(solution, slots, letters)) for (const c of clearable(s, locked)) out[c] = ''
  return out
}

/** every word locked = solved */
export const allLocked = (solution: string[], slots: PlaySlot[], letters: string[]) => slots.every(s => slotRight(solution, letters, s))

/** the square a typed letter goes to: the selected one, or (it is locked) the next free one of the word; -1 = none */
export function targetCell(cells: number[], sel: number, locked: Set<number>): number {
  if (!locked.has(sel)) return sel
  const k = cells.indexOf(sel)
  return cells.slice(k + 1).find(c => !locked.has(c)) ?? -1
}

/** where the cursor goes after a letter: the next free empty square after `sel`, else the next free one, else stays */
export function advanceFrom(cells: number[], sel: number, locked: Set<number>, letters: string[]): number {
  const k = cells.indexOf(sel)
  const after = cells.slice(k + 1).filter(c => !locked.has(c))
  return after.find(c => !letters[c]) ?? after[0] ?? sel
}

/** backspace: the square to clear and the cursor's new place (`sel` stays when it holds a free letter) */
export function backFrom(cells: number[], sel: number, locked: Set<number>, letters: string[], busy: Set<number>): { sel: number, clear: number } {
  if (!locked.has(sel) && !busy.has(sel) && letters[sel]) return { sel, clear: sel }
  for (let j = cells.indexOf(sel) - 1; j >= 0; j--) {
    if (locked.has(cells[j])) continue
    return { sel: cells[j], clear: busy.has(cells[j]) ? -1 : cells[j] }
  }
  return { sel, clear: -1 }
}

/** the square the cursor takes when a word is entered: its first free empty square, else its first free one, else the first */
export const firstFree = (cells: number[], locked: Set<number>, letters: string[]) =>
  cells.find(c => !locked.has(c) && !letters[c]) ?? cells.find(c => !locked.has(c)) ?? cells[0]

/** the square a letter hint reveals: the selected one, or (locked / already right) the first free wrong square of the selected word; -1 = none */
export function hintTarget(cells: number[], sel: number, locked: Set<number>, letters: string[], solution: string[]): number {
  const open = (c: number) => !locked.has(c) && letters[c] !== solution[c]
  return sel >= 0 && open(sel) ? sel : (cells.find(open) ?? -1)
}
