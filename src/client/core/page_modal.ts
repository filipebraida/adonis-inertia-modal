/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Decides whether a `modal` payload found in the page props is genuinely a new
 * modal from the server, or the one we are already showing being dragged along
 * by the client.
 */

/**
 * A page snapshot as far as modal adoption is concerned. Kept as a single
 * object (rather than two refs) so the URL and the modal key it was seen with
 * can never drift apart.
 */
export interface PageModalSnapshot {
  url: string
  modalKey?: string
}

/**
 * Inertia v3 instant visits pre-render the destination page with the *current*
 * page's shared props carried forward — `@inertiajs/core` builds the
 * intermediate props from `page.sharedProps`. The modal rides along as a shared
 * prop (the server publishes it via `inertia.share({ modal })`), so `modal` is
 * listed in `sharedProps` and the destination page can arrive still carrying the
 * modal that was on screen before the visit.
 *
 * Left alone, that reads as "the new page has a modal": the URL change resets
 * the stack, the carried-over payload is no longer found in it, and the stale
 * modal gets pushed onto the page the user just navigated to.
 *
 * The tell is the key. `ModalResponse` mints a fresh `key` for every response
 * except a sparse reload of the on-screen modal (which keeps the same URL), so a
 * URL change carrying an *unchanged* key cannot have come from the server — it
 * is the client's carry-over.
 */
export function isCarriedOverPageModal(
  navigated: boolean,
  incomingKey: string | undefined,
  previous: PageModalSnapshot | undefined
): boolean {
  return navigated && !!incomingKey && incomingKey === previous?.modalKey
}
