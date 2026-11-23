import en from '~/utils/puzzles/en.json'

// Minimal stand-in for vue-i18n (English only): dotted keys, {name} params, "one | other" plurals on n.
const find = (key: string): string | undefined => {
  let v: any = en
  for (const p of key.split('.')) { v = v?.[p]; if (v === undefined) return undefined }
  return typeof v === 'string' ? v : undefined
}
export function usePuzzleI18n() {
  const te = (key: string) => find(key) !== undefined
  const t = (key: string, p: Record<string, any> | number = {}) => {
    let s = find(key)
    if (s === undefined) return key
    const params: Record<string, any> = typeof p === 'number' ? { n: p } : p
    if (s.includes(' | ')) { const [one, other] = s.split(' | '); s = Number(params.n ?? params.count) === 1 ? one! : (other ?? one!) }
    return s.replace(/\{(\w+)\}/g, (_m, k) => (params[k] ?? `{${k}}`))
  }
  return { t, te }
}
