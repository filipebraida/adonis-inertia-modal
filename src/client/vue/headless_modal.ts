/*
 * adonis-inertia-modal — Vue client
 */

import { defineComponent, watch } from 'vue'

import { useModalStack } from './context.ts'
import { useResolvedModal } from './use_modal.ts'

/**
 * Like <Modal>, but renders no UI of its own. The default scoped slot receives
 * the modal instance (props, close, reload, emit, config, ...) so you build the
 * dialog, backdrop, transitions and accessibility yourself. Renders nothing when
 * no modal is open.
 *
 * Headless has no built-in leave transition, so it hides as soon as the modal is
 * marked closing and removes the entry from the stack itself.
 */
export const HeadlessModal = defineComponent({
  name: 'HeadlessModal',
  inheritAttrs: false,
  props: {
    /** When set, binds to a local (client-only) modal opened via href="#name". */
    name: { type: String, required: false },
  },
  setup(props, { slots }) {
    const modal = useResolvedModal(props.name)
    const stack = useModalStack()

    watch(
      () => (modal.value && !modal.value.isOpen ? modal.value.id : null),
      (id) => {
        if (id) stack.remove(id)
      }
    )

    return () => {
      if (!modal.value || !modal.value.isOpen) return null
      return slots.default?.(modal.value)
    }
  },
})

export default HeadlessModal
