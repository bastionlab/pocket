// Routes $fetch('/api/...') to the handlers in app/local/*.ts instead of the network.
import { findLocal } from '~/local/registry'

const modules = import.meta.glob('../local/*.ts', { eager: true })
void modules // importing them runs their defineLocal() calls

export default defineNuxtPlugin(() => {
  const real = globalThis.$fetch
  const wrapped: any = async (url: any, opts: any = {}) => {
    const u = typeof url === 'string' ? url : String(url)
    if (!u.startsWith('/api/')) return real(url, opts)
    const [pathname, qs = ''] = u.split('?')
    const query: Record<string, string> = Object.fromEntries(new URLSearchParams(qs))
    for (const [k, v] of Object.entries(opts.query || opts.params || {})) if (v !== undefined && v !== null) query[k] = String(v)
    const method = String(opts.method || 'GET').toUpperCase()
    const hit = findLocal(method, pathname)
    if (!hit) { const e: any = new Error('No local route ' + method + ' ' + pathname); e.statusCode = 404; e.data = { statusMessage: 'Not available in Pocket' }; throw e }
    return structuredClone(await hit.fn({ query, body: opts.body, params: hit.params }) ?? null)
  }
  wrapped.raw = real.raw
  wrapped.create = real.create
  globalThis.$fetch = wrapped
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
})
