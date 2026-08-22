import { test } from '@japa/runner'

import { Config } from '../../src/client/core/config.ts'
import { EventEmitter } from '../../src/client/core/event_emitter.ts'
import { ModalStack } from '../../src/client/core/stack.ts'
import { buildModalRequest, parseModalPayload } from '../../src/client/core/request.ts'
import { createFetchClient, serializeParams } from '../../src/client/core/fetch_client.ts'
import { lockBodyScroll } from '../../src/client/core/scroll_lock.ts'
import { ModalHistory } from '../../src/client/core/history.ts'
import type { HttpClientLike } from '../../src/client/core/open.ts'
import { PrefetchCache } from '../../src/client/core/prefetch_cache.ts'
import { resolvePanelClasses } from '../../src/client/core/presentation.ts'
import type { ModalResponsePayload } from '../../src/client/core/types.ts'

test.group('core | Config', () => {
  test('returns defaults and supports dot-path get/put', ({ assert }) => {
    const config = new Config()
    assert.equal(config.get('modal.maxWidth'), '2xl')
    assert.equal(config.get('slideover.position'), 'right')

    config.put('modal.closeButton', false)
    assert.equal(config.get('modal.closeButton'), false)

    assert.equal(config.getByType(true, 'maxWidth'), 'md')
    assert.equal(config.getByType(false, 'maxWidth'), '2xl')
  })

  test('merges a partial object and resets', ({ assert }) => {
    const config = new Config()
    config.put({ navigate: true, modal: { closeButton: false } } as any)
    assert.equal(config.get('navigate'), true)
    assert.equal(config.get('modal.closeButton'), false)
    assert.equal(config.get('modal.maxWidth'), '2xl') // untouched default

    config.reset()
    assert.equal(config.get('navigate'), false)
    assert.equal(config.get('modal.closeButton'), true)
  })

  test('successive object puts accumulate (omitted keys preserved)', ({ assert }) => {
    const config = new Config()
    config.put({ navigate: true } as any)
    config.put({ modal: { closeButton: false } } as any)

    assert.equal(config.get('navigate'), true) // preserved from the first put
    assert.equal(config.get('modal.closeButton'), false)
    assert.equal(config.get('modal.maxWidth'), '2xl') // untouched default
  })
})

test.group('core | lockBodyScroll', (group) => {
  group.each.teardown(() => {
    document.body.style.overflow = ''
  })

  test('restores the original overflow only after the last (stacked) lock releases', ({
    assert,
  }) => {
    document.body.style.overflow = 'auto'

    const unlockA = lockBodyScroll()
    assert.equal(document.body.style.overflow, 'hidden')

    const unlockB = lockBodyScroll()
    assert.equal(document.body.style.overflow, 'hidden')

    // Release out of order (the lower modal first): still locked while A holds.
    unlockB()
    assert.equal(document.body.style.overflow, 'hidden')

    unlockA()
    assert.equal(document.body.style.overflow, 'auto') // original restored

    // Unlock is idempotent and must not corrupt the count.
    unlockA()
    assert.equal(document.body.style.overflow, 'auto')
  })
})

test.group('core | resolvePanelClasses', () => {
  test('maps maxWidth to a token class and falls back to global config', ({ assert }) => {
    // No per-modal config → global default (modal.maxWidth = '2xl').
    assert.equal(resolvePanelClasses({}, false), 'im-panel im-max-w-2xl')
    // Slideover uses the slideover default (md).
    assert.equal(resolvePanelClasses({}, true), 'im-panel im-max-w-md')
  })

  test('per-modal config overrides and appends padding/panel classes', ({ assert }) => {
    const classes = resolvePanelClasses(
      { maxWidth: 'lg', paddingClasses: 'p-8', panelClasses: 'shadow-xl ring' },
      false
    )
    assert.equal(classes, 'im-panel im-max-w-lg p-8 shadow-xl ring')
  })
})

test.group('core | serializeParams', () => {
  test('serializes arrays with brackets by default and indices on request', ({ assert }) => {
    const brackets = decodeURIComponent(serializeParams({ tags: [1, 2] }))
    assert.equal(brackets, 'tags[]=1&tags[]=2')

    const indices = decodeURIComponent(serializeParams({ tags: [1, 2] }, 'indices'))
    assert.equal(indices, 'tags[0]=1&tags[1]=2')
  })

  test('serializes nested objects and skips null/undefined', ({ assert }) => {
    const q = decodeURIComponent(serializeParams({ filter: { status: 'open' }, a: null, b: 1 }))
    assert.equal(q, 'filter[status]=open&b=1')
  })
})

