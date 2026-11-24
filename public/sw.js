const CACHE = 'pocket-v2'
const SHELL = ['/', '/index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// network-first, cache fallback; same-origin GET only
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
  )
})

// --- habit reminder: best effort (Periodic Background Sync on installed Chrome Android only) ---
function kvOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bastion-pocket', 1)
    req.onupgradeneeded = () => { req.result.createObjectStore('kv') }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function kvReq(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction('kv', mode).objectStore('kv'))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
const pad2 = (n) => String(n).padStart(2, '0')

async function habitReminder() {
  const db = await kvOpen()
  const cfg = await kvReq(db, 'readonly', (s) => s.get('habits:remind'))
  if (!cfg || !cfg.on || !/^\d{2}:\d{2}$/.test(cfg.time || '')) return
  const now = new Date()
  if (now.getHours() * 60 + now.getMinutes() < Number(cfg.time.slice(0, 2)) * 60 + Number(cfg.time.slice(3, 5))) return
  const day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  if ((await kvReq(db, 'readonly', (s) => s.get('habits:remind:last'))) === day) return
  // same rule as app/local/habits.ts + utils/habits.ts: scheduled = daily or today's weekday (Mon = 0) in days; done = habits:c:<id>:<day>
  let text = 'Time to check your habits'
  try {
    const wd = (now.getDay() + 6) % 7
    const rows = await new Promise((resolve, reject) => {
      const out = []
      const c = db.transaction('kv', 'readonly').objectStore('kv').openCursor(IDBKeyRange.bound('habits:', 'habits:\uffff'))
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push([String(cur.key), cur.value]); cur.continue() } else resolve(out) }
      c.onerror = () => reject(c.error)
    })
    const done = new Set(rows.filter(([k]) => k.startsWith('habits:c:')).map(([k]) => k.slice(9)))
    const due = rows.filter(([k, v]) => k.startsWith('habits:h:') && v && !v.deleted && (v.freq === 'daily' || (v.days || []).includes(wd)))
    const left = due.filter(([, v]) => !done.has(`${v.id}:${day}`)).length
    if (due.length && left === 0) return
    if (left > 0) text = `${left} habit${left === 1 ? '' : 's'} left today`
  } catch { /* generic text */ }
  await kvReq(db, 'readwrite', (s) => s.put(day, 'habits:remind:last'))
  await self.registration.showNotification('Habits', { body: text, tag: 'habit-reminder', icon: '/icons/icon-192.png', data: { url: '/habits' } })
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'habit-reminder') e.waitUntil(habitReminder().catch(() => {}))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/habits'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : w)).catch(() => c)
      }
      return self.clients.openWindow(url)
    }),
  )
})
