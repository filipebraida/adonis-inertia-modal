/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export values from the package entrypoint as you see fit.
|
*/

export { configure } from './configure.ts'
export { stubsRoot } from './stubs/main.ts'

export { ModalResponse } from './src/modal_response.ts'
export { ModalHeaders } from './src/headers.ts'
export type { Backdrop, ModalPayload, ModalProps } from './src/types.ts'