test.group('core | createFetchClient', (group) => {
  const originalFetch = globalThis.fetch

  group.each.teardown(() => {
    globalThis.fetch = originalFetch
  })

  /**
   * Swap in a fetch that records what it was called with and resolves a minimal
   * Response — only the members the client actually reads.
   */
  function stubFetch(
    response: {
      body?: string
      status?: number
      headers?: Record<string, string>
      redirected?: boolean
      url?: string
    } = {}
  ) {
    const calls: Array<{ url: string; init: any }> = []
    globalThis.fetch = ((url: string, init: any) => {
      calls.push({ url, init })
      return Promise.resolve({
        text: () => Promise.resolve(response.body ?? ''),
        status: response.status ?? 200,
        headers: new Headers(response.headers ?? {}),
        redirected: response.redirected ?? false,
        url: response.url ?? url,
      })
    }) as unknown as typeof globalThis.fetch
    return calls
  }

  function requestConfig(overrides: Partial<Parameters<HttpClientLike['request']>[0]> = {}) {
    return {
      url: '/notes/1',
      method: 'get',
      data: undefined,
      params: undefined,
      headers: {},
      ...overrides,
    }
  }

  test('appends serialized params, joining onto an existing query string', async ({ assert }) => {
    const calls = stubFetch()

    await createFetchClient().request(requestConfig({ params: { tags: [1, 2] } }))
    assert.equal(decodeURIComponent(calls[0].url), '/notes/1?tags[]=1&tags[]=2')

    await createFetchClient().request(
      requestConfig({ url: '/notes/1?page=2', params: { tags: [1] } })
    )
    assert.equal(decodeURIComponent(calls[1].url), '/notes/1?page=2&tags[]=1')

    await createFetchClient().request(
      requestConfig({ params: { tags: [1, 2] }, queryStringArrayFormat: 'indices' })
    )
    assert.equal(decodeURIComponent(calls[2].url), '/notes/1?tags[0]=1&tags[1]=2')
  })

  test('leaves the URL alone when params are absent or empty', async ({ assert }) => {
    const calls = stubFetch()

    await createFetchClient().request(requestConfig())
    await createFetchClient().request(requestConfig({ params: {} }))

    assert.equal(calls[0].url, '/notes/1')
    assert.equal(calls[1].url, '/notes/1')
  })

  test('uppercases the method and sends credentials', async ({ assert }) => {
    const calls = stubFetch()

    await createFetchClient().request(requestConfig({ method: 'post' }))

    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.credentials, 'same-origin')
  })

  test('sends a JSON body and its Content-Type only when there is data', async ({ assert }) => {
    const calls = stubFetch()

    await createFetchClient().request(
      requestConfig({ method: 'post', data: { title: 'x' }, headers: { 'X-Custom': '1' } })
    )
    assert.equal(calls[0].init.body, JSON.stringify({ title: 'x' }))
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
    assert.equal(calls[0].init.headers['X-Custom'], '1')

    await createFetchClient().request(requestConfig({ headers: { 'X-Custom': '1' } }))
    assert.isUndefined(calls[1].init.body)
    assert.notProperty(calls[1].init.headers, 'Content-Type')
  })

  test('parses a JSON body and maps the response metadata', async ({ assert }) => {
    stubFetch({
      body: JSON.stringify({ props: { modal: { component: 'users/show' } } }),
      status: 200,
      headers: { 'x-inertia': 'true' },
      redirected: true,
      url: '/notes/1?after=redirect',
    })

    const response = await createFetchClient().request(requestConfig())

    assert.deepEqual(response.data, { props: { modal: { component: 'users/show' } } })
    assert.equal(response.status, 200)
    assert.deepEqual(response.headers, { 'x-inertia': 'true' })
    assert.isTrue(response.redirected)
    assert.equal(response.url, '/notes/1?after=redirect')
  })

  test('hands a non-JSON body through as text for parseModalPayload to reject', async ({
    assert,
  }) => {
    stubFetch({ body: '<!doctype html><html>login</html>', status: 200 })

    const response = await createFetchClient().request(requestConfig())

    assert.equal(response.data, '<!doctype html><html>login</html>')
    assert.isNull(parseModalPayload(response.data)) // rejected downstream, not here
  })
})

