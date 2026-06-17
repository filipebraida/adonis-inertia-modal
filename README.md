# adonis-modal

Backend-driven modals for [Inertia.js](https://inertiajs.com) on
[AdonisJS](https://adonisjs.com). Open any route in a modal or slideover —
deep-linkable, validation-aware, with the backdrop page preserved — without
fighting client-side state.

> Status: early development. The server-side is implemented; the frontend plugin
> is next. See [`docs/`](./docs) for the research, the chosen architecture and
> the feasibility spike.

## Idea

A controller declares that a response is a modal:

```ts
// app/controllers/users_controller.ts
export default class UsersController {
  async show({ inertia, params }: HttpContext) {
    const user = await User.findOrFail(params.id)

    return inertia.modal('users/show', { user }).baseRoute('users.index') // backdrop when opened directly via URL
  }
}
```

The modal is delivered as a shared `modal` prop on a regular Inertia page, so:

- **Opened via a link** — the current page stays as the backdrop and the modal
  is stacked on top.
- **Opened directly via URL** — the base route renders the backdrop and the
  modal appears on top (deep-linkable, SEO-friendly).
- **Validation errors** — flow through Inertia's shared `errors` without
  reloading or remounting the modal.

## Install

```sh
npm i adonis-modal
node ace configure adonis-modal
```

## Server API

`inertia.modal(component, props?)` returns a chainable, awaitable builder:

| Method                               | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `.baseRoute(name, params?)`          | Backdrop URL from a route name.                        |
| `.baseUrl(url)`                      | Backdrop URL directly.                                 |
| `.with(props)` / `.with(key, value)` | Merge extra props.                                     |
| `.refreshBackdrop(refresh?)`         | Re-render the backdrop with fresh data.                |
| `.forceBase(force?)`                 | Ignore referer/redirect header; close to the base URL. |

Props support dot-notation keys (`'stats.today'`) so partial reloads of
`modal.props.*` work.

## Compatibility

Targets `@adonisjs/core@^7` and `@adonisjs/inertia@^4` (Inertia v2 client).
Designed to be forward-compatible with the Inertia v3 adapter
(`@adonisjs/inertia@^5`). See [`docs/design/inertia-v3-compat.md`](./docs/design/inertia-v3-compat.md).

## Docs

- [Research & architecture](./docs/README.md)

## Credits

Architecture inspired by [momentum-modal](https://github.com/lepikhinb/momentum-modal)
and [emargareten/inertia-modal](https://github.com/emargareten/inertia-modal),
adapted to the AdonisJS Inertia adapter.

## License

MIT
