/*
 * adonis-inertia-modal — type augmentation
 *
 * Declares `inertia.modal(...)` on the Inertia type. The runtime method is
 * registered via `Inertia.macro()` by the provider; this file only carries types.
 *
 * Since @adonisjs/inertia anchors `HttpContext.inertia` to its package
 * entrypoint, any program that type-checks `ctx.inertia` also loads the
 * entrypoint declarations, so this augmentation attaches without consumers
 * having to import the barrel themselves. The file is side-effect imported from
 * both the provider (server) and the react/vue client entrypoints, so it rides
 * into every program that type-checks a caller.
 */
import type { Backdrop, ModalProps } from './types.js'
import type { ModalResponse } from './modal_response.js'

declare module '@adonisjs/inertia' {
  interface Inertia<Pages> {
    modal(component: string, props: ModalProps, backdrop: Backdrop): ModalResponse
  }
}
