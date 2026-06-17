/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Compute how long an element's leave transition/animation lasts, so the UI
 * layer can defer removing a closing modal until its exit animation finishes.
 * Returns 0 when there is no animation (or no DOM), which makes removal
 * effectively synchronous (and keeps tests under happy-dom snappy).
 */

function toMs(value: string): number {
  const v = value.trim()
  if (!v) return 0
  const n = Number.parseFloat(v)
  if (Number.isNaN(n)) return 0
  return v.endsWith('ms') ? n : n * 1000
}

function maxPair(durations: string, delays: string): number {
  const durs = durations.split(',').map(toMs)
  const dels = delays.split(',').map(toMs)
  let max = 0
  for (const [i, dur] of durs.entries()) {
    max = Math.max(max, dur + (dels[i] ?? 0))
  }
  return max
}

/**
 * Longest transition/animation time (ms) of `el` and the given descendants,
 * including delays. Used to schedule a closing modal's removal.
 */
export function leaveDurationMs(el: Element, ...extra: (Element | null | undefined)[]): number {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return 0
  }
  let max = 0
  for (const node of [el, ...extra]) {
    if (!node) continue
    const s = window.getComputedStyle(node)
    max = Math.max(
      max,
      maxPair(s.transitionDuration || '0s', s.transitionDelay || '0s'),
      maxPair(s.animationDuration || '0s', s.animationDelay || '0s')
    )
  }
  return max
}
