# Plano detalhado por fase — adonis-modal

> Complementa [`development-plan.md`](./development-plan.md) com design, referências de
> código real e estratégia de teste (TDD) por fase.
> Fontes estudadas (clonadas em /tmp/adonis-spike): `@adonisjs/inertia` (4.x),
> `@adonisjs/http-server`, `inertiaui/modal` (react/src + common), `momentum-modal`,
> `emargareten/inertia-modal`.
> Data: 2026-06-17

## Descoberta-chave (define o frontend)

O `inertiaui/modal` é **híbrido**:
- **Frontend-driven**: `ModalLink` → `useModalStack().visit()` faz request via axios e
  `pushFromResponseData()` monta o modal e empilha (sem page-swap do Inertia).
- **Backend-driven**: `ModalRoot` observa a page prop **`_inertiaui_modal`**
  (`react/src/ModalRoot.tsx:686–836`) e chama `pushFromResponseData()`.

**O nosso modelo = o caminho backend-driven deles.** A nossa `ModalPayload`
(`{component, props, baseUrl, redirectUrl, key}`) corresponde ao `_inertiaui_modal`
deles (`{component, props, baseUrl, meta}`). Logo, podemos **espelhar a camada de
pilha/Modal/config/UI** do inertiaui e alimentá-la a partir de `page.props.modal`,
em vez do axios.

Mapa de equivalências:
| inertiaui | adonis-modal |
|---|---|
| page prop `_inertiaui_modal` | page prop `modal` (✅ já enviamos) |
| `ModalResponseData {component, props, baseUrl, meta.deferredProps}` | `ModalPayload {component, props, baseUrl, redirectUrl, key}` |
| header `X-InertiaUI-Modal-Base-Url` | `X-Inertia-Modal` / `-Key` / `-Redirect` (✅) |
| `Modal.id` | `modal.key` (✅) |
| `pushFromResponseData()` (`ModalRoot.tsx:383`) | idem (a portar) |
| `config.ts` (putConfig/getConfig) | idem (a portar quase 1:1) |

---

## Fase 0 — Server-side integração (EM ANDAMENTO)

**Objetivo:** provar o `ModalResponse` num app AdonisJS real (router + controllers).

**Referências:** `@adonisjs/inertia` `tests/helpers.ts` (`setupApp` via `IgnitorFactory`,
`setupViewMacroMock`), `tests/inertia.spec.ts` (uso de `HttpContextFactory` +
`InertiaFactory`). Router: `http-server` `factories/request.ts` (merge `{url, method}`),
`router.match/commit/makeUrl`.

**Design do teste:**
- `tests/helpers.ts`: portar `setupApp([providers])` (core + edge + vite + inertia +
  nosso `modal_provider`) e `setupViewMacroMock()`.
- Registrar rotas no `router` (handlers inline que chamam `inertia.render`), `router.commit()`.
- Criar `ctx` via `HttpContextFactory` (URL do modal via `RequestFactory.merge({url})`);
  criar `ctx.inertia` via `InertiaManager` do container; chamar `inertia.modal(...)`.

**Tarefas (TDD):**
- [ ] Acesso direto (sem `x-inertia`) → `#renderBackdrop` re-despacha a base route; com
      `setupViewMacroMock` o resultado traz `page.props.modal` + props do backdrop.
- [ ] Path A (com `x-inertia` + partial `only=['modal']`) → page object só com `modal`.
- [ ] Validação: flash `inputErrorsBag` presente → `key` reaproveitada.
- [ ] Redirect: `X-Inertia-Modal-Redirect` > referer > baseUrl; `forceBase`.
- [ ] `refreshBackdrop` força re-dispatch mesmo com `x-inertia`.

**Aceite/commit:** todos verdes + lint/typecheck.

---

## Fase 1 — Núcleo React (MVP) ⭐

**Objetivo:** abrir via link, renderizar, fechar e deep-link, ponta-a-ponta.

**Referências:** `inertiaui/react/src/` — `ModalRoot.tsx` (stack, `pushFromResponseData`
`:383`, watcher de page prop `:686–836`), `types.ts` (`Modal`, `ModalStackContextValue`),
`ModalRenderer.tsx` (`useModalIndex`), `useModal.ts`, `ModalLink.tsx`,
`Modal.tsx`/`ModalContent.tsx` (UI), `config.ts`.

**Design (backend-driven, simplificado):**
- `src/client/react/` exportado em `adonis-modal/react` (entrypoints no tsdown).
- `ModalStackProvider` — context com `stack`, `push/pushFromResponseData`, `closeAll`,
  `visitModal` (porta enxuta do `ModalRoot.tsx`).
- `ModalRoot` — `useEffect` sobre `usePage().props.modal`; ao mudar e não estar na pilha
  (compara por `key`), `pushFromResponseData(modal)`. Resolve `modal.component` via o
  `resolve()` do `createInertiaApp` (guardar resolver em `initFromPageProps`/setup).
- `ModalRenderer` + `useModalIndex` (context do índice) → `useModal()` = `stack[index]`.
- `Modal` (UI mínima, `<dialog>` nativo) com render prop `{ close }`.
- `useModal()`: `props`, `close()`, `redirect()`.
- Fechar: remove do stack + navega para `redirectUrl` (history). 

**⚠️ Risco nº1 — mecânica do `ModalLink` (primeiro spike da fase):**
Para o servidor cair no **Path A** e preservar o backdrop, a visita precisa manter o
componente atual e trazer só `modal`. Duas opções a avaliar:
1. `router.visit(href, { only: ['modal'], preserveState: true, preserveScroll: true,
   headers: { 'x-inertia-modal-key', 'x-inertia-modal-redirect' } })` — confirmar se o
   Inertia envia `X-Inertia-Partial-Component` (componente atual) nesse caso.
2. Mirror do inertiaui: request **raw** (axios/`http` do Inertia) para `href` com os
   headers, lê `page.props.modal` da resposta e `pushFromResponseData` **sem** page-swap.
Decidir no spike; provavelmente (1) se o partial-component vier correto, senão (2).

**Tarefas (TDD onde fizer sentido):**
- [ ] Spike do risco nº1 (teste de unidade da função de visita: headers/only corretos).
- [ ] `config.ts` (porta de putConfig/getConfig/resetConfig) + teste.
- [ ] `ModalStackProvider`/stack reducer (push/close/closeAll por `key`) + teste de unidade.
- [ ] `pushFromResponseData` resolvendo componente (resolver mockado) + teste.
- [ ] `ModalLink`, `Modal`, `useModal` (render via `@testing-library/react` se viável).
- [ ] App de exemplo (Inertia React) p/ verificação manual (abrir/fechar/deep-link).

**Estratégia de teste frontend:** unidade para lógica pura (config, stack reducer,
construção da visita, `pushFromResponseData`); componentes com
`@testing-library/react` + `jsdom` se couber no japa; e o app de exemplo para o e2e
manual. (Decidir runner de componente na fase.)

**Aceite/commit:** lógica verde + app de exemplo demonstrando o fluxo.

---

## Fase 2 — Formulários, validação e reload

**Objetivo:** form no modal com erros sem remontar; reload de `modal.props.*`.

**Referências:** inertiaui `reload` no `Modal`/`HeadlessModal` (`reload(options)` em
`types.ts ReloadOptions`), nosso server (`#modalKey` reaproveita key em validação;
`unpackDotProps`).

**Design:** `useModal().reload({only,except,data,headers,callbacks})` dispara partial
reload mirando `modal.props.*`; o server resolve via `unpackDotProps` (✅). A `key`
estável em resposta de validação evita remontar o form (✅ server).

**Tarefas (TDD):**
- [ ] Server: teste de `reload only=['modal.props.x']` retornando só aquele path.
- [ ] Server: teste de resposta de validação mantendo `key`.
- [ ] Front: `reload()` monta a visita parcial correta (teste de unidade).
- [ ] Front: erros do `usePage().props.errors` acessíveis no modal (`useModal().errors`).
- [ ] App de exemplo: form com validação.

**Aceite/commit:** verde + demo do form com erro mantendo o modal.

---

## Fase 3 — Pilha, slideover e comunicação

**Objetivo:** modais aninhados, slideover, event bus.

**Referências:** inertiaui `ModalRoot.tsx` (stack/z-order, `onTopOfStack`, `index`),
`SlideoverContent.tsx`, event bus (`Modal.on/off/emit`, `registerEventListenersFromProps`
em `ModalLink.tsx`), `getParentModal/getChildModal` (`types.ts`).