test.group('core | ModalHistory', () => {
  test('a Back (popstate) closes the top tracked modal', ({ assert }) => {
    const history = new ModalHistory()
    const closed: string[] = []
    history.install((id) => closed.push(id))

    history.push('m1')
    assert.isTrue(history.tracks('m1'))

    window.dispatchEvent(new Event('popstate'))

    assert.deepEqual(closed, ['m1'])
    assert.isFalse(history.tracks('m1'))
  })

  test('a UI release stops tracking the modal (rolls its entry back)', ({ assert }) => {
    const history = new ModalHistory()
    history.install(() => {})

    history.push('m2')
    assert.isTrue(history.tracks('m2'))

    history.release('m2')
    assert.isFalse(history.tracks('m2'))
  })
})

test.group('core | EventEmitter', () => {
  test('on/emit/off and registerFromProps', ({ assert }) => {
    const emitter = new EventEmitter()
    let received: unknown

    const off = emitter.on('saved', (value) => (received = value))
    emitter.emit('saved', 42)
    assert.equal(received, 42)

    off()
    emitter.emit('saved', 99)
    assert.equal(received, 42) // listener removed

    let fromProp: unknown
    emitter.registerFromProps({ onIncreaseBy: (n: unknown) => (fromProp = n) })
    emitter.emit('increaseBy', 5)
    assert.equal(fromProp, 5)
  })

  test('a listener that unsubscribes during dispatch does not disrupt the others', ({ assert }) => {
    const emitter = new EventEmitter()
    const calls: string[] = []

    const offA = emitter.on('e', () => {
      calls.push('a')
      offA() // mutate the listener set mid-dispatch
    })
    emitter.on('e', () => calls.push('b'))

    emitter.emit('e')
    assert.deepEqual(calls, ['a', 'b']) // both still fire

    calls.length = 0
    emitter.emit('e')
    assert.deepEqual(calls, ['b']) // 'a' stayed unsubscribed
  })
})

test.group('core | PrefetchCache', () => {
  const payload = { component: 'm', props: {}, key: 'k' } as ModalResponsePayload

  test('serves a live payload and treats expired entries as misses', ({ assert }) => {
    const cache = new PrefetchCache()
    cache.set('a', payload, 1000)
    assert.equal(cache.get('a'), payload)
    assert.isTrue(cache.has('a'))

    cache.set('b', payload, -1) // already expired
    assert.isUndefined(cache.get('b'))
  })

  test('caps size by evicting the oldest entry', ({ assert }) => {
    const cache = new PrefetchCache(2)
    cache.set('a', payload, 1000)
    cache.set('b', payload, 1000)
    cache.set('c', payload, 1000) // evicts 'a'

    assert.isUndefined(cache.get('a'))
    assert.equal(cache.get('b'), payload)
    assert.equal(cache.get('c'), payload)
    assert.equal(cache.size, 2)
  })
})

