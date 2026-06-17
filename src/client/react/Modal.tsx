/*
 * adonis-modal — React client
 */

import type { ReactNode } from 'react'

import { useModalStack } from './context.ts'
import useModal, { type UseModalReturn } from './use_modal.ts'

export interface ModalProps {
  children: ReactNode | ((modal: UseModalReturn) => ReactNode)
  /** When set, this is a local (client-only) modal opened via href="#name". */
  name?: string
  onClose?: () => void
  closeButton?: boolean
}

/**
 * Renders the modal overlay around its content.
 *
 * Note: this is a minimal overlay for the MVP. Native <dialog>, focus trapping
 * and full styling come in a later phase; slideover/position are applied as
 * class names here so they can be styled.
 */
function ModalShell({
  modal,
  children,
  onClose,
  closeButton = true,
}: {
  modal: UseModalReturn
} & Pick<ModalProps, 'children' | 'onClose' | 'closeButton'>) {
  const handleClose = () => {
    onClose?.()
    modal.close()
  }

  const isSlideover = modal.config.slideover === true
  const position = typeof modal.config.position === 'string' ? modal.config.position : undefined
  const panelClass = [
    'im-panel',
    isSlideover ? 'im-slideover' : 'im-modal',
    position ? `im-position-${position}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className="im-backdrop"
      data-modal-id={modal.id}
      data-modal-index={modal.index}
      onClick={handleClose}
    >
      <div
        className={panelClass}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {closeButton && (
          <button
            type="button"
            className="im-close-button"
            aria-label="Close"
            onClick={handleClose}
          >
            &times;
          </button>
        )}
        {typeof children === 'function' ? children(modal) : children}
      </div>
    </div>
  )
}

/**
 * Wraps a page's content so it renders as a modal. Without `name`, it reads the
 * current server modal from context. With `name`, it is a local modal that shows
 * when opened via a `#name` link / visitModal('#name').
 */
export function Modal({ children, name, onClose, closeButton }: ModalProps) {
  const stackContext = useModalStack()
  const serverModal = useModal()

  if (name) {
    const entry = stackContext.stack.find((item) => item.name === name && item.local && item.isOpen)
    if (!entry) {
      return null
    }
    const localModal: UseModalReturn = {
      id: entry.id,
      props: entry.props,
      errors: (stackContext.page.props?.errors as Record<string, string>) ?? {},
      config: entry.config,
      isOpen: entry.isOpen,
      index: entry.index,
      onTopOfStack: entry.onTopOfStack,
      close: () => stackContext.close(entry.id),
      reload: async () => {},
      emit: (event, ...args) => entry.emitter.emit(event, ...args),
      on: (event, callback) => entry.emitter.on(event, callback),
    }
    return (
      <ModalShell modal={localModal} onClose={onClose} closeButton={closeButton}>
        {children}
      </ModalShell>
    )
  }

  if (!serverModal || !serverModal.isOpen) {
    return null
  }

  return (
    <ModalShell modal={serverModal} onClose={onClose} closeButton={closeButton}>
      {children}
    </ModalShell>
  )
}
