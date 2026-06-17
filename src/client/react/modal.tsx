/*
 * adonis-inertia-modal — React client
 */

import { useEffect, useRef, type ReactNode } from 'react'

import { getConfigByType } from '../core/config.ts'
import { lockBodyScroll } from '../core/scroll_lock.ts'
import { leaveDurationMs } from '../core/transition.ts'
import { useModalStack } from './context.ts'
import { useResolvedModal, type UseModalReturn } from './use_modal.ts'

export interface ModalProps {
  children: ReactNode | ((modal: UseModalReturn) => ReactNode)
  /** When set, this is a local (client-only) modal opened via href="#name". */
  name?: string
  onClose?: () => void
  closeButton?: boolean
}

/**
 * Renders the modal using a native <dialog> element, which gives us focus
 * trapping, the top-layer/backdrop and Esc handling for free. Esc and
 * backdrop-clicks are gated by the `closeExplicitly` / `closeOnClickOutside`
 * config. Body scroll is locked while any modal is open.
 */
function ModalShell({
  modal,
  children,
  onClose,
  closeButton = true,
}: {
  modal: UseModalReturn
} & Pick<ModalProps, 'children' | 'onClose' | 'closeButton'>) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const { remove } = useModalStack()

  const closeExplicitly = modal.config.closeExplicitly === true
  const closeOnClickOutside = modal.config.closeOnClickOutside !== false
  const closedRef = useRef(false)

  const handleClose = () => {
    if (closedRef.current) {
      return
    }
    closedRef.current = true
    onClose?.()
    modal.close()
  }

  // Open the native dialog and move focus into it.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !modal.isOpen || dialog.open) {
      return
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal()
      // Ensure focus lands inside the dialog (some browsers keep it on the trigger).
      if (!dialog.contains(document.activeElement)) {
        dialog
          .querySelector<HTMLElement>('[autofocus], button, [href], input, select, textarea')
          ?.focus()
      }
    } else {
      dialog.open = true // jsdom/happy-dom fallback
    }
  }, [modal.isOpen])

  // When marked closing, play the leave transition (if any) on the panel, then
  // close the native dialog (proper top-layer/focus unwind) and remove the entry
  // (fires onAfterLeave). Removal is synchronous when no transition is defined.
  useEffect(() => {
    if (modal.isOpen) {
      return
    }
    const dialog = dialogRef.current
    const panel = dialog?.querySelector<HTMLElement>('.im-panel') ?? null
    const finish = () => {
      if (dialog?.open) {
        try {
          dialog.close()
        } catch {
          dialog.open = false
        }
      }
      remove(modal.id)
    }
    const ms = dialog ? leaveDurationMs(dialog, panel) : 0
    if (ms <= 0) {
      finish()
      return
    }
    dialog?.setAttribute('data-leaving', '')
    const timer = setTimeout(finish, ms + 20)
    return () => clearTimeout(timer)
  }, [modal.isOpen, modal.id, remove])

  // Close on Esc for the top-most modal (unless closeExplicitly). Handled at the
  // document level so it works regardless of where focus currently is.
  useEffect(() => {
    if (!modal.onTopOfStack || typeof document === 'undefined') {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeExplicitly) {
        event.preventDefault()
        handleClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.onTopOfStack, closeExplicitly])

  // Lock body scroll while open; ref-counted so stacked modals restore the
  // original value only once the last one closes.
  useEffect(() => lockBodyScroll(), [])

  const isSlideover = modal.config.slideover === true
  // Shown unless turned off by the prop, the per-modal config, or the global
  // config (putConfig) for this modal type.
  const showCloseButton =
    closeButton !== false &&
    modal.config.closeButton !== false &&
    getConfigByType(isSlideover, 'closeButton') !== false
  const position = typeof modal.config.position === 'string' ? modal.config.position : undefined
  const dialogClass = [
    'im-dialog',
    isSlideover ? 'im-slideover' : 'im-modal',
    position ? `im-position-${position}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <dialog
      ref={dialogRef}
      className={dialogClass}
      data-modal-id={modal.id}
      data-modal-index={modal.index}
      // Esc on a modal dialog fires `cancel`. Prevent the native auto-close so
      // React owns the lifecycle, then close ourselves (unless closeExplicitly).
      onCancel={(event) => {
        event.preventDefault()
        if (!closeExplicitly) {
          handleClose()
        }
      }}
      // Clicking the backdrop lands on the <dialog> element itself.
      onClick={(event) => {
        if (event.target === dialogRef.current && closeOnClickOutside && !closeExplicitly) {
          handleClose()
        }
      }}
    >
      <div className="im-panel" onClick={(event) => event.stopPropagation()}>
        {showCloseButton && (
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
    </dialog>
  )
}

/**
 * Wraps a page's content so it renders as a modal. Without `name`, it reads the
 * current server modal from context. With `name`, it is a local modal that shows
 * when opened via a `#name` link / visitModal('#name').
 */
export function Modal({ children, name, onClose, closeButton }: ModalProps) {
  const modal = useResolvedModal(name)

  if (!modal) {
    return null
  }

  return (
    <ModalShell modal={modal} onClose={onClose} closeButton={closeButton}>
      {children}
    </ModalShell>
  )
}