test.group('core | ModalStack', () => {
  test('push assigns id/index and marks top of stack', ({ assert }) => {
    const stack = new ModalStack()
    const a = stack.push({ component: 'users/show', props: { id: 1 }, key: 'k1' })
    assert.equal(a.id, 'k1')
    assert.equal(a.index, 0)
    assert.isTrue(a.onTopOfStack)

    const b = stack.push({ component: 'users/edit', props: {}, key: 'k2' })
    assert.equal(b.index, 1)
    assert.isTrue(stack.get('k2')!.onTopOfStack)
    assert.isFalse(stack.get('k1')!.onTopOfStack)
    assert.equal(stack.length, 2)
  })

  test('close fires onClose and remove fires onAfterLeave + reindexes', ({ assert }) => {
    const stack = new ModalStack()
    const events: string[] = []
    stack.push({ component: 'a', props: {}, key: 'k1' }, { onClose: () => events.push('close') })
    stack.push(
      { component: 'b', props: {}, key: 'k2' },
      { onAfterLeave: () => events.push('afterLeave') }
    )

    stack.close('k1')
    assert.isFalse(stack.get('k1')!.isOpen)
    assert.deepEqual(events, ['close'])

    stack.remove('k2')
    assert.equal(stack.length, 1)
    assert.deepEqual(events, ['close', 'afterLeave'])
    assert.isTrue(stack.get('k1')!.onTopOfStack)
  })

  test('fires blur on the modal below when one stacks, and focus when it closes', ({ assert }) => {
    const stack = new ModalStack()
    const events: string[] = []
    const a = stack.push({ component: 'a', props: {}, key: 'ka' })
    a.emitter.on('blur', () => events.push('blur'))
    a.emitter.on('focus', () => events.push('focus'))

    stack.push({ component: 'b', props: {}, key: 'kb' }) // A loses focus
    assert.deepEqual(events, ['blur'])

    stack.remove('kb') // A regains focus
    assert.deepEqual(events, ['blur', 'focus'])
  })

  test('reset fires onAfterLeave for teardown (not onClose) and clears the stack', ({ assert }) => {
    const stack = new ModalStack()
    const events: string[] = []
    stack.push(
      { component: 'a', props: {}, key: 'k1' },
      { onClose: () => events.push('close'), onAfterLeave: () => events.push('afterLeave') }
    )

    stack.reset()

    assert.equal(stack.length, 0)
    // onClose is skipped (a deep-link modal's onClose navigates → would loop).
    assert.deepEqual(events, ['afterLeave'])
  })

  test('updateProps merges props and notifies subscribers', ({ assert }) => {
    const stack = new ModalStack()
    let notified = 0
    stack.subscribe(() => (notified += 1))

    stack.push({ component: 'a', props: { name: 'Jane' }, key: 'k1' })
    stack.updateProps('k1', { age: 30 })

    assert.deepEqual(stack.get('k1')!.props, { name: 'Jane', age: 30 })
    assert.isAbove(notified, 0)
  })

  test('getSnapshot returns a new reference after a mutation', ({ assert }) => {
    const stack = new ModalStack()
    const before = stack.getSnapshot()
    stack.push({ component: 'a', props: {}, key: 'k1' })
    assert.notStrictEqual(stack.getSnapshot(), before)
  })
})

test.group('core | buildModalRequest', () => {
  test('builds a partial request that targets only the modal prop', ({ assert }) => {
    const req = buildModalRequest({
      href: '/users/1',
      currentComponent: 'users/index',
      version: 'abc',
      modalKey: 'k1',
      redirectUrl: '/users',
    })

    assert.equal(req.url, '/users/1')
    assert.equal(req.method, 'get')
    assert.equal(req.headers['X-Inertia'], 'true')
    assert.equal(req.headers['X-Inertia-Partial-Component'], 'users/index')
    assert.equal(req.headers['X-Inertia-Partial-Data'], 'modal')
    assert.equal(req.headers['X-Inertia-Version'], 'abc')
    assert.equal(req.headers['X-Inertia-Modal-Key'], 'k1')
    assert.equal(req.headers['X-Inertia-Modal-Redirect'], '/users')
  })

  test('post sends data in body, get sends data as params', ({ assert }) => {
    const post = buildModalRequest({
      href: '/users',
      method: 'post',
      data: { name: 'Jane' },
      currentComponent: 'users/index',
    })
    assert.deepEqual(post.data, { name: 'Jane' })
    assert.isUndefined(post.params)

    const get = buildModalRequest({
      href: '/users',
      data: { q: 'x' },
      currentComponent: 'users/index',
    })
    assert.deepEqual(get.params, { q: 'x' })
    assert.isUndefined(get.data)
  })
})

test.group('core | parseModalPayload', () => {
  test('extracts props.modal from a page object or JSON string', ({ assert }) => {
    const modal = { component: 'users/show', props: { id: 1 } }
    assert.deepEqual(parseModalPayload({ props: { modal } }), modal)
    assert.deepEqual(parseModalPayload(JSON.stringify({ props: { modal } })), modal)
  })

  test('returns null when there is no valid modal payload', ({ assert }) => {
    assert.isNull(parseModalPayload({ props: {} }))
    assert.isNull(parseModalPayload('not json'))
    assert.isNull(parseModalPayload({ props: { modal: { props: {} } } }))
  })
})
