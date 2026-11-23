// Notes, in the browser: kv prefix `notes:`. One topic per note, no AI (rewrite/expand answer 400).
//   notes:seq            last used id
//   notes:n:<id>         the note record
//   notes:img:<name>     pasted image Blob
import { defineLocal, LocalError } from './registry'
import { kv, nowSec } from './store'

const KINDS = ['idea', 'todo', 'note', 'link', 'journal']
const STATES = ['active', 'done', 'archived']
const IMG_NAME = /^[a-f0-9]{24}\.jpg$/

const str = (v: any, max: number) => String(v ?? '').slice(0, max)
const imgs = (v: any) => (Array.isArray(v) ? v : []).map(String).filter(n => IMG_NAME.test(n)).slice(0, 20)
const cleanTopic = (t: any) => String(t ?? '').toLowerCase().trim().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 32)
const key = (id: number) => `notes:n:${id}`

const row = (r: any) => ({
  id: r.id, raw: r.raw, title: r.title, body: r.body, undo: r.prev != null, topic: r.topic, kind: r.kind,
  images: r.images, pinned: !!r.pinned, state: r.state, job: null, aiError: null, created: r.created, updated: r.updated,
})

async function get(id: number) {
  const r = await kv.get<any>(key(id))
  if (!r) throw new LocalError(404, 'no such note')
  return r
}
const dropImages = (names: string[]) => Promise.all(names.map(n => kv.del(`notes:img:${n}`)))

defineLocal('GET', '/api/notes', async () => {
  const all = (await kv.list<any>('notes:n:')).map(x => row(x.value))
  return { notes: all.sort((a, b) => b.id - a.id) }
})

defineLocal('POST', '/api/notes/action', async ({ body }) => {
  const action = str(body?.action, 20)
  if (!['add', 'edit', 'append', 'rewrite', 'expand', 'undo', 'delete'].includes(action)) throw new LocalError(400, `unknown action: ${action}`)
  if (action === 'rewrite' || action === 'expand') throw new LocalError(400, 'AI actions are not available in Pocket')

  if (action === 'add') {
    const raw = str(body.text, 50_000).trim()
    const images = imgs(body.images)
    if (!raw && !images.length) throw new LocalError(400, 'empty note')
    const id = ((await kv.get<number>('notes:seq')) ?? 0) + 1
    await kv.set('notes:seq', id)
    const t = nowSec()
    const r = { id, raw, title: raw.split('\n')[0]!.replace(/^#+\s*/, '').slice(0, 80), body: raw, prev: null, topic: '', kind: 'note', images, pinned: false, state: 'active', created: t, updated: t }
    await kv.set(key(id), r)
    return row(r)
  }

  const id = Math.round(Number(body?.id))
  if (!id) throw new LocalError(400, 'missing note id')
  const r = await get(id)

  if (action === 'delete') {
    await kv.del(key(id))
    await dropImages(r.images)
    return { ok: true }
  }
  if (action === 'undo') {
    if (r.prev == null) throw new LocalError(409, 'nothing to undo')
    Object.assign(r, { title: r.prev.title, body: r.prev.body, topic: r.prev.topic ?? '', kind: r.prev.kind, prev: null, updated: nowSec() })
    await kv.set(key(id), r)
    return row(r)
  }
  if (action === 'append') {
    const text = str(body.text, 50_000).trim()
    const images = imgs(body.images)
    if (!text && !images.length) throw new LocalError(400, 'nothing to add')
    r.prev = { title: r.title, body: r.body, topic: r.topic, kind: r.kind }
    if (text) { r.body = `${r.body}\n\n${text}`.trim(); r.raw = `${r.raw}\n\n${text}`.trim() }
    r.images = [...r.images, ...images]
    r.updated = nowSec()
    await kv.set(key(id), r)
    return row(r)
  }

  // edit
  const before = { title: r.title, body: r.body, topic: r.topic, kind: r.kind }
  if (body.title != null) r.title = str(body.title, 200).trim()
  if (body.body != null) r.body = str(body.body, 100_000)
  if (body.topic != null) r.topic = cleanTopic(body.topic)
  if (KINDS.includes(body.kind)) r.kind = body.kind
  if (body.pinned != null) r.pinned = !!body.pinned
  if (STATES.includes(body.state)) r.state = body.state
  if (body.images != null) {
    const next = imgs(body.images)
    await dropImages(r.images.filter((n: string) => !next.includes(n)))
    r.images = next
  }
  // a manual change of the text becomes the next undo step
  if ((body.body != null && r.body !== before.body) || (body.title != null && r.title !== before.title)) r.prev = before
  if (body.title != null || body.body != null || body.topic != null || KINDS.includes(body.kind) || body.images != null) r.updated = nowSec()
  await kv.set(key(id), r)
  return row(r)
})

// one pasted/dropped image (already shrunk by the page): a JPEG Blob, stored as-is
defineLocal('POST', '/api/notes/image', async ({ body }) => {
  const blob = body?.blob
  if (!(blob instanceof Blob) || !blob.size || blob.size > 8 * 2 ** 20) throw new LocalError(400, 'image is missing or over 8 MB')
  const name = `${[...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('')}.jpg`
  await kv.set(`notes:img:${name}`, blob)
  return { name }
})
