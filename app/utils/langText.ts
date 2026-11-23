import en from './langText.json'

/** English UI strings of the Languages add-on (the dashboard's $t, minus the translation layer): langT('lang.packN', { n: 2 }) */
export function langT(key: string, p?: Record<string, any>): string {
  let v: any = en
  for (const part of key.replace(/^lang\./, '').split('.')) v = v?.[part]
  if (typeof v !== 'string') return key
  return p ? v.replace(/\{(\w+)\}/g, (_m, k) => String(p[k] ?? '')) : v
}

/** a date in the browser's own format (unix seconds, ms, or an ISO string) */
export function langDate(t: number | string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (t == null || t === '') return '–'
  const d = t instanceof Date ? t : new Date(typeof t === 'number' && t < 1e12 ? t * 1000 : t)
  return isNaN(+d) ? String(t) : d.toLocaleString(undefined, opts)
}
