/*
 * adonis-inertia-modal — Vue client
 */

import { defineComponent, h, provide, shallowRef, watch, type Component } from 'vue'

import { modalIndexKey, useModalStack } from './context.ts'

/**
 * Resolves the component for one stack entry (by name) and renders it, providing
 * its index so useModal() can find the entry. The resolved component is expected
 * to wrap its content in <Modal>.
 */
export const ModalRenderer = defineComponent({
  name: 'ModalRenderer',
  props: {
    index: { type: Number, required: true },
  },
  setup(props) {
    const ctx = useModalStack()
    const component = shallowRef<Component | null>(null)

    provide(modalIndexKey, props.index)

    watch(
      () => ctx.stack.value[props.index]?.component,
      (name) => {
        if (!name) return
        ctx.resolve(name).then((resolved) => {
          // Ignore a stale resolution if the entry's component changed while the
          // resolver was in flight (e.g. the slot at this index was replaced).
          if (ctx.stack.value[props.index]?.component === name) {
            // Unwrap ES module namespaces (resolvers like resolvePageComponent
            // return `{ default: Component }`).
            component.value = (resolved as { default?: Component }).default ?? resolved
          }
        })
      },
      { immediate: true }
    )

    return () => {
      const entry = ctx.stack.value[props.index]
      if (!component.value || !entry) return null
      return h(component.value, { ...entry.props })
    }
  },
})
