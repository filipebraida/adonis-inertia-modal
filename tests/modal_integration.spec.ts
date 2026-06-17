import { test } from '@japa/runner'
import { InertiaManager, InertiaHeaders } from '@adonisjs/inertia'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { HttpContextFactory, RequestFactory } from '@adonisjs/core/factories/http'

import { setupApp, setupViewMacroMock } from './helpers.ts'

class ThingTransformer extends BaseTransformer<{ id: number; name: string; secret: string }> {
  toObject() {
    return this.pick(this.resource, ['id', 'name'])
  }
}

class BookTransformer extends BaseTransformer<{ id: number; title: string }> {
  toObject() {
    return this.pick(this.resource, ['id', 'title'])
  }
}

class AuthorTransformer extends BaseTransformer<{
  id: number
  name: string
  books: { id: number; title: string }[]
}> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name']),
      books: BookTransformer.transform(this.resource.books),
    }
  }
}

/**
 * Integration tests: exercise ModalResponse through a real booted AdonisJS app
 * (router with registered routes, InertiaManager, the modal provider patching
 * Inertia.prototype.modal). See docs/design/phases-detailed.md (Fase 0).
 */
test.group('ModalResponse | integration', (group) => {
  let app: Awaited<ReturnType<typeof setupApp>>['app']
  let backdropDispatches = 0

  group.setup(async () => {
    ;({ app } = await setupApp())

    const router = await app.container.make('router')
    router
      .get('/users', async (ctx: any) => ctx.inertia.render('users/index', { users: ['a', 'b'] }))
      .as('users.index')
    router
      .get('/counter', async (ctx: any) => {
        backdropDispatches += 1
        return ctx.inertia.render('counter/index', {})
      })
      .as('counter.index')
    router.commit()
  })

  /**
   * Create a context + Inertia instance for a modal URL, with optional headers.
   */
  async function modalContext(headers: Record<string, string> = {}, url = '/users/1') {
    const request = new RequestFactory().merge({ url, method: 'GET' }).create()
    const ctx = new HttpContextFactory().merge({ request }).create()
    for (const [key, value] of Object.entries(headers)) {
      ctx.request.request.headers[key] = value
    }
    const manager = await app.container.make(InertiaManager)
    const inertia = manager.createForRequest(ctx)
    ;(ctx as any).inertia = inertia
    return { ctx, inertia }
  }

  test('direct access re-dispatches the base route and renders the backdrop with the modal', async ({
    assert,
  }) => {
    setupViewMacroMock()
    const { inertia } = await modalContext() // no x-inertia header → direct access

    const result: any = await inertia.modal(
      'users/show',
      { user: { id: 1 } },
      { route: 'users.index' }
    )

    // HTML path returns the mocked view { view, props: { page } }
    assert.equal(result.props.page.component, 'users/index')
    assert.deepEqual(result.props.page.props.users, ['a', 'b'])
    assert.equal(result.props.page.props.modal.component, 'users/show')
    assert.deepEqual(result.props.page.props.modal.props, { user: { id: 1 } })
    assert.equal(result.props.page.props.modal.baseUrl, '/users')
  })

  test('via link (partial reload of modal) returns the backdrop component with only the modal', async ({
    assert,
  }) => {
    const { ctx, inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
    })

    const page: any = await inertia.modal(
      'users/show',
      { user: { id: 1 } },
      { route: 'users.index' }
    )

    assert.equal(page.component, 'users/index')
    assert.properties(page.props, ['modal'])
    assert.notProperty(page.props, 'users')
    assert.equal(page.props.modal.component, 'users/show')
    assert.equal(ctx.response.getHeader('x-inertia-modal'), 'true')
  })

  test('restores the routing state on the context after dispatching the backdrop', async ({
    assert,
  }) => {
    const { ctx, inertia } = await modalContext({ [InertiaHeaders.Inertia]: 'true' }, '/users/1')

    // The factory-built context is not bound to a route initially.
    assert.isUndefined(ctx.route)

    await inertia
      .modal('users/show', { user: { id: 1 } }, { route: 'users.index' })
      .refreshBackdrop()

    // After re-dispatching the backdrop, the modal route's (empty) state is back.
    assert.isUndefined(ctx.route)
    assert.isUndefined(ctx.routeKey)
  })

  test('awaiting the builder twice dispatches the backdrop only once (memoized render)', async ({
    assert,
  }) => {
    backdropDispatches = 0
    const { inertia } = await modalContext({ [InertiaHeaders.Inertia]: 'true' }, '/counter/1')

    const builder = inertia.modal('counter/show', {}, { route: 'counter.index' }).refreshBackdrop()
    const first = await builder
    const second = await builder

    assert.equal(backdropDispatches, 1)
    assert.strictEqual(first, second)
  })

  test('refreshBackdrop re-dispatches the base route even on an Inertia request', async ({
    assert,
  }) => {
    const { inertia } = await modalContext({ [InertiaHeaders.Inertia]: 'true' })

    const page: any = await inertia
      .modal('users/show', { user: { id: 1 } }, { route: 'users.index' })
      .refreshBackdrop()

    // Backdrop was re-rendered (its own props are present), with the modal alongside
    assert.equal(page.component, 'users/index')
    assert.deepEqual(page.props.users, ['a', 'b'])
    assert.equal(page.props.modal.component, 'users/show')
  })

  test('reuses the client modal key on a validation-error response', async ({ assert }) => {
    const { ctx, inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
      'x-inertia-modal-key': 'reused-key',
    })

    // Simulate a flashed validation error bag in the session.
    ;(ctx as any).session = {
      flashMessages: {
        get: (key: string) => (key === 'inputErrorsBag' ? { email: ['Required'] } : undefined),
      },
    }

    const page: any = await inertia.modal('users/show', {}, { route: 'users.index' })

    assert.equal(page.props.modal.key, 'reused-key')
  })

  test('mints a fresh key on a normal (non-validation) modal open', async ({ assert }) => {
    const { inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
      'x-inertia-modal-key': 'previous-key',
    })

    const page: any = await inertia.modal('users/show', {}, { route: 'users.index' })

    assert.notEqual(page.props.modal.key, 'previous-key')
  })

  test('omits a deferred modal prop on open and lists it in payload.deferred', async ({
    assert,
  }) => {
    const { inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
    })

    const page: any = await inertia.modal(
      'users/show',
      {
        user: { id: 1 },
        stats: inertia.defer(() => ({ visits: 5 })),
      },
      { route: 'users.index' }
    )

    assert.equal(page.props.modal.props.user.id, 1)
    assert.notProperty(page.props.modal.props, 'stats')
    assert.deepEqual(page.props.modal.deferred, { default: ['stats'] })
  })

  test('computes a deferred modal prop on a sparse reload', async ({ assert }) => {
    const { inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal,modal.props.stats',
      'x-inertia-modal-key': 'kept-key',
    })

    const page: any = await inertia.modal(
      'users/show',
      {
        user: { id: 1 },
        stats: inertia.defer(() => ({ visits: 5 })),
      },
      { route: 'users.index' }
    )

    assert.deepEqual(page.props.modal.props.stats, { visits: 5 })
    assert.notProperty(page.props.modal.props, 'user')
    assert.equal(page.props.modal.key, 'kept-key')
  })

  test('serializes transformer outputs nested in modal.props', async ({ assert }) => {
    const { inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
    })

    const page: any = await inertia.modal(
      'users/show',
      { thing: ThingTransformer.transform({ id: 1, name: 'Ada', secret: 'hide-me' }) },
      { route: 'users.index' }
    )

    // The lazy transformer Item is resolved to its plain (picked) object.
    assert.deepEqual(page.props.modal.props.thing, { id: 1, name: 'Ada' })
  })

  test('resolves nested transformers (relations) inside modal.props', async ({ assert }) => {
    const { inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
    })

    const page: any = await inertia.modal(
      'authors/show',
      {
        author: AuthorTransformer.transform({
          id: 1,
          name: 'Ada',
          books: [
            { id: 10, title: 'Notes' },
            { id: 11, title: 'Engine' },
          ],
        }),
      },
      { route: 'users.index' }
    )

    assert.deepEqual(page.props.modal.props.author, {
      id: 1,
      name: 'Ada',
      books: [
        { id: 10, title: 'Notes' },
        { id: 11, title: 'Engine' },
      ],
    })
  })
})
