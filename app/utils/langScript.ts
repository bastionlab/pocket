// Helpers for the alphabet languages with a letter trace pad and typed words (Armenian hy, Russian ru; first ported from the Armenian
// add-on, 2026-11-22): the on-screen keyboards, answer matching and the scoring of the letter trace pad. Pure functions,
// auto-imported with the rest of utils/.

import type { HyItem } from './lang'

/** the languages whose letter / word cards use the trace pad and the typing keyboard */
export const SCRIPT_LANGS = ['hy', 'ru']
export const isScript = (lang?: string) => SCRIPT_LANGS.includes(lang ?? '')

/** the on-screen keyboards, one array per row. hy: the lowercase alphabet in order plus the ligature և; ru: the standard ЙЦУКЕН layout */
export const SCRIPT_KEYS: Record<string, string[][]> = {
  hy: [[...'աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆ', 'և']],
  ru: [[...'йцукенгшщзхъ'], [...'фывапролджэ'], [...'ячсмитьбюё-']],
}
/** the Cyrillic stress mark (U+0301): shown on the display forms, never part of an answer */
export const RU_STRESS = /\u0301/g

/** what the learner has to produce for a card: a letter's lowercase glyph, a word as written */
export const scriptAnswer = (c: Pick<HyItem, 't' | 'f' | 'id'>) => (c.t === 'l' ? c.id.replace(/^w:/, '') : c.f)
/** case, spacing and composition don't count; Russian also ignores stress marks and reads ё as е */
export const scriptNorm = (lang: string | undefined, s: string) => {
  let o = s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
  if (lang === 'ru') o = o.replace(RU_STRESS, '').replace(/ё/g, 'е')
  return o
}
/** the font stack the trace pad paints the target glyph with (it has to cover the script) */
export const SCRIPT_FONT: Record<string, string> = {
  hy: "'Noto Sans Armenian', 'DejaVu Sans', sans-serif",
  ru: "system-ui, 'Noto Sans', 'Roboto', 'Segoe UI', 'DejaVu Sans', sans-serif",
}

/**
 * Scoring for the letter trace pad. Pure (masks in, numbers out) so it can be tested without a canvas.
 * glyph / ink = w*h masks (1 = painted). coverage = share of glyph pixels with ink within `near` px; spill = share of
 * ink pixels farther than `far` px from any glyph pixel; fat = ink area / glyph area (a scribble floods the glyph).
 */
export interface ScriptTraceScore { cov: number, spill: number, fat: number, pass: boolean }

/** grow a mask by r px in every direction (square window, two sliding passes) */
export function scriptDilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h)
  const pre = new Int32Array(Math.max(w, h) + 1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x]! + (m[y * w + x] ? 1 : 0)
    for (let x = 0; x < w; x++) tmp[y * w + x] = pre[Math.min(w, x + r + 1)]! - pre[Math.max(0, x - r)]! > 0 ? 1 : 0
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) pre[y + 1] = pre[y]! + tmp[y * w + x]!
    for (let y = 0; y < h; y++) out[y * w + x] = pre[Math.min(h, y + r + 1)]! - pre[Math.max(0, y - r)]! > 0 ? 1 : 0
  }
  return out
}

export function scriptTraceScore(glyph: Uint8Array, ink: Uint8Array, w: number, h: number, near = 14, far = 24): ScriptTraceScore {
  let g = 0, k = 0
  for (let i = 0; i < glyph.length; i++) { if (glyph[i]) g++; if (ink[i]) k++ }
  if (!g || !k) return { cov: 0, spill: k ? 1 : 0, fat: 0, pass: false }
  const inkNear = scriptDilate(ink, w, h, near), glyphFar = scriptDilate(glyph, w, h, far)
  let covered = 0, spilled = 0
  for (let i = 0; i < glyph.length; i++) {
    if (glyph[i] && inkNear[i]) covered++
    if (ink[i] && !glyphFar[i]) spilled++
  }
  const cov = covered / g, spill = spilled / k, fat = k / g
  return { cov, spill, fat, pass: cov >= 0.5 && spill <= 0.5 && fat <= 3 }
}
