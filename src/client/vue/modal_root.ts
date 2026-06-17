/*
 * adonis-inertia-modal — Vue client
 */

import { defineComponent, Fragment, h, watch, type PropType } from 'vue'
import { usePage as inertiaUsePage } from '@inertiajs/vue3'

import { useModalStack } from './context.ts'
import { ModalRenderer } from './modal_renderer.ts'
import type { PageInfo } from './types.ts'

/**
 * Renders every modal currently on the stack and feeds the current Inertia page
 * into the context. Place it once inside your app/layout (after page content),
 * where Inertia's usePage() is available.
 */
export const ModalRoot = defineComponent({
  name: 'ModalRoot',
  props: {
    /** Reads the current Inertia page. Defaults to Inertia's usePage(). */
    usePageHook: {
      type: Function as PropType<() => PageInfo>,
      required: false,
    },
  },
  setup(props) {
    const ctx = useModalStack()
    const page = (props.usePageHook ?? (inertiaUsePage as unknown as () => PageInfo))()

    watch(
      () => [page.component, page.url, page.props] as const,
      () => {
        ctx.syncPage({
          component: page.component,
          url: page.url,
          version: (page as { version?: string }).version,
          props: page.props,
        })
      },
      { immediate: true }
    )

    return () =>
      h(
        Fragment,
        ctx.stack.value
          .map((entry, index) =>
            // Local modals render their own inline content via <Modal name>.
            entry.local ? null : h(ModalRenderer, { key: entry.id, index })
          )
          .filter(Boolean)
      )
  },
})
