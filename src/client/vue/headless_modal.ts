/*
 * adonis-inertia-modal — Vue client
 */

import { defineComponent } from 'vue'

import { useResolvedModal } from './use_modal.ts'

/**
 * Like <Modal>, but renders no UI of its own. The default scoped slot receives
 * the modal instance (props, close, reload, emit, config, ...) so you build the
 * dialog, backdrop, transitions and accessibility yourself. Renders nothing when
 * no modal is open.
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
    return () => {
      if (!modal.value) return null
      return slots.default?.(modal.value)
    }
  },
})

export default HeadlessModal
