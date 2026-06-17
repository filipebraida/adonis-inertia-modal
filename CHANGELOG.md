# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org).

## 0.1.0 — Unreleased

First usable release. React and Vue 3 support.

### Server

- `inertia.modal(component, props?)` builder with `baseRoute()`, `baseUrl()`,
  `with()`, `refreshBackdrop()`, `forceBase()`; awaitable from a controller.
- Three render paths: open via link (partial), backdrop refresh, and direct-URL
  access (re-dispatches the base route so the modal is deep-linkable).
- Validation-aware: errors flow through Inertia's shared `errors`; the modal key
  is reused on validation responses so the form is not remounted.
- Resolves the adapter's prop wrappers (`defer`/`optional`/`merge`/`always`) and
  dot-notation **inside** `modal.props`; deferred props are listed for the client
  and computed on a sparse reload.
- Serializes `modal.props` like top-level Inertia props, so transformer outputs
  (`SomeTransformer.transform(...)`), Lucid models and dates resolve to plain JSON.

### React client (`adonis-inertia-modal/react`)

- `ModalStackProvider`, `ModalRoot`, `ModalLink`, `Modal`, `useModal`,
  `useModalStack` (`visit`/`visitModal`).
- Native `<dialog>`: top-layer, `::backdrop`, Esc and backdrop-click close
  (gated by `closeExplicitly` / `closeOnClickOutside`), body scroll-lock.
- Nested/stacked modals, slideover, positions, and an event bus
  (`emit` / `on<Event>` / `listeners`).
- Deferred props: `<Deferred>` and `<WhenVisible>`.
- Local (client-only) modals via `<Modal name>` + `#name` / `visitModal('#name')`.
- Headless mode: `HeadlessModal`.
- Prefetch on `hover` / `click` / `mount` with `cacheFor`.
- Configuration: `putConfig` / `getConfig` / `resetConfig`.

### Vue client (`adonis-inertia-modal/vue`)

- Vue 3 plugin (`app.use(modal, { resolveComponent })`) sharing the framework-agnostic
  core with React; same component surface: `ModalRoot`, `ModalLink`, `Modal`,
  `useModal`, `useModalStack` (`visit`/`visitModal`), `Deferred`, `WhenVisible`,
  `HeadlessModal`, and `putConfig`/`getConfig`/`resetConfig`.
- Scoped-slot API: `<Modal v-slot="{ props, close }">`; reactive `useModal()`
  returns a `ComputedRef`. Extra `@event` listeners on `<ModalLink>` become
  event-bus listeners.
- Same native `<dialog>` behavior (top-layer, `::backdrop`, Esc / backdrop-click
  close, scroll-lock) and deep-link / nested / slideover / prefetch support.

### Tooling

- `node ace configure adonis-inertia-modal` registers the provider and prints wiring steps.
- Ships default styles via `import 'adonis-inertia-modal/styles.css'`.
