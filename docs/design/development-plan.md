# Plano de desenvolvimento — adonis-modal

> Referência de UX/features: https://inertiaui.com/inertia-modal (frontend-driven).
> Spec destilada: [`../research/inertiaui-feature-reference.md`](../research/inertiaui-feature-reference.md).
> O nosso é **backend-driven** — o modal chega como prop `modal` no page object.
> Frontend começa por **React**; Vue depois.
> Realinhado em: 2026-06-17

## Status atual
- ✅ Server-side: `ModalResponse` (`inertia.modal().baseRoute()/baseUrl()/with()/
  refreshBackdrop()/forceBase()`), 3 caminhos (via link / refresh / acesso direto com
  re-dispatch), `unpackDotProps`, lógica de `key`, `redirectUrl`. Provider injeta router.
- ✅ Testes unitários (HttpContextFactory + InertiaFactory), lint, build, typecheck.
- ⬜ Falta: integração do server em app real; **todo o frontend**.

## Princípios
1. **Core-first**: um caminho ponta-a-ponta mínimo antes das features.
2. **React-first**; Vue depois espelhando a API.
3. **Validar em app de exemplo** desde a Fase 1.
4. **Paridade de API com o inertiaui** adaptada ao backend-driven.

## Arquitetura do frontend (peças → responsabilidade)
- `ModalStackProvider` — context com a **pilha** de modais; envolve o app.
- `ModalRoot` — lê `page.props.modal`, **resolve o componente pelo nome** (mesmo
  resolver de páginas), renderiza cada item da pilha (com transições/z-order).
- `ModalLink` — dispara a visita que vira modal (ver risco nº1).
- `Modal` — a página-modal se embrulha; expõe `{ close, reload, emit, getParentModal,
  getChildModal }` via render prop / `ref`.
- `useModal()` — contexto do modal atual (`props`, `close`, `reload`, `emit`, `errors`).
- `useModalStack()` → `visitModal(url, opts)` — abertura programática + modais locais.
- `HeadlessModal` — mesma lógica, sem UI.
- Config: `putConfig/getConfig/resetConfig` (global `modal`/`slideover` + override por modal).

## ⚠️ Riscos técnicos a destravar cedo
1. **Mecânica do `ModalLink`** (Fase 1): para cair no Path A, a visita precisa de
   `X-Inertia-Partial-Component: <componente atual>` + `only=['modal']` + headers
   `X-Inertia-Modal-Key`/`-Redirect`. O `router.visit()` padrão faz partial da *mesma*
   URL; aqui é URL diferente pedindo só `modal`. Provar com um wrapper sobre
   `router.visit`/axios do Inertia.
2. **Wrappers de prop dentro de `modal.props`** (Fase 4): `optional/defer/merge` do
   adapter não são processados aninhados; hoje `unpackDotProps` só resolve funções
   simples. Precisa de tratamento próprio para lazy/deferred/load-when-visible no modal.
3. **Resolução do componente do modal no `ModalRoot`** (Fase 1): reusar o `resolve()`
   do `createInertiaApp` para carregar `modal.component` por nome.
4. **SSR** (Fase 5): comportamento da pilha no primeiro paint.

---

## Fases

### Fase 0 — Fechar o server-side (integração) 🔜 EM ANDAMENTO
- [ ] Teste de integração do **acesso direto** (re-dispatch) com `IgnitorFactory` +
      rotas/controllers reais → backdrop renderiza com `props.modal`.
- [ ] Teste do **Path A** (via link / partial `only=['modal']`) em app real.
- [ ] Teste de **validação** (erros do `share()` chegam; `key` reaproveitada).
- [ ] Teste do **redirect** (`X-Inertia-Modal-Redirect` > referer > baseUrl; `forceBase`).
- [ ] Teste do **refreshBackdrop**.
- **Aceite:** server provado ponta-a-ponta sem depender do frontend.

### Fase 1 — Núcleo React (MVP ponta-a-ponta) ⭐ "o núcleo"
- [ ] `src/client/react` + export `adonis-modal/react`; build (tsdown) dos entrypoints.
- [ ] **Destravar risco nº1** (visita do `ModalLink`).
- [ ] `ModalStackProvider` (estado da pilha) + `ModalRoot` (resolve+render via `<dialog>`).
- [ ] Wiring: `setPageLayout(ModalLayout)` + `ModalStackProvider` no `setup` do
      `createInertiaApp` (e helper `withInertiaModal`/`renderApp` para o caso comum).
- [ ] `ModalLink` mínimo: `href`, `method`, `data`, `headers`, `as`, `onClose`,
      render prop `{ loading }`.
- [ ] `Modal` mínimo: render prop `{ close }`, botão de fechar default.
- [ ] `useModal()`: `props`, `close()`, `redirect()`.
- [ ] Fechar → navega para `redirectUrl` (history correto).
- [ ] App de exemplo (Inertia React starter do AdonisJS) p/ verificação manual.
- **Aceite:** abrir via link, renderizar, fechar e abrir direto pela URL (deep-link).

