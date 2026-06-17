import { HttpContextFactory } from '@adonisjs/core/factories/http'
import { InertiaFactory } from '@adonisjs/inertia/factories'
import { test } from '@japa/runner'

import { ModalResponse } from '../src/modal_response.ts'

/**
 * Build a real Inertia instance (via the adapter's own factory) bound to a real
 * HttpContext, configured as a "via link" partial reload of the given backdrop
 * component requesting only the `modal` prop — i.e. how the client opens a modal.
 */
function viaLink(backdrop: string, ctx = new HttpContextFactory().create()) {
  const inertia = new InertiaFactory()
    .merge({ ctx })
    .partialReload(backdrop)
    .only(['modal'])
    .create()
  return { ctx, inertia }
}

test.group('ModalResponse | via link (Path A)', () => {
  test('re-renders the backdrop component and shares the modal as a partial', async ({
    assert,
  }) => {
    const { ctx, inertia } = viaLink('users/index')

    const page: any = await new ModalResponse(
      inertia,
      ctx,
      'users/show',
      { user: { id: 1 } },
      {
        url: '/users',
      }
    ).render()

    assert.equal(page.component, 'users/index')
    assert.properties(page.props, ['modal'])
    assert.equal(page.props.modal.component, 'users/show')
    assert.equal(page.props.modal.baseUrl, '/users')
    assert.deepEqual(page.props.modal.props, { user: { id: 1 } })
    assert.isString(page.props.modal.key)
    assert.equal(ctx.response.getHeader('x-inertia-modal'), 'true')
  })

  test('unpacks dot-notation props into nested objects and evaluates functions', async ({
    assert,
  }) => {
    const { ctx, inertia } = viaLink('users/index')

    const page: any = await new ModalResponse(
      inertia,
      ctx,
      'users/show',
      { 'stats.today': 5, 'stats.total': () => 99 },
      { url: '/users' }
    ).render()

    assert.deepEqual(page.props.modal.props, { stats: { today: 5, total: 99 } })
  })

  test('exposes the backdrop url as the close redirect target', async ({ assert }) => {
    const { ctx, inertia } = viaLink('users/index')

    const page: any = await new ModalResponse(
      inertia,
      ctx,
      'users/show',
      {},
      {
        url: '/users',
      }
    ).render()

    assert.equal(page.props.modal.redirectUrl, '/users')
  })

  test('with() does not mutate the props object passed by the caller', async ({ assert }) => {
    const { ctx, inertia } = viaLink('users/index')
    const original = { user: { id: 1 } }

    const page: any = await new ModalResponse(inertia, ctx, 'users/show', original, {
      url: '/users',
    })
      .with('extra', true)
      .render()

    assert.deepEqual(original, { user: { id: 1 } }) // caller's object untouched
    assert.equal(page.props.modal.props.extra, true)
  })
})

test.group('ModalResponse | redirect safety', () => {
  test('keeps a relative redirect header as the close target', async ({ assert }) => {
    const { ctx, inertia } = viaLink('users/index')
    ctx.request.request.headers['x-inertia-modal-redirect'] = '/dashboard?tab=1'

    const page: any = await new ModalResponse(
      inertia,
      ctx,
      'users/show',
      {},
      {
        url: '/users',
      }
    ).render()

    assert.equal(page.props.modal.redirectUrl, '/dashboard?tab=1')
  })

  test('rejects an off-origin redirect header (open-redirect guard) and falls back to the base URL', async ({
    assert,
  }) => {
    const { ctx, inertia } = viaLink('users/index')
    ctx.request.request.headers['x-inertia-modal-redirect'] = 'https://evil.example/phish'

    const page: any = await new ModalResponse(
      inertia,
      ctx,
      'users/show',
      {},
      {
        url: '/users',
      }
    ).render()

    assert.equal(page.props.modal.redirectUrl, '/users')
  })
})
