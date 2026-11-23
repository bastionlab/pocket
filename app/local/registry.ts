// Local API: add-on "server" handlers that run in the browser.
// An add-on file app/local/<addon>.ts calls defineLocal('GET', '/api/habits', async ({ query }) => ...).
export interface LocalCtx { query: Record<string, string>; body: any; params: Record<string, string> }
export type LocalHandler = (ctx: LocalCtx) => any | Promise<any>
const table: { method: string, re: RegExp, keys: string[], fn: LocalHandler }[] = []

export function defineLocal(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, fn: LocalHandler) {
  const keys: string[] = []
  const re = new RegExp('^' + path.replace(/:([A-Za-z]+)/g, (_m, k) => { keys.push(k); return '([^/]+)' }) + '/?$')
  table.push({ method, re, keys, fn })
}

export function findLocal(method: string, pathname: string) {
  for (const r of table) {
    if (r.method !== method) continue
    const m = r.re.exec(pathname)
    if (m) return { fn: r.fn, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }
  }
  return null
}

// Throw this from a handler to make $fetch reject like an HTTP error would.
export class LocalError extends Error {
  statusCode: number
  data: any
  constructor(statusCode: number, message: string) { super(message); this.statusCode = statusCode; this.data = { statusMessage: message, message } }
}
