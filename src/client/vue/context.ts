/*
 * adonis-inertia-modal — Vue client
 */

import { inject, type Component, type InjectionKey, type ShallowRef } from 'vue'

import type { ModalEntry } from '../core/types.ts'
import type { PageInfo, PrefetchOptions, ReloadOptions, VisitOptions } from './types.ts'

export interface ModalContext {
  /** Reactive snapshot of the modal stack. */
  stack: ShallowRef<ModalEntry[]>
  /** Reactive current Inertia page (fed by ModalRoot). */
  page: ShallowRef<PageInfo>
  resolve: (name: string) => Promise<Component>
  visit: (href: string, options?: VisitOptions) => Promise<ModalEntry>
  visitModal: (href: string, options?: VisitOptions) => Promise<ModalEntry>
  close: (id: string) => void
  reload: (id: string, options?: ReloadOptions) => Promise<void>
  prefetch: (href: string, options?: PrefetchOptions) => Promise<void>
  /** Feed the current Inertia page into the context (called by ModalRoot). */
  syncPage: (page: PageInfo) => void
  navigate: (url: string) => void
}

export const modalStackKey: InjectionKey<ModalContext> = Symbol('adonis-inertia-modal/stack')

export function useModalStack(): ModalContext {
  const context = inject(modalStackKey)
  if (!context) {
    throw new Error('adonis-inertia-modal: install the modal plugin — app.use(modal, { resolve })')
  }
  return context
}

export const modalIndexKey: InjectionKey<number> = Symbol('adonis-inertia-modal/index')

export function useModalIndex(): number {
  return inject(modalIndexKey, -1)
}
