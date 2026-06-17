/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Optional browser-history integration for modals opened with `history: true`.
 * Opening such a modal pushes a history entry (carrying Inertia's current state
 * so its own popstate handler restores the same page instead of reloading);
 * pressing Back closes the top tracked modal, and closing it via the UI rolls
 * the matching history entry back. One popstate listener is installed lazily.
 *
 * Scope: back-to-close only. Forward does not re-open a closed modal.
 */

export class ModalHistory {
  #ids: string[] = []
  #suppressNextPop = false
  #installed = false
  #closeModal: ((id: string) => void) | null = null

  /**
   * Install the popstate listener once. `closeModal` closes a modal by id with
   * no history side effects (the browser entry is already gone on a Back press).
   */
  install(closeModal: (id: string) => void): void {
    this.#closeModal = closeModal
    if (this.#installed || typeof window === 'undefined') {
      return
    }
    this.#installed = true
    window.addEventListener('popstate', this.#onPopstate)
  }

  tracks(id: string): boolean {
    return this.#ids.includes(id)
  }

  /** Push a history entry for a modal opened with `history: true`. */
  push(id: string): void {
    if (typeof window === 'undefined') {
      return
    }
    this.#ids.push(id)
    const state = window.history.state
    window.history.pushState({ ...(state ?? {}), aimModalId: id }, '', window.location.href)
  }

  /**
   * A tracked modal was closed via the UI (button/Esc/backdrop): roll its
   * browser entry back. The resulting popstate is suppressed so it doesn't
   * close the modal a second time.
   */
  release(id: string): void {
    const index = this.#ids.lastIndexOf(id)
    if (index === -1 || typeof window === 'undefined') {
      return
    }
    this.#ids.splice(index, 1)
    this.#suppressNextPop = true
    window.history.back()
  }

  #onPopstate = (): void => {
    if (this.#suppressNextPop) {
      this.#suppressNextPop = false
      return
    }
    const id = this.#ids.pop()
    if (id) {
      this.#closeModal?.(id)
    }
  }
}
