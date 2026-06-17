# Referência de features — inertiaui/inertia-modal

> Spec destilada da doc oficial (https://inertiaui.com/inertia-modal/docs) para guiar a
> implementação. Lembrar: inertiaui é **frontend-driven**; o nosso é **backend-driven**
> (o modal chega como prop `modal`). Marcamos o que muda no nosso modelo.
> Data: 2026-06-17

## Mapa de páginas da doc
Getting Started: Introduction, Requirements, Installation, Upgrade.
Usage: Basic Usage, Configuration, Modal Props, Base Route/URL, Close Modal, Event Bus,
Nested/Stacked Modals, Reload Props, Lazy Props, Deferred Props, Load When Visible,
Local Modals, Styling. Advanced: Custom App Mounting, Headless Mode.

## API React (alvo a espelhar)

### `<ModalLink>`
Abre uma rota em modal. Props: `href`, `method` (`get` default), `data`, `headers`,
`as` (`a` default; `button`/componente), `slideover`, config de estilo (ver abaixo),
`prefetch` (`hover`/`click`/`mount` ou array), `cacheFor` (ms, default 30000),
`navigate` (atualiza URL/history). Render prop expõe `{ loading }`.
Callbacks: `onStart`, `onSuccess`, `onError`, `onClose`, `onAfterLeave`,
`onPrefetching`, `onPrefetched`. Listeners de event bus chegam como `on<Event>`.

### `<Modal>` (página vira modal)
A página-modal embrulha o conteúdo em `<Modal>`. Slot/children como render prop expõe:
`{ close, reload, emit, getParentModal, getChildModal, ... }`.
Props/eventos: `onClose`, `onSuccess`, `onAfterLeave`, `onBlur`, `onFocus`, e
`on<Event>` para o event bus. Aceita `ref` com `.close()`, `.reload()`, `.emit()`,
`.getParentModal()`, `.getChildModal()`.

### Hooks
- `useModal()` — contexto do modal atual: `{ props, close, reload, emit, ... }`.
  Usado em componentes filhos para evitar prop drilling.
- `useModalStack()` — `{ visitModal(url, opts) }` para abertura programática. `opts`:
  `method`, `data`, `headers`, `props` (local), `config` (estilo/slideover),
  `listeners`, `navigate`, callbacks (`onSuccess`/`onClose`/...).

### Setup / mounting (React)
- `ModalStackProvider` envolve o app; `ModalRoot` no layout (depois do conteúdo).
- Helpers: `withInertiaModal`/`renderApp`/`setPageLayout` (açúcar). Manual:
  ```jsx
  // ModalLayout.jsx
  import { ModalRoot } from '@inertiaui/modal-react'
  export default ({ children }) => (<>{children}<ModalRoot /></>)

  createInertiaApp({
    resolve: (name) => resolvePageComponent(...).then(setPageLayout(ModalLayout)),
    setup({ el, App, props }) {
      createRoot(el).render(<ModalStackProvider><App {...props} /></ModalStackProvider>)
    },
  })
  ```

## Configuração (`putConfig`/`getConfig`/`resetConfig`)
Global: `type` (`modal`), `navigate`, `useNativeDialog`, `appElement` (`#app`), e blocos
`modal` e `slideover`. Por-modal (em `ModalLink`/`Modal`, link tem precedência):
| Opção | Default modal | Default slideover |
|---|---|---|
| `closeButton` | `true` | `true` |
| `closeExplicitly` (sem backdrop/Esc) | `false` | `false` |
| `closeOnClickOutside` | `true` | `true` |
| `maxWidth` (`sm`..`7xl`) | `2xl` | `md` |
| `paddingClasses` | `p-4 sm:p-6` | `p-4 sm:p-6` |
| `panelClasses` | `bg-white rounded` | `bg-white min-h-screen` |
| `position` | `center` (`top`/`center`/`bottom`) | `right` (`left`/`right`) |
| `slideover` | `false` | — |
Override parcial: `putConfig('modal.closeButton', false)`.

## Comportamentos por feature (e impacto no NOSSO backend)

- **Modal props** — props do backend e `data` do link são lidas igual (props do
  componente ou `useModal().props`). No nosso modelo elas vivem em `modal.props`.
- **Base route/URL** — `inertia.modal(c, props).baseRoute()/baseUrl()`. ✅ já temos.
  Acesso direto usa baseUrl como fundo; via link a URL vem da rota atual (`navigate`).
  O redirector do Laravel é estendido p/ `back()` voltar à base route — no Adonis o
  equivalente é o `redirectUrl` que já calculamos (header/referer/baseUrl).
- **Close modal** — botão default, `close` via slot/ref, fechar+redirect,
  `closeExplicitly`. URL/history: fechar navega para `redirectUrl`. (frontend)
- **Reload props** — `reload({ only, except, data, headers, onStart/onSuccess/... })`
  via slot/ref. Usa partial reload do Inertia mirando props do modal.
  ⚠️ No nosso server o cherry-pick é só top-level → `modal.props.*` é resolvido pela
  nossa lib (`unpackDotProps`, já feito). O `reload({ only: ['modal.props.x'] })` do
  cliente precisa casar com isso.
- **Nested/stacked** — `ModalLink` dentro de `Modal` empilha automaticamente;
  `getParentModal()/getChildModal()`. (frontend: pilha no `ModalStackProvider`).
- **Event bus** — `emit(event, payload)` do modal; pai escuta via `on<Event>` no
  `ModalLink`/`Modal` ou `listeners` no `visitModal`. (frontend)
- **Lazy props** — `Inertia::lazy(fn)` (= `inertia.optional` no Adonis); carrega via
  `reload({ only: [...] })`. ✅ server suporta `inertia.optional`.
- **Deferred props** — `Inertia::defer(fn)` + `<Deferred data="...">`. ✅ `inertia.defer`.
- **Load when visible** — `Inertia::optional(fn)` + `<WhenVisible data="...">` (Inertia
  v2+). ✅ `inertia.optional`.
  > ⚠️ lazy/deferred/optional DENTRO de `modal.props`: como o adapter não resolve dot
  > paths nem processa símbolos aninhados, vamos precisar tratar esses wrappers dentro
  > de `modal.props` na nossa lib (hoje `unpackDotProps` só resolve funções simples).
  > Item a endereçar na Fase 4.
- **Local modals** — `<Modal name="x">` + `ModalLink href="#x"` / `visitModal('#x',
  { props })`. Client-only, sem backend. (frontend puro)
- **Styling** — classes `im-*`; `useNativeDialog` + `dialog.im-dialog::backdrop` (CSS,
  Tailwind não pega `::backdrop`). Tamanhos/posições via config.
- **Headless** — `<HeadlessModal>` expõe `{ isOpen, shouldRender, onTopOfStack, index,
  close, setOpen, reload, emit, getChildModal, getParentModal, config, modalContext,
  afterLeave }`; UI por conta do dev.

## Implicações já capturadas para a nossa implementação
1. `modal.props` precisa suportar, além de dot-notation, os wrappers
   `optional/defer/merge` do Adonis (Fase 4).
2. O `reload` do cliente mira `modal.props.*`; nossa resolução own-side precisa casar
   com `only/except` nesses paths (parte feita; validar na Fase 2).
3. Config global (`putConfig`) + por-modal (props no link/Modal) — replicar o modelo de
   merge com precedência do link (Fase 5).
4. `redirectUrl` já cobre o "voltar à base route" do redirector do Laravel.

# References

https://inertiaui.com/inertia-modal/docs/basic-usage
https://inertiaui.com/inertia-modal/docs/configuration
https://inertiaui.com/inertia-modal/docs/modal-props
https://inertiaui.com/inertia-modal/docs/base-route-url
https://inertiaui.com/inertia-modal/docs/close-modal
https://inertiaui.com/inertia-modal/docs/event-bus
https://inertiaui.com/inertia-modal/docs/nested-stacked-modals
https://inertiaui.com/inertia-modal/docs/reload-props
https://inertiaui.com/inertia-modal/docs/lazy-props
https://inertiaui.com/inertia-modal/docs/deferred-props
https://inertiaui.com/inertia-modal/docs/load-when-visible
https://inertiaui.com/inertia-modal/docs/local-modals
https://inertiaui.com/inertia-modal/docs/styling
https://inertiaui.com/inertia-modal/docs/custom-app-mounting
https://inertiaui.com/inertia-modal/docs/headless-mode