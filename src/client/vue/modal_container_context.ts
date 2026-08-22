/*
 * adonis-inertia-modal — Vue client
 */

import { inject, shallowRef, type InjectionKey, type ShallowRef } from 'vue'

/**
 * The panel element of the enclosing <Modal>, or null when there is none.
 * Popover / Select / Combobox libraries (Radix Vue, Headless UI...) portal
 * to document.body by default, which puts them below the dialog's ::backdrop
 * because native modal dialogs promote themselves to the browser's top-layer.
 * Consumers read this ref and pass it as the portal target of their popover
 * primitives so the portal target lives inside the top-layer (the panel is
 * inside the <dialog>, so its subtree inherits the top-layer) and inside the
 * panel's stopPropagation guard (so a popover that unmounts synchronously on
 * pointerdown does not leak a click to the dialog and close the modal).
 *
 * A ShallowRef (not a plain element) because the panel only exists after
 * mount: a value injected during setup would stay null forever, the same trap
 * the React client solves with a callback ref + state.
 */
export const modalContainerKey: InjectionKey<Readonly<ShallowRef<HTMLElement | null>>> = Symbol(
  'adonis-inertia-modal:container'
)

/** Stable fallback for consumers rendered outside any <Modal>. */
const noContainer = shallowRef<HTMLElement | null>(null)

export function useModalContainer(): Readonly<ShallowRef<HTMLElement | null>> {
  return inject(modalContainerKey, noContainer)
}
