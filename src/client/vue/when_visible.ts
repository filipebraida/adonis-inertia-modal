/*
 * adonis-inertia-modal — Vue client
 */

import { computed, defineComponent, h, onBeforeUnmount, ref, watch, type PropType } from 'vue'

import useModal from './use_modal.ts'

/**
 * Like <Deferred>, but defers the load until the block is scrolled into view
 * (via IntersectionObserver). Falls back to loading immediately when
 * IntersectionObserver is unavailable (e.g. SSR / tests).
 */
export const WhenVisible = defineComponent({
  name: 'WhenVisible',
  props: {
    /** Modal prop name(s) to load when this block scrolls into view. */
    data: { type: [String, Array] as PropType<string | string[]>, required: true },
  },
  setup(props, { slots }) {
    const modal = useModal()
    let requested = false
    let observer: IntersectionObserver | null = null
    const root = ref<HTMLElement | null>(null)
    const keys = Array.isArray(props.data) ? props.data : [props.data]
    const loaded = computed(() =>
      modal.value ? keys.every((key) => modal.value!.props[key] !== undefined) : false
    )

    const trigger = () => {
      if (!requested && modal.value) {
        requested = true
        modal.value.reload({ only: keys })
      }
    }

    watch(
      [() => modal.value, loaded, root],
      () => {
        if (!modal.value || loaded.value || requested) return
        if (typeof IntersectionObserver === 'undefined') {
          trigger()
          return
        }
        if (observer) return
        observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            trigger()
            observer?.disconnect()
          }
        })
        if (root.value) observer.observe(root.value)
      },
      { immediate: true, flush: 'post' }
    )

    onBeforeUnmount(() => observer?.disconnect())

    return () => {
      if (!modal.value) return null
      if (loaded.value) return slots.default?.()
      return h('div', { ref: root }, slots.fallback?.())
    }
  },
})

export default WhenVisible
