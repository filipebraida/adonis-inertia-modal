/*
 * adonis-inertia-modal — React client
 */

import { createContext, useContext } from 'react'

/**
 * The panel element of the enclosing <Modal>, or null when there is none.
 * Popover / Select / Combobox libraries (Radix, Base UI, Floating UI...) portal
 * to document.body by default, which puts them below the dialog's ::backdrop
 * because native modal dialogs promote themselves to the browser's top-layer.
 * Consumers read this value and pass it as the `container` prop of their
 * popover primitives so the portal target lives inside the top-layer (the
 * panel is inside the <dialog>, so its subtree inherits the top-layer) and
 * inside the panel's stopPropagation guard (so a popover that unmounts
 * synchronously on pointerdown does not leak a click to the dialog and close
 * the modal).
 */
export const ModalContainerContext = createContext<HTMLElement | null>(null)

export function useModalContainer(): HTMLElement | null {
  return useContext(ModalContainerContext)
}
