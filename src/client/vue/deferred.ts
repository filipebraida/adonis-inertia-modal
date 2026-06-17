/*
 * adonis-inertia-modal — Vue client
 */

import { computed, defineComponent, watch, type PropType } from 'vue'

import useModal from './use_modal.ts'

/**
 * Renders the default slot once the named deferred modal prop(s) have been
 * loaded, triggering the load (a sparse modal reload) on mount. Until then it
 * shows the `fallback` slot. Pairs with
 * `inertia.modal('...', { stats: inertia.defer(...) })`.
 */
export const Deferred = defineComponent({
  name: 'Deferred',
  props: {
    /** Modal prop name(s) this block depends on. */
    data: { type: [String, Array] as PropType<string | string[]>, required: true },
  },
  setup(props, { slots }) {
    const modal = useModal()
    let requested = false
    const keys = Array.isArray(props.data) ? props.data : [props.data]
    const loaded = computed(() =>
      modal.value ? keys.every((key) => modal.value!.props[key] !== undefined) : false
    )

    watch(
      loaded,
      (isLoaded) => {
        if (modal.value && !isLoaded && !requested) {
          requested = true
          modal.value.reload({ only: keys })
        }
      },
      { immediate: true }
    )

    return () => {
      if (!modal.value) return null
      return loaded.value ? slots.default?.() : slots.fallback?.()
    }
  },
})

export default Deferred
