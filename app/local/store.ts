// Tiny async key/value store on IndexedDB. Everything an add-on persists goes through this.
// Model each old SQL table as a key prefix, e.g. kv.set('habit:' + id, row), kv.list('habit:').
const DB = 'bastion-pocket'
const STORE = 'kv'
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export const kv = {
  get: <T = any>(k: string) => tx<T | undefined>('readonly', s => s.get(k)),
  set: (k: string, v: any) => tx('readwrite', s => s.put(v, k)).then(() => undefined),
  del: (k: string) => tx('readwrite', s => s.delete(k)).then(() => undefined),
  async list<T = any>(prefix: string): Promise<{ key: string, value: T }[]> {
    const db = await open()
    return new Promise((resolve, reject) => {
      const out: { key: string, value: T }[] = []
      const range = IDBKeyRange.bound(prefix, prefix + '￿')
      const c = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor(range)
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push({ key: String(cur.key), value: cur.value }); cur.continue() } else resolve(out) }
      c.onerror = () => reject(c.error)
    })
  },
  async delPrefix(prefix: string) { for (const { key } of await this.list(prefix)) await this.del(key) },
  async dump(): Promise<Record<string, any>> { const o: Record<string, any> = {}; for (const { key, value } of await this.list('')) o[key] = value; return o },
  async restore(data: Record<string, any>) { for (const [k, v] of Object.entries(data)) await this.set(k, v) },
  async clear() { await tx('readwrite', s => s.clear()) },
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
export const nowSec = () => Math.floor(Date.now() / 1000)
