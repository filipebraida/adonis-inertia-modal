/*
 * adonis-inertia-modal — type augmentation
 *
 * Declares `inertia.modal(...)` on the Inertia type. The runtime method is
 * patched onto `Inertia.prototype` by the provider; this file only carries types.
 *
 * The `Inertia` import (kept alive by the marker at the bottom) force-loads the
 * `@adonisjs/inertia` barrel so the interface→class merge attaches to the exported
 * `Inertia` class. Without the barrel in the program the merge silently no-ops —
 * e.g. a Tuyau client tsconfig that pulls controllers in through the generated
 * registry never imports the barrel, so `inertia.modal(...)` goes untyped there.
 * Everything here is type-only, so no server code reaches client bundles. The file
 * is side-effect imported from both the provider (server) and the react/vue client
 * entrypoints, so it rides into every program that type-checks a caller.
 */
import type { Inertia } from '@adonisjs/inertia'
import type { Backdrop, ModalProps } from './types.js'
import type { ModalResponse } from './modal_response.js'

declare module '@adonisjs/inertia' {
  interface Inertia<Pages> {
    modal(component: string, props: ModalProps, backdrop: Backdrop): ModalResponse
  }
}

// Keeps the `@adonisjs/inertia` import alive through declaration emit — an empty
// `import type {}` is elided by tsc, which drops the barrel from the program and
// the merge above silently no-ops in client programs. Referencing the class here
// pins the module in. Not part of the public API (this file is side-effect only).
export type KeepInertiaBarrelLoaded = Inertia<never>
