/*
 * adonis-modal
 *
 * Backend-driven modals for Inertia.js on AdonisJS.
 */

import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { InertiaHeaders } from '@adonisjs/inertia'

import { ModalHeaders } from './headers.ts'
import type { ModalPayload, ModalProps } from './types.ts'

/**
 * Minimal surface of the per-request Inertia instance we rely on. Keeping it
 * structural avoids a hard type coupling with the adapter's generic `Inertia`.
 */
interface InertiaLike {
  share(state: Record<string, unknown>): unknown
  render(component: string, props: Record<string, unknown>): unknown
}

/**
 * Minimal surface of the AdonisJS router we rely on. Injected by the provider
 * (resolved from the container) rather than imported as a global service, so
 * the class stays usable without a booted app — e.g. in unit tests.
 */
export interface RouterLike {
  usingDomains: boolean
  makeUrl(name: string, params?: any[] | Record<string, any>): string
  match(uri: string, method: string, shouldDecodeParam: boolean, hostname?: string | null): any
}

/**
 * A chainable, awaitable builder returned by `inertia.modal(...)`.
 *
 * The modal is delivered as a shared `modal` prop on a regular Inertia page,
 * so the backdrop (base route) renders normally and the modal "rides along".
 * There are three rendering paths, selected from the request headers:
 *
 *  - **Via link** (Inertia request that partially reloads the current backdrop
 *    component): re-render that component cheaply, merging only the `modal`
 *    prop. The backdrop stays put and the modal is stacked on top.
 *  - **Direct URL access** (non-Inertia full load, or an Inertia visit without a
 *    known backdrop): dispatch the base route handler in the same context so the
 *    backdrop page renders with the modal shared into it. Deep-linkable.
 *  - **Refresh backdrop**: force the direct path even on Inertia requests to get
 *    fresh backdrop data behind the modal.
 *
 * See docs/design/spike-server-dispatch.md for the full rationale.
 */
export class ModalResponse {
  #baseUrl?: string
  #refreshBackdrop = false
  #forceBase = false

  constructor(
    private inertia: InertiaLike,
    private ctx: HttpContext,
    private component: string,
    private props: ModalProps = {},
    private router?: RouterLike
  ) {}

  /**
   * Set the backdrop URL directly.
   */
  baseUrl(url: string): this {
    this.#baseUrl = url
    return this
  }

  /**
   * Set the backdrop URL from a registered route name.
   */
  baseRoute(name: string, params?: any[] | Record<string, any>): this {
    this.#baseUrl = this.#requireRouter().makeUrl(name, params)
    return this
  }

  /**
   * Force re-rendering the backdrop with fresh data even on Inertia requests.
   */
  refreshBackdrop(refresh = true): this {
    this.#refreshBackdrop = refresh
    return this
  }

  /**
   * Ignore the redirect header / referer and force the configured base URL as
   * the place to navigate when the modal closes.
   */
  forceBase(force = true): this {
    this.#forceBase = force
    return this
  }

  /**
   * Merge additional props into the modal.
   */
  with(props: ModalProps): this
  with(key: string, value: unknown): this
  with(key: string | ModalProps, value?: unknown): this {
    if (typeof key === 'string') {
      this.props[key] = value
    } else {
      this.props = { ...this.props, ...key }
    }
    return this
  }

