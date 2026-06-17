/*
 * adonis-inertia-modal
 *
 * Backend-driven modals for Inertia.js on AdonisJS.
 */

import type { ApplicationService } from '@adonisjs/core/types'
import type { HttpContext } from '@adonisjs/core/http'
import { Inertia } from '@adonisjs/inertia'

import { ModalResponse, type InertiaLike } from '../src/modal_response.ts'
import type { Backdrop, ModalProps } from '../src/types.ts'

/**
 * Extend the Inertia instance with a `modal()` method so controllers can do:
 *
 * ```ts
 * return inertia.modal('users/show', { user }, { route: 'users.index' })
 * ```
 *
 * The backdrop is required (and typed `{ route } | { url }`), so a modal can't
 * be declared without a page to render behind it / navigate to on close.
 */
declare module '@adonisjs/inertia' {
  interface Inertia<Pages> {
    modal(component: string, props: ModalProps, backdrop: Backdrop): ModalResponse
  }
}

export default class ModalProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    const router = await this.app.container.make('router')

    /**
     * The `Inertia` class is not Macroable, but it is exported. We patch its
     * prototype once at boot. `ctx` is a (runtime-accessible) protected field on
     * every instance — this is the single coupling point with the adapter
     * internals (see docs/design/spike-server-dispatch.md §4).
     */
    Inertia.prototype.modal = function (
      this: Inertia<any>,
      component: string,
      props: ModalProps,
      backdrop: Backdrop
    ) {
      const ctx = (this as unknown as { ctx: HttpContext }).ctx
      return new ModalResponse(
        this as unknown as InertiaLike,
        ctx,
        component,
        props,
        backdrop,
        router
      )
    }
  }
}
