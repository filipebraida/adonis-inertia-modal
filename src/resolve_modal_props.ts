/*
 * adonis-inertia-modal
 *
 * Resolves the adapter's prop wrappers (defer/optional/always) *inside*
 * `modal.props`. The AdonisJS Inertia adapter only processes these symbol-tagged
 * wrappers at the top level of the page props, and treats our `modal` prop as a
 * plain object — so deferred/optional props nested under `modal.props` would
 * otherwise be serialized as raw wrapper objects. We re-implement the same
 * categorization here, reading the adapter's own symbols so the two stay in
 * lockstep. Resolved values stay as plain data / models; the adapter serializes
 * the whole `modal` object afterwards. The wrappers the envelope cannot honour
 * are rejected instead — see `assertSupported`.
 */

import { symbols } from '@adonisjs/inertia'

const { ALWAYS_PROP, OPTIONAL_PROP, DEFERRED_PROP, TO_BE_MERGED, ONCE_PROP, SCROLL_PROP } = symbols

function isObject(value: unknown): value is Record<PropertyKey, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reject the Inertia v3 wrappers the modal envelope has no way to honour.
 *
 * `once()` and `scroll()` carry state the client can only act on through page
 * object fields the envelope doesn't have (`onceProps`, `scrollProps`), so we
 * would serialize the wrapper object itself into `modal.props` — the component
 * receives `{ value: [Function], onceKey, expiry, fresh }` instead of its data.
 * `defer(..., { rescue: true })` is the opposite failure: it resolves fine, but
 * the promise it makes (render a fallback instead of failing) is one the modal
 * client can't keep, so a rescued error would still take the reload down.
 *
 * `merge()` / `deepMerge()` unwrap cleanly but never merge: a reloaded modal
 * prop replaces the previous value wholesale (the stack's `updateProps` is a
 * shallow spread), so the accumulation the wrapper promises never happens. The
 * keyed and directional variants v5 added carry their intent in `MERGE_PREPEND`
 * and `MERGE_MATCH_ON`, two more fields the envelope has nowhere to put.
 * Accumulating props belong on the backdrop page, where the adapter's own
 * `mergeProps` / `matchPropsOn` reach the client intact.
 *
 * All three are silent today, which is the worst of the options — fail where
 * the mistake is written instead.
 */
function assertSupported(key: string, value: Record<PropertyKey, any>): void {
  const reject = (feature: string, hint: string): never => {
    throw new Error(
      `adonis-inertia-modal: ${feature} is not supported inside modal props ("${key}"). ${hint}`
    )
  }

  if (ONCE_PROP in value) {
    reject(
      'inertia.once()',
      'Its cache metadata travels in the page object, which the modal envelope does not carry. ' +
        'Pass the value directly, or put the once prop on the backdrop page.'
    )
  }

  if (SCROLL_PROP in value) {
    reject(
      'inertia.scroll()',
      'Infinite-scroll cursors travel in the page object, which the modal envelope does not carry. ' +
        'Render the infinite scroll on the backdrop page instead.'
    )
  }

  if (DEFERRED_PROP in value && value.rescue) {
    reject(
      'inertia.defer(..., { rescue: true })',
      'The modal client has no rescue slot to render. Drop the option and handle failures via ' +
        'modal.reload({ onError }).'
    )
  }

  if (TO_BE_MERGED in value) {
    reject(
      'inertia.merge() / inertia.deepMerge()',
      'A reloaded modal prop replaces the previous value instead of accumulating onto it, and ' +
        'the merge metadata travels in the page object, which the modal envelope does not carry. ' +
        'Put the accumulating prop on the backdrop page instead.'
    )
  }
}

export interface ResolveModalPropsOptions {
  /** True for a partial reload of specific modal props (cherry-pick). */
  partial?: boolean
  /** Modal prop names to include (relative to modal.props). */
  only?: string[]
  /** Modal prop names to exclude. */
  except?: string[]
}

export interface ResolvedModalProps {
  props: Record<string, unknown>
  /** group -> deferred prop names (for the client's <Deferred>). */
  deferred: Record<string, string[]>
}

/**
 * Expand dot-notation keys (e.g. `'stats.today'`) into nested objects.
 */
function nestDotProps(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    if (!key.includes('.')) {
      result[key] = value
      continue
    }
    const segments = key.split('.')
    const last = segments.pop()!
    let cursor = result
    for (const segment of segments) {
      if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
        cursor[segment] = {}
      }
      cursor = cursor[segment] as Record<string, unknown>
    }
    cursor[last] = value
  }
  return result
}

export async function resolveModalProps(
  input: Record<string, unknown>,
  options: ResolveModalPropsOptions = {}
): Promise<ResolvedModalProps> {
  const { partial = false, only, except } = options
  const deferred: Record<string, string[]> = {}
  const pending: Array<{ key: string; value: unknown | (() => unknown) }> = []

  const isCherryPicked = (key: string): boolean => {
    if (only) return only.includes(key)
    if (except) return !except.includes(key)
    return true
  }

  // Lazy props (deferred/optional) are only evaluated when explicitly requested
  // via `only` — never on a standard visit or an `except` reload (which would
  // defeat their laziness, diverging from the Inertia adapter).
  const isLazyRequested = (key: string): boolean => !!only && only.includes(key)

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      // Checked before any cherry-picking, so an unsupported wrapper is rejected
      // on every visit rather than only on the reloads that happen to request it.
      assertSupported(key, value)

      /**
       * Always props are included regardless of cherry-picking.
       */
      if (ALWAYS_PROP in value) {
        pending.push({ key, value: value.value })
        continue
      }

      /**
       * On a partial reload, skip props that weren't requested.
       */
      if (partial && !isCherryPicked(key)) {
        continue
      }

      if (DEFERRED_PROP in value) {
        if (partial) {
          if (isLazyRequested(key)) {
            pending.push({ key, value: value.compute })
          }
        } else {
          const group = value.group ?? 'default'
          deferred[group] = deferred[group] ?? []
          deferred[group].push(key)
        }
        continue
      }

      if (OPTIONAL_PROP in value) {
        // Only loaded on demand, when explicitly requested via `only`.
        if (partial && isLazyRequested(key)) {
          pending.push({ key, value: value.compute })
        }
        continue
      }

      pending.push({ key, value })
    } else {
      if (partial && !isCherryPicked(key)) {
        continue
      }
      pending.push({ key, value })
    }
  }

  const flat: Record<string, unknown> = {}
  await Promise.all(
    pending.map(async ({ key, value }) => {
      flat[key] = typeof value === 'function' ? await (value as () => unknown)() : value
    })
  )

  return { props: nestDotProps(flat), deferred }
}
