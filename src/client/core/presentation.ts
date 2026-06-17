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
