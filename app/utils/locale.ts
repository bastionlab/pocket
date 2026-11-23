// Pocket: fixed English/UK formats (the dashboard's locale settings do not exist here).
const DATE = 'en-GB'
const NUM = 'en-GB'

/** a date (unix seconds, ms Date or ISO string) formatted for display */
export function fmtDate(t: number | string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (t == null || t === '') return '–'
  const d = t instanceof Date ? t : new Date(typeof t === 'number' && t < 1e12 ? t * 1000 : t)
  return isNaN(+d) ? String(t) : d.toLocaleString(DATE, opts)
}

/** a plain number with digit grouping */
export const fmtNum = (n: number | null | undefined, digits = 0) =>
  n == null ? '–' : n.toLocaleString(NUM, { maximumFractionDigits: digits })
