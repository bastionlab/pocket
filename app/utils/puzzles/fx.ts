/**
 * Small celebration / feedback effects shared by every game. Particles are short-lived absolutely positioned nodes on
 * document.body (so they never reflow the layout) animated with the Web Animations API (transform + opacity only) and
 * removed when done. Everything is a no-op on the server and with prefers-reduced-motion.
 */
const ok = () => typeof document !== 'undefined' && typeof Element !== 'undefined' && 'animate' in Element.prototype
  && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)

/** a theme colour (a CSS variable such as --ok) resolved on <body>, so skins and light/dark are followed */
const cssVar = (name: string, fallback = 'currentColor') => {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim()
  return v || fallback
}
const PALETTE = ['--accent', '--ok', '--warn', '--bad']
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

interface Spec { x: number, y: number, dx: number, dy: number, rot: number, size: number, color: string, round: boolean, ms: number, grav: number }

/** one fixed layer holding the particles; pointer-events none, removed once the last one finished */
function fly(list: Spec[]) {
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:2147483000;contain:strict'
  document.body.appendChild(layer)
  let left = list.length
  const done = () => { if (--left <= 0) layer.remove() }
  for (const p of list) {
    const n = document.createElement('i')
    n.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;width:${p.size}px;height:${p.round ? p.size : p.size * 0.45}px;`
      + `background:${p.color};border-radius:${p.round ? '50%' : '2px'};will-change:transform,opacity;`
    layer.appendChild(n)
    const a = n.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(-50%,-50%) translate(${p.dx}px,${p.dy}px) rotate(${p.rot / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(-50%,-50%) translate(${p.dx * 1.15}px,${p.dy + p.grav}px) rotate(${p.rot}deg) scale(.6)`, opacity: 0 },
    ], { duration: p.ms, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })
    a.onfinish = a.oncancel = done
  }
  // safety net in case the animations are cancelled by the browser (hidden tab)
  setTimeout(() => layer.remove(), 3000)
}

/** full-screen celebration; `x`/`y` are the viewport pixel the burst comes from (default: upper middle) */
export function confetti(opts: { x?: number, y?: number } = {}) {
  if (!ok()) return
  const colors = PALETTE.map(v => cssVar(v))
  const x = opts.x ?? innerWidth / 2, y = opts.y ?? innerHeight * 0.35
  const n = innerWidth < 640 ? 46 : 70
  fly(Array.from({ length: n }, () => {
    const ang = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(120, 360)
    return { x, y, dx: Math.cos(ang) * v, dy: Math.sin(ang) * v, rot: rnd(-540, 540), size: rnd(6, 11), color: colors[Math.floor(Math.random() * colors.length)]!, round: Math.random() < 0.3, ms: rnd(1100, 1800), grav: rnd(260, 420) }
  }))
}

/** particles flying out of an element (a mine, a completed row, a correct answer) */
export function burst(el: HTMLElement, opts: { color?: string, count?: number, spread?: number } = {}) {
  if (!ok() || !el) return
  const r = el.getBoundingClientRect()
  const x = r.left + r.width / 2, y = r.top + r.height / 2
  const spread = opts.spread ?? 70, n = opts.count ?? 14
  const color = opts.color ? (opts.color.startsWith('--') ? cssVar(opts.color) : opts.color) : cssVar('--accent')
  fly(Array.from({ length: n }, (_, k) => {
    const ang = (k / n) * Math.PI * 2 + rnd(-0.25, 0.25), v = rnd(spread * 0.5, spread)
    return { x, y, dx: Math.cos(ang) * v, dy: Math.sin(ang) * v, rot: rnd(-200, 200), size: rnd(4, 8), color, round: true, ms: rnd(450, 750), grav: rnd(10, 40) }
  }))
}

/** a quick left-right wobble: wrong answer, invalid move */
export function shake(el: HTMLElement) {
  if (!ok() || !el) return
  el.animate([
    { transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' },
    { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
  ], { duration: 380, easing: 'ease-out' })
}

/** a short pop: a cell filled, a word found */
export function pulse(el: HTMLElement) {
  if (!ok() || !el) return
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.3,1)' })
}

/** a colour glow that fades (opacity of an overlay: no repaint of the element itself); `color` may be a CSS variable name */
export function flash(el: HTMLElement, color?: string) {
  if (!ok() || !el) return
  const r = el.getBoundingClientRect()
  const c = color ? (color.startsWith('--') ? cssVar(color) : color) : cssVar('--accent')
  const n = document.createElement('i')
  n.setAttribute('aria-hidden', 'true')
  n.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background:${c};border-radius:6px;pointer-events:none;z-index:2147483000;opacity:0`
  document.body.appendChild(n)
  const a = n.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' })
  a.onfinish = a.oncancel = () => n.remove()
  setTimeout(() => n.remove(), 1500)
}
