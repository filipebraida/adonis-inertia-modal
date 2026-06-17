/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Resolve the panel's CSS classes from the per-modal config (set via ModalLink)
 * falling back to the global config (putConfig) for the modal/slideover type.
 * `maxWidth` is a token (sm/md/lg/.../full) mapped to an `im-max-w-<token>` class
 * defined in styles.css; `paddingClasses`/`panelClasses` are appended verbatim so
 * users can add their own (Tailwind or otherwise).
 */

import { getConfigByType } from './config.ts'
import type { ModalOptions } from './types.ts'

/**
 * Effective presentation = the `<Modal>` component's props overlaid by the
 * opener's per-modal config (ModalLink `config` / visit `config` wins, since
 * it's the most specific intent for this open). Undefined component props are
 * dropped so they fall through to the opener config / global config.
 */
export function mergePresentation(
  componentProps: Record<string, unknown>,
  entryConfig: ModalOptions
): ModalOptions {
  const defined: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(componentProps)) {
    if (value !== undefined) {
      defined[key] = value
    }
  }
  return { ...defined, ...entryConfig }
}

export function resolvePanelClasses(config: ModalOptions, isSlideover: boolean): string {
  const pick = (key: string): string => {
    const value = config[key] ?? getConfigByType(isSlideover, key)
    return typeof value === 'string' ? value : ''
  }

  const maxWidth = pick('maxWidth')

  return [
    'im-panel',
    maxWidth ? `im-max-w-${maxWidth}` : '',
    pick('paddingClasses'),
    pick('panelClasses'),
  ]
    .filter(Boolean)
    .join(' ')
}