**Design:** o stack já suporta múltiplos; renderizar todos com z-order por índice;
`slideover` via `config`/prop; event bus no objeto `Modal` (on/off/emit) + `on<Event>`
no `ModalLink` (`registerEventListenersFromProps`) + `listeners` no `visitModal`.

**Tarefas (TDD):**
- [ ] Stack: push/pop múltiplos, `onTopOfStack`/`index` corretos (teste de unidade).
- [ ] Event bus: emit→on entre pai/filho (teste de unidade).
- [ ] `SlideoverContent` + `position` (render test).
- [ ] `visitModal` programático + `listeners`.
- [ ] App de exemplo: modal-de-modal + emit.

**Aceite/commit:** verde + demo aninhado e slideover.

---

## Fase 4 — Carregamento de props avançado

**Objetivo:** deferred/lazy/load-when-visible em `modal.props`; local modals.

**Referências:** inertiaui `Deferred.tsx`, `WhenVisible.tsx`, local modals
(`registerLocalModal`/`removeLocalModal` em `types.ts`, páginas `Local*.jsx`),
nosso server (`inertia.optional/defer/merge`).

**⚠️ Risco nº2 (server):** o adapter não processa símbolos `optional/defer/merge`
**aninhados** dentro de `modal.props` nem dot-paths. `unpackDotProps` hoje só resolve
funções simples. Precisa: detectar/avaliar esses wrappers dentro de `modal.props` e
expor `meta.deferredProps` (como o `ModalResponseData.meta` do inertiaui) para o
`<Deferred>` saber o que aguardar.

**Tarefas (TDD):**
- [ ] Server: `modal.props` com `inertia.defer(fn)` → vem ausente + listado em meta.
- [ ] Server: `inertia.optional(fn)` carregado só sob `reload({only})`.
- [ ] Front: `<Deferred data="...">` e `<WhenVisible data="...">` (render tests).
- [ ] Front: local modals (`<Modal name="x">` + `href="#x"` + `visitModal('#x',{props})`).

**Aceite/commit:** verde + demos.

---

## Fase 5 — DX, estilo & polish

**Objetivo:** config completa, estilo/a11y, headless, prefetch, TS, `configure` stubs.

**Referências:** inertiaui `config.ts` (✅ portado na Fase 1), `constants.ts`
(`maxWidthClasses`), `ModalContent/SlideoverContent` (classes `im-*`, `<dialog>`,
`::backdrop`), `HeadlessModal.tsx`, prefetch (`ModalLink.tsx` + `cache.ts`),
`CloseButton.tsx`. Setup: `inertiauiModal.ts` (`setPageLayout`, `renderApp`).

**Tarefas (TDD onde fizer sentido):**
- [ ] Config completa (blocos modal/slideover, override por modal, precedência do link).
- [ ] Estilo: `<dialog>` nativo, scroll-lock, foco (focus trap), ESC, `::backdrop`,
      tamanhos/posições; classes `im-*`.
- [ ] `HeadlessModal`.
- [ ] Prefetch (`hover/click/mount`, `cacheFor`, cache).
- [ ] TS defs públicas (`ModalLink`/`Modal`/`useModal`/`visitModal`/config).
- [ ] `configure.ts`: stubs do setup React (`ModalLayout`, wiring `createInertiaApp`,
      ajuste de Tailwind `@source`) + página de exemplo.
- [ ] Doc de custom app mounting.

**Aceite/commit:** `node ace configure adonis-modal` deixa app React pronto.

---

## Fase 6 — Port Vue

**Objetivo:** paridade Vue. **Referências:** `inertiaui/vue/src/` (espelho do react/src).
Reusar a lógica agnóstica (config, stack, helpers, `@inertiaui/vanilla` dialog utils são
framework-agnostic — considerar extrair um `src/client/core` compartilhado já na Fase 1).

**Tarefas:** plugin + `ModalRoot`/`ModalLink`/`Modal`/`useModal`/`useModalStack`/
`HeadlessModal`/config em Vue; portar a suíte de testes.

**Aceite/commit:** paridade com React.

---

## Nota de refatoração (decidir na Fase 1)
O inertiaui separa utilidades agnósticas (`common/`, `@inertiaui/vanilla` para
dialog/focus-trap/escape). Vale criar `src/client/core` (config, stack, helpers, tipos)
desde a Fase 1 para Vue (Fase 6) reusar — evita reescrever a lógica.
