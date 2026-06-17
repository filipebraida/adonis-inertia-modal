/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Body scroll-lock with reference counting. Stacked modals each acquire a lock;
 * the original `overflow` is captured on the first lock and restored only when
 * the last lock is released, so closing modals out of order can't leave the body
 * permanently locked (or unlock it while a modal is still open).
 */

let lockCount = 0
let originalOverflow = ''

/**
 * Lock body scroll while a modal is open. Returns an idempotent unlock function;
 * call it on close/unmount. No-op (and safe) outside a DOM environment.
 */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1

  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    lockCount -= 1
    if (lockCount <= 0) {
      lockCount = 0
      document.body.style.overflow = originalOverflow
    }
  }
}
