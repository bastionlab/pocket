export const NOTE_KINDS = [
  { id: 'idea', label: 'Ideas', icon: 'lightbulb' },
  { id: 'todo', label: 'Todos', icon: 'list-checks' },
  { id: 'note', label: 'Notes', icon: 'note' },
  { id: 'link', label: 'Links', icon: 'link' },
  { id: 'journal', label: 'Journal', icon: 'book' },
] as const
/** <Icon> name for a note kind */
export const kindIcon = (k: string) => NOTE_KINDS.find(x => x.id === k)?.icon ?? 'note'

/** "3h ago" from a unix timestamp (s) */
export function noteAgo(ts?: number | null) {
  if (ts == null) return 'never'
  const s = Math.max(0, Date.now() / 1000 - ts)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return `${d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m` : `${Math.floor(s)}s`} ago`
}

/** shrink a pasted/dropped image to <=2000 px JPEG and store it locally; returns the name to attach to a note */
export async function uploadNoteImage(file: Blob) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  const g = c.getContext('2d')!
  g.fillStyle = '#fff' // transparent PNGs would turn black in a JPEG
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob: Blob = await new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('could not encode image'))), 'image/jpeg', 0.86))
  const { name } = await $fetch<{ name: string }>('/api/notes/image', { method: 'POST', body: { blob, type: 'image/jpeg' } })
  return name
}

const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/gm

/** "- [ ]" items: done / total */
export function taskCount(body: string) {
  let done = 0, total = 0
  for (const m of body.matchAll(TASK)) { total++; if (m[2] !== ' ') done++ }
  return { done, total }
}

/** flip the i-th checkbox in the markdown source */
export function toggleTask(body: string, i: number) {
  let n = 0
  return body.replace(TASK, (all, a, x, b) => (n++ === i ? `${a}${x === ' ' ? 'x' : ' '}${b}` : all))
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
function inline(s: string) {
  const codes: string[] = []
  let t = esc(s).replace(/`([^`]+)`/g, (_m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000` })
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i) => `<code>${codes[Number(i)]}</code>`)
}

/** small safe markdown subset -> html with clickable checkboxes (data-task = source order) */
export function noteHtml(body: string) {
  let n = 0
  const out: string[] = []
  let list: 'ul' | 'ol' | '' = ''
  let para: string[] = []
  let fence: string[] | null = null
  const flush = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = [] }
  const close = () => { if (list) out.push(`</${list}>`); list = '' }
  for (const line of body.split('\n')) {
    if (fence) {
      if (/^```/.test(line)) { out.push(`<pre><code>${esc(fence.join('\n'))}</code></pre>`); fence = null } else fence.push(line)
      continue
    }
    if (/^```/.test(line)) { flush(); close(); fence = []; continue }
    const li = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (li) {
      flush()
      const kind = /\d/.test(li[1]!) ? 'ol' : 'ul'
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind }
      const t = /^\[([ xX])\]\s+(.*)$/.exec(li[2]!)
      out.push(t
        ? `<li><input type="checkbox" data-task="${n++}"${t[1] !== ' ' ? ' checked' : ''}> ${inline(t[2]!)}</li>`
        : `<li>${inline(li[2]!)}</li>`)
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) { flush(); close(); const l = Math.min(6, h[1]!.length + 1); out.push(`<h${l}>${inline(h[2]!)}</h${l}>`); continue }
    if (!line.trim()) { flush(); close(); continue }
    close(); para.push(line)
  }
  if (fence) out.push(`<pre><code>${esc(fence.join('\n'))}</code></pre>`)
  flush(); close()
  return out.join('')
}
