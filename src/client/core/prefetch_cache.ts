/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Bounded TTL cache for prefetched modal payloads, keyed by href+method+data.
 * Expired entries are swept on write and the map is capped (oldest evicted) so a
 * long-lived SPA with many `<ModalLink prefetch>` doesn't grow without bound.
 */

import type { ModalResponsePayload } from './types.ts'

const DEFAULT_TTL = 30000
const DEFAULT_MAX_SIZE = 50

export class PrefetchCache {
  #entries = new Map<string, { payload: ModalResponsePayload; expires: number }>()
  #maxSize: number

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.#maxSize = maxSize
  }

  static key(href: string, method?: string, data?: Record<string, unknown>): string {
    return `${method ?? 'get'}:${href}:${data ? JSON.stringify(data) : ''}`
  }

  /** Return a live (unexpired) payload, deleting it if it has expired. */
  get(key: string): ModalResponsePayload | undefined {
    const entry = this.#entries.get(key)
    if (!entry) {
      return undefined
    }
    if (entry.expires <= Date.now()) {
      this.#entries.delete(key)
      return undefined
    }
    return entry.payload
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  set(key: string, payload: ModalResponsePayload, cacheFor = DEFAULT_TTL): void {
    const now = Date.now()
    // Sweep expired entries.
    for (const [existingKey, entry] of this.#entries) {
      if (entry.expires <= now) {
        this.#entries.delete(existingKey)
      }
    }
    // Refresh insertion order if re-setting, then cap by evicting the oldest.
    this.#entries.delete(key)
    while (this.#entries.size >= this.#maxSize) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) {
        break
      }
      this.#entries.delete(oldest)
    }
    this.#entries.set(key, { payload, expires: now + cacheFor })
  }

  get size(): number {
    return this.#entries.size
  }
}
