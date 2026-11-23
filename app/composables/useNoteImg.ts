import { kv } from '../local/store'

// name -> object URL, shared by every <NoteImg>; revoked once nothing shows the image any more
const cache = new Map<string, { url: Promise<string>, refs: number }>()

export function acquireNoteImg(name: string) {
  let e = cache.get(name)
  if (!e) {
    e = { refs: 0, url: kv.get<Blob>(`notes:img:${name}`).then(b => (b ? URL.createObjectURL(b) : '')) }
    cache.set(name, e)
  }
  e.refs++
  return e.url
}
export function releaseNoteImg(name: string) {
  const e = cache.get(name)
  if (!e || --e.refs > 0) return
  cache.delete(name)
  e.url.then(u => u && setTimeout(() => URL.revokeObjectURL(u), 3000))
}

/** reactive object URL for a stored note image name ('' until loaded) */
export function useNoteImg(name: () => string | undefined) {
  const url = ref('')
  let held = ''
  const drop = () => { if (held) releaseNoteImg(held); held = '' }
  watch(name, async (n) => {
    drop()
    if (!n) { url.value = ''; return }
    held = n
    const u = await acquireNoteImg(n)
    if (held === n) url.value = u
  }, { immediate: true })
  onBeforeUnmount(drop)
  return url
}