  /**
   * Make the builder awaitable, so a controller can simply
   * `return inertia.modal(...).baseRoute(...)`.
   */
  then<T>(
    onfulfilled?: ((value: any) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: any) => any) | null
  ): Promise<T> {
    return this.render().then(onfulfilled, onrejected)
  }

  /**
   * Resolve the response: a PageObject (Inertia request) or HTML (initial load).
   */
  async render(): Promise<unknown> {
    const request = this.ctx.request
    const isInertia = !!request.header(InertiaHeaders.Inertia)
    const partialComponent = request.header(InertiaHeaders.PartialComponent)

    /**
     * Share the modal envelope so whichever backdrop renders carries it as the
     * `modal` prop.
     */
    this.inertia.share({ modal: this.#payload() })

    /**
     * Path A — opened via link: the client partially reloads the current
     * backdrop component requesting only the `modal` prop. Re-render that exact
     * component; Inertia keeps the page and merges `props.modal`.
     */
    if (isInertia && partialComponent && !this.#refreshBackdrop) {
      this.ctx.response.header(ModalHeaders.Modal, 'true')
      return this.inertia.render(partialComponent, {})
    }

    /**
     * Path B/C — direct access or explicit refresh: render a fresh backdrop by
     * dispatching the base route handler within the current context.
     */
    this.ctx.response.header(ModalHeaders.Modal, 'true')
    return this.#renderBackdrop()
  }

  /**
   * Dispatch the base route handler in the current context to render the
   * backdrop. We invoke ONLY the handler (not the full middleware pipeline) on
   * purpose: re-running global middleware would re-init `ctx.inertia` and drop
   * our shared `modal` prop. See docs/design/spike-server-dispatch.md §3.
   */
  async #renderBackdrop(): Promise<unknown> {
    const ctx = this.ctx
    const router = this.#requireRouter()
    const baseUrl = this.#resolveBaseUrl()
    const [path] = baseUrl.split('?')

    const hostname = router.usingDomains ? ctx.request.hostname() : undefined
    const shouldDecodeParam = ctx.request.parsedUrl?.shouldDecodeParam ?? true
    const matched = router.match(path, 'GET', shouldDecodeParam, hostname)

    if (!matched) {
      throw new Error(
        `adonis-modal: could not resolve a GET route for the backdrop URL "${baseUrl}". ` +
          `Make sure the route passed to baseRoute()/baseUrl() exists.`
      )
    }

    /**
     * Point the context at the base route so its handler resolves params and
     * route-model bindings against the backdrop, while `ctx.request.url()`
     * (used for the page URL) still reflects the modal URL — keeping the
     * browser on the deep-linkable modal address.
     */
    ctx.params = matched.params
    ctx.subdomains = matched.subdomains
    ctx.route = matched.route
    ctx.routeKey = matched.routeKey

    const handler = matched.route.handler
    if (typeof handler === 'function') {
      return handler(ctx)
    }
    return handler.handle(ctx.containerResolver, ctx)
  }

  /**
   * Build the serialized modal envelope.
   */
  #payload(): ModalPayload {
    return {
      component: this.component,
      baseUrl: this.#resolveBaseUrl(),
      redirectUrl: this.#redirectUrl(),
      props: this.#unpackDotProps(this.props),
      key: this.#modalKey(),
    }
  }

  /**
   * Resolve where to navigate when the modal closes.
   */
  #redirectUrl(): string {
    if (this.#forceBase) {
      return this.#resolveBaseUrl()
    }

    const request = this.ctx.request
    const headerRedirect = request.header(ModalHeaders.Redirect)
    if (headerRedirect) {
      return headerRedirect
    }

    const referer = request.header('referer')
    if (request.header(InertiaHeaders.Inertia) && referer) {
      return referer
    }

    return this.#resolveBaseUrl()
  }

  /**
   * Decide the modal instance key. Reuse the client-supplied key for sparse
   * reloads of the on-screen modal (`only: ['modal.props.*']`) and for
   * validation error responses, so the mounted modal/form is not remounted.
   * Otherwise mint a fresh key for a new modal instance.
   */
  #modalKey(): string {
    if (this.#isSparseModalReload() || this.#hasValidationErrors()) {
      return this.ctx.request.header(ModalHeaders.Key) ?? randomUUID()
    }
    return randomUUID()
  }

  #isSparseModalReload(): boolean {
    const request = this.ctx.request
    if (!request.header(InertiaHeaders.PartialComponent)) {
      return false
    }

    const only = this.#headerList(InertiaHeaders.PartialOnly)
    if (only.length) {
      const targetsModalChild = only.some((entry) => entry.startsWith('modal.'))
      return targetsModalChild && !only.includes('modal')
    }

    const except = this.#headerList(InertiaHeaders.PartialExcept)
    if (except.length) {
      return !except.includes('modal')
    }

    return false
  }

  #hasValidationErrors(): boolean {
    const session = (this.ctx as any).session
    if (!session) {
      return false
    }
    const errors = session.flashMessages?.get('inputErrorsBag')
    return !!errors && Object.keys(errors).length > 0
  }

  #headerList(header: string): string[] {
    return (this.ctx.request.header(header) ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  /**
   * Resolve dot-notation prop keys into nested objects and evaluate any
   * function-valued props. Mirrors emargareten/inertia-modal so partial reloads
   * of `modal.props.*` work despite the adapter only cherry-picking top-level
   * props (see docs/design/inertia-v3-compat.md).
   */
  #unpackDotProps(props: ModalProps): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, rawValue] of Object.entries(props)) {
      const value = typeof rawValue === 'function' ? (rawValue as () => unknown)() : rawValue

      if (!key.includes('.')) {
        result[key] = value
        continue
      }

      const segments = key.split('.')
      const last = segments.pop()!
      let cursor = result
      for (const segment of segments) {
        if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
          cursor[segment] = {}
        }
        cursor = cursor[segment] as Record<string, unknown>
      }
      cursor[last] = value
    }

    return result
  }

  #resolveBaseUrl(): string {
    if (!this.#baseUrl) {
      throw new Error(
        'adonis-modal: a backdrop URL is required. Call baseRoute() or baseUrl() on the modal response.'
      )
    }
    return this.#baseUrl
  }

  #requireRouter(): RouterLike {
    if (!this.router) {
      throw new Error(
        'adonis-modal: the router is not available. This usually means the ModalResponse was ' +
          'constructed without one (the provider injects it automatically in a running app).'
      )
    }
    return this.router
  }
}
