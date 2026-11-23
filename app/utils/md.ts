import { marked } from 'marked'

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// raw HTML inside markdown is shown as text, never rendered
marked.use({ renderer: { html: ({ text }: any) => esc(text) } })

export const md = (s: string) => marked.parse(s, { async: false }) as string
