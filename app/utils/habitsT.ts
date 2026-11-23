// Tiny stand-in for vue-i18n's useI18n() in Pocket: English only, `{name}` interpolation, keys as in the add-on's en.json.
import en from './habitsEn.json'

export function habitsT(key: string, vars: Record<string, any> | number = {}): string {
  if (typeof vars === 'number') vars = { n: vars, count: vars, _c: vars }
  let v: any = en
  for (const p of key.split('.')) v = v?.[p]
  if (typeof v !== 'string') return key
  if (v.includes(' | ')) { const parts = v.split(' | '); v = parts[(vars as any)._c === 1 ? 0 : 1] ?? parts[0]! }
  return v.replace(/\{(\w+)\}/g, (_m, k) => ((vars as any)[k] ?? `{${k}}`))
}
export const useHabitsI18n = () => ({ t: habitsT })
