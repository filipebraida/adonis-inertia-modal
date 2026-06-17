/*
 * adonis-inertia-modal — React client
 */

import { useEffect, type ReactNode } from 'react'

import { useModalStack } from './context.ts'
import { useResolvedModal, type UseModalReturn } from './use_modal.ts'

export interface HeadlessModalProps {
  /** Render-prop receiving the modal instance; you supply the entire UI. */
  children: (modal: UseModalReturn) => ReactNode
  /** When set, binds to a local (client-only) modal opened via href="#name". */
  name?: string
}

/**
 * Like <Modal>, but renders no UI of its own. You get the modal instance
 * (props, close, reload, emit, config, ...) and build the dialog, backdrop,
 * transitions and accessibility yourself. Renders nothing when no modal is open.
 *
 * Headless has no built-in leave transition, so it hides as soon as the modal is
 * marked closing and removes the entry from the stack itself.
 */
export function HeadlessModal({ children, name }: HeadlessModalProps) {
  const modal = useResolvedModal(name)
  const { remove } = useModalStack()

  useEffect(() => {
    if (modal && !modal.isOpen) {
      remove(modal.id)
    }
  }, [modal?.isOpen, modal?.id, remove])

  if (!modal || !modal.isOpen) {
    return null
  }

  return <>{children(modal)}</>
}

export default HeadlessModal
