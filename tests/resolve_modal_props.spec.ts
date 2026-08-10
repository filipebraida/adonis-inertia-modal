import { test } from '@japa/runner'
import { InertiaFactory } from '@adonisjs/inertia/factories'

import { resolveModalProps } from '../src/resolve_modal_props.ts'

// A real Inertia instance, only used to create real prop wrappers
// (defer/optional/always/merge) so we test against their actual shapes.
const inertia = new InertiaFactory().create() as any

test.group('resolveModalProps | standard visit', () => {
  test('omits deferred/optional, unwraps always, resolves functions and dot-props', async ({
    assert,
  }) => {
    const resolved = await resolveModalProps({
      'user': { id: 1 },
      'stats': inertia.defer(() => ({ visits: 10 })),
      'audit': inertia.optional(() => ['entry']),
      'perms': inertia.always(['read']),
      'lazy': () => 'computed',
      'nested.a': 1,
    })

    assert.deepEqual(resolved.props.user, { id: 1 })
    assert.notProperty(resolved.props, 'stats') // deferred omitted on standard visit
    assert.notProperty(resolved.props, 'audit') // optional omitted on standard visit
    assert.deepEqual(resolved.props.perms, ['read']) // always unwrapped
    assert.equal(resolved.props.lazy, 'computed') // function resolved
    assert.deepEqual(resolved.props.nested, { a: 1 }) // dot-notation nested
    assert.deepEqual(resolved.deferred, { default: ['stats'] })
  })

  test('marks merge props and unwraps their value', async ({ assert }) => {
    const resolved = await resolveModalProps({
      items: inertia.merge([1, 2]),
      settings: inertia.deepMerge({ a: 1 }),
    })

    assert.deepEqual(resolved.props.items, [1, 2])
    assert.deepEqual(resolved.props.settings, { a: 1 })
    assert.deepEqual(resolved.mergeProps, ['items'])
    assert.deepEqual(resolved.deepMergeProps, ['settings'])
  })
})

test.group('resolveModalProps | partial reload', () => {
  test('computes only the requested deferred/optional props', async ({ assert }) => {
    const resolved = await resolveModalProps(
      {
        user: { id: 1 },
        stats: inertia.defer(() => ({ visits: 10 })),
        audit: inertia.optional(() => ['entry']),
      },
      { partial: true, only: ['stats'] }
    )

    assert.deepEqual(resolved.props, { stats: { visits: 10 } })
    assert.notProperty(resolved.props, 'user')
    assert.notProperty(resolved.props, 'audit')
    assert.deepEqual(resolved.deferred, {})
  })

  test('an except reload includes regular props but keeps lazy props lazy', async ({ assert }) => {
    let statsComputed = false
    let auditComputed = false
    const resolved = await resolveModalProps(
      {
        user: { id: 1 },
        title: 'Hello',
        stats: inertia.defer(() => {
          statsComputed = true
          return { visits: 10 }
        }),
        audit: inertia.optional(() => {
          auditComputed = true
          return ['entry']
        }),
      },
      { partial: true, except: ['title'] }
    )

    // Regular, non-excepted props are included; the excepted one is dropped.
    assert.deepEqual(resolved.props, { user: { id: 1 } })
    // Lazy props are NOT evaluated under `except` (only `only` requests them).
    assert.isFalse(statsComputed)
    assert.isFalse(auditComputed)
  })
})

test.group('resolveModalProps | unsupported v3 wrappers', () => {
  test('rejects inertia.once() instead of leaking the wrapper into the props', async ({
    assert,
  }) => {
    await assert.rejects(
      () => resolveModalProps({ lookups: inertia.once(() => ['a']) }),
      /inertia\.once\(\) is not supported inside modal props \("lookups"\)/
    )
  })

  test('rejects inertia.scroll()', async ({ assert }) => {
    await assert.rejects(
      () =>
        resolveModalProps({
          feed: inertia.scroll({ data: [1] }, () => ({
            pageName: 'page',
            currentPage: 1,
            nextPage: 2,
            previousPage: null,
          })),
        }),
      /inertia\.scroll\(\) is not supported inside modal props \("feed"\)/
    )
  })

  test('rejects a rescued deferred prop, whose promise the modal client cannot keep', async ({
    assert,
  }) => {
    await assert.rejects(
      () => resolveModalProps({ perms: inertia.defer(() => ['read'], { rescue: true }) }),
      /rescue: true.*is not supported inside modal props \("perms"\)/
    )
  })

  test('rejects an unsupported wrapper nested inside merge()', async ({ assert }) => {
    await assert.rejects(
      () =>
        resolveModalProps({
          rows: inertia.merge(inertia.defer(() => [1], { rescue: true })),
        }),
      /is not supported inside modal props \("rows"\)/
    )
  })

  test('rejects even when the prop is filtered out of a partial reload', async ({ assert }) => {
    await assert.rejects(
      () => resolveModalProps({ lookups: inertia.once(() => ['a']) }, { partial: true, only: [] }),
      /inertia\.once\(\)/
    )
  })

  test('still accepts the wrappers the modal envelope does support', async ({ assert }) => {
    const resolved = await resolveModalProps({
      stats: inertia.defer(() => ({ visits: 1 })),
      audit: inertia.optional(() => ['entry']),
      perms: inertia.always(['read']),
      items: inertia.merge([1]),
    })

    assert.deepEqual(resolved.deferred, { default: ['stats'] })
    assert.deepEqual(resolved.mergeProps, ['items'])
    assert.deepEqual(resolved.props.perms, ['read'])
  })
})
