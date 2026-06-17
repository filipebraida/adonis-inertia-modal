/*
 * adonis-inertia-modal — Vue client
 */

import { computed, type ComputedRef } from 'vue'

import type { ModalEntry, ModalOptions } from '../core/types.ts'
import { useModalIndex, useModalStack, type ModalContext } from './context.ts'
import type { ReloadOptions } from './types.ts'

export interface UseModalReturn {
  id: string
  props: Record<string, unknown>
  /** Validation errors shared by the server (Inertia `errors` prop). */
  errors: Record<string, string>
  /** Per-modal presentation config (slideover, position, ...). */
  config: ModalOptions
  isOpen: boolean
  index: number
  onTopOfStack: boolean
  close: () => void
  reload: (options?: ReloadOptions) => Promise<void>
  emit: (event: string, ...args: unknown[]) => void
  on: (event: string, callback: (...args: unknown[]) => void) => () => void
}

/** Stable empty-errors reference so consumers keying effects on `errors` don't churn. */
const EMPTY_ERRORS: Record<string, string> = {}

/**
 * Build the public modal instance from a stack entry + the stack context.
 */
function createModalInstance(entry: ModalEntry, ctx: ModalContext): UseModalReturn {
  return {
    id: entry.id,
    props: entry.props,
    errors: (ctx.page.value.props?.errors as Record<string, string>) ?? EMPTY_ERRORS,
    config: entry.config,
    isOpen: entry.isOpen,
    index: entry.index,
    onTopOfStack: entry.onTopOfStack,
    close: () => ctx.close(entry.id),
    reload: (options) => ctx.reload(entry.id, options),
    emit: (event, ...args) => entry.emitter.emit(event, ...args),
    on: (event, callback) => entry.emitter.on(event, callback),
  }
}

/**
 * Resolve the modal instance for either a server modal (current render context)
 * or a local modal addressed by `name`. Returns a reactive ref (null when none
 * is open). Shared by <Modal> and <HeadlessModal>.
 */
export function useResolvedModal(name?: string): ComputedRef<UseModalReturn | null> {
  const ctx = useModalStack()
  const index = useModalIndex()

  return computed(() => {
    if (name) {
      const local = ctx.stack.value.find((item) => item.name === name && item.local && item.isOpen)
      return local ? createModalInstance(local, ctx) : null
    }

    const entry = ctx.stack.value[index]
    return entry && entry.isOpen ? createModalInstance(entry, ctx) : null
  })
}

/**
 * Access the modal instance for the component currently being rendered inside a
 * modal. Returns a reactive ref (null when not inside a modal).
 */
export default function useModal(): ComputedRef<UseModalReturn | null> {
  const ctx = useModalStack()
  const index = useModalIndex()

  return computed(() => {
    const entry = ctx.stack.value[index]
    return entry ? createModalInstance(entry, ctx) : null
  })
}
