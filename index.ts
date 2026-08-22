/*
 * adonis-inertia-modal — package entrypoint (server side)
 *
 * The client entrypoints live at `adonis-inertia-modal/react` and
 * `adonis-inertia-modal/vue`; the provider at
 * `adonis-inertia-modal/modal_provider`.
 */

export { configure } from './configure.ts'

export { ModalResponse } from './src/modal_response.ts'
export { ModalHeaders } from './src/headers.ts'
export type { Backdrop, ModalPayload, ModalProps } from './src/types.ts'