### Fase 2 — Formulários, validação e reload
- [ ] Submit dentro do modal; **erros sem remontar** (reuso de `key`, `onError`).
- [ ] `reload({ only, except, data, headers, onStart/onSuccess/onError/onFinish })` no
      `Modal`/`useModal`, mirando `modal.props.*` (validar com o `unpackDotProps`).
- [ ] Callbacks `onSuccess`/`onError`/`onStart` no `ModalLink`.
- **Aceite:** form com erro mantém modal+foco; reload parcial de prop do modal.

### Fase 3 — Pilha, slideover e comunicação
- [ ] Modais **empilhados/aninhados** (z-order, `onTopOfStack`, `index`).
- [ ] **Slideover** (`slideover`, `position` left/right) + posições do modal.
- [ ] **Event bus**: `emit(event, payload)`; pai escuta via `on<Event>` no
      `ModalLink`/`Modal` e `listeners` no `visitModal`; `getParentModal/getChildModal`.
- [ ] `useModalStack().visitModal(url, opts)` (abertura programática).
- **Aceite:** abrir modal de dentro de modal; emitir/escutar evento entre eles.

### Fase 4 — Carregamento de props avançado
- [ ] **Resolver risco nº2**: suportar `inertia.optional/defer/merge` dentro de
      `modal.props` (processar wrappers + casar com partial reload `only/except`).
- [ ] `<Deferred data="...">` (deferred props no modal).
- [ ] `<WhenVisible data="...">` (load-when-visible / `optional`).
- [ ] Lazy props (`optional` + `reload({ only })`).
- [ ] **Local modals**: `<Modal name="x">` + `ModalLink href="#x"` /
      `visitModal('#x', { props })` (client-only, sem backend).
- **Aceite:** modal com prop deferida/lazy/when-visible; modal local sem request.

### Fase 5 — DX, estilo & polish
- [ ] **Config**: `putConfig/getConfig/resetConfig` (blocos `modal`/`slideover`,
      override por modal com precedência do link): `closeButton`, `closeExplicitly`,
      `closeOnClickOutside`, `maxWidth`, `paddingClasses`, `panelClasses`, `position`,
      `useNativeDialog`, `appElement`, `navigate`.
- [ ] **Estilo**: classes `im-*`, `<dialog>` nativo + `::backdrop`, scroll-lock, foco,
      ESC, tamanhos/posições; blur/backdrop default.
- [ ] **Headless mode** (`HeadlessModal` expondo estado/controles).
- [ ] **Prefetch** (`hover`/`click`/`mount`, `cacheFor`, `onPrefetching/onPrefetched`).
- [ ] Callbacks restantes (`onAfterLeave`, `onBlur`, `onFocus`).
- [ ] **TypeScript defs** de `ModalLink`/`Modal`/`useModal`/`visitModal`/config.
- [ ] **`configure.ts`**: stubs publicando o setup do frontend (ModalLayout, wiring do
      `createInertiaApp`) + página de exemplo + ajuste de Tailwind (`@source`/content).
- [ ] **Custom app mounting** documentado (manual e via helper).
- **Aceite:** `node ace configure adonis-modal` deixa um app React pronto pra usar.

### Fase 6 — Port Vue
- [ ] Espelhar a API em Vue (`adonis-modal/vue`): plugin + `ModalStackProvider`,
      `ModalRoot`, `ModalLink`, `Modal`, `useModal`, `useModalStack`, `HeadlessModal`,
      config. Paridade de features e de testes.
- **Aceite:** paridade com React.

---

## Gaps do server descobertos na spec (a endereçar fora da Fase 0)
- **Wrappers de prop em `modal.props`** (optional/defer/merge) — Fase 4, risco nº2.
- **`navigate`/geração de URL** — confirmar que `page.url` (URL do modal) cobre o caso
  "via link" e o deep-link; alinhar com o `navigate` do cliente (Fase 1).
- **Config global do servidor?** A config do inertiaui é só client-side; manter assim
  (nada novo no server).

## Transversais (todas as fases)
- **App de exemplo** para verificação manual (desde a Fase 1).
- **Docs de uso** por feature (espelhando a navegação do inertiaui).
- **CI** (workflows do starter kit) rodando lint+test+build.
- **Compat Inertia v2/v3** ([`inertia-v3-compat.md`](./inertia-v3-compat.md)): isolar
  nomes de eventos do client (`inertia:invalid`→`httpException` etc.,
  `router.cancel`→`cancelAll`) e o setup de SSR atrás de pontos de extensão.

## Definição de "núcleo"
**Núcleo = Fase 0 + Fase 1.** Ao fim: lib utilizável ponta-a-ponta em React
(abrir/renderizar/fechar/deep-link) com server validado. O resto é incremento.

## Ordem de execução
`Fase 0` → `Fase 1` (núcleo) → `Fase 2` → `Fase 3` → `Fase 4` → `Fase 5` → `Fase 6`.
