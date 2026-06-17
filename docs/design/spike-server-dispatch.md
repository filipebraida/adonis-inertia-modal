# Spike: viabilidade do backend-driven no AdonisJS

> Investigação do código-fonte de `@adonisjs/inertia`, `@adonisjs/http-server`,
> `lepikhinb/momentum-modal` e `emargareten/inertia-modal`.
> Data: 2026-06-17
> **Conclusão: VIÁVEL.** Todos os mecanismos necessários existem no AdonisJS.

---

## 1. Como as libs Laravel realmente funcionam

Ambas implementam um objeto `Modal` (Responsable) com `baseRoute()/baseURL()` e um
método `render()` que escolhe **um de três caminhos** conforme os headers da request.
O segredo é **injetar o modal como prop compartilhada** (`Inertia::share(['modal' =>
payload])`) e deixar a página de fundo (backdrop) ser renderizada normalmente — o
modal "pega carona" como prop `modal`.

### Caminho A — modal aberto via link (request já é Inertia)
- emargareten: `renderModal()` devolve **só** o page object do modal como JSON com o
  header de resposta **`X-Inertia-Modal: true`**, sem re-renderizar o fundo. O frontend
  vê esse header, mantém a página atual e empilha o modal.
- momentum: quando há `X-Inertia` + `X-Inertia-Partial-Component`, re-renderiza **o
  componente de fundo** (partial barato) e o `modal` vem junto via shared prop.

### Caminho B — recarregar fundo (refreshBackdrop / partial component)
- Re-renderiza o componente de fundo (`X-Inertia-Partial-Component`) com dados frescos,
  carregando o `modal` compartilhado.

### Caminho C — acesso direto pela URL (não é request Inertia) ⭐ o ponto crítico
1. `Inertia::share(['modal' => payload])`.
2. Cria uma **sub-request GET** para a `redirectURL()`/baseURL (copiando query,
   cookies, files, server, headers, json, user, sessão da request original).
3. Troca o request global (`app()->instance('request', ...)`).
4. **Despacha a base route**:
   - emargareten: `$router->dispatch($request)` — pipeline **completo** (middleware).
   - momentum: `router->match()` + roda só o middleware `SubstituteBindings` + `$route->run()`.
5. A controller da base route chama `Inertia::render('users/index', baseProps)` e o
   resultado já inclui `props.modal` (porque foi compartilhado). No `finally`, restaura
   o request original.

### Protocolo de headers (a "API de fio")
| Header | Direção | Uso |
|---|---|---|
| `X-Inertia-Modal: true` | **response** | marca o payload como modal (frontend empilha) |
| `X-Inertia-Modal-Key` | request/response | id da instância do modal (history/stack) |
| `X-Inertia-Modal-Redirect` | request | para onde voltar ao fechar o modal |
| `X-Inertia` / `X-Inertia-Partial-Component` / `X-Inertia-Partial-Data` | request | reutilizados do protocolo padrão do Inertia |

### Shape do payload `modal`
```jsonc
{
  "component": "users/show",     // nome do componente do modal (transformado)
  "props": { "user": { } },      // props do modal (dot-props desempacotados)
  "baseURL": "/users",           // (momentum) url de fundo
  "redirectURL": "/users",       // para onde voltar ao fechar
  "key": "uuid",                 // instância (reusada em sparse reload / validação)
  "nonce": "uuid"                // (momentum) evita reuso indevido
}
```

### Detalhes finos que valem ouro (do emargareten)
- **`modal.props.*` em partial reload:** props com chave em dot-notation
  (`'stats.today' => ...`) são desempacotadas para estrutura aninhada
  (`unpackDotProps`), casando com o motor de partial/merge nativo do Inertia.
  `router.reload({ only: ['modal.props.stats'] })` funciona.
- **`modalKey()`:** reusa a key do cliente em *sparse reload* (`only: ['modal.props.*']`)
  e quando há **erros de validação** (para o `onError` do form chegar sem remontar o
  modal); gera key nova numa navegação de modal fresca.
- **`exclude_shared_props`:** ao montar o payload, exclui certas shared props para não
  duplicar dados pesados dentro do modal.

---

## 2. Mapeamento para o AdonisJS (o que existe)

Verificado no código-fonte (`/tmp/adonis-spike`):

| Mecanismo Laravel | Equivalente AdonisJS | Status |
|---|---|---|
| `Inertia::share(['modal'=>...])` | `ctx.inertia.share({ modal })` — empilha em `#sharedStateProviders`, mesclado em qualquer `render()` posterior | ✅ existe |
| `Inertia::render($c, $props)` | `ctx.inertia.render(component, props)` — devolve PageObject (request Inertia) ou HTML (acesso direto) | ✅ existe |
| `request()->header()` | `ctx.request.header(InertiaHeaders.*)` | ✅ |
| `JsonResponse(page, 200, headers)` | `ctx.response.header('x-inertia-modal','true'); return pageObject` | ✅ |
| cherry-pick de partial props | `Inertia#buildPageProps` já faz via `requestInfo` (only/except/partialComponent) | ✅ |
| defer/merge/optional/always/deepMerge | métodos na instância `ctx.inertia` (`props.ts`) | ✅ |
| `route()` (nome → url) | `router.builder()/makeUrl(name, params)` | ✅ |
| match URL → rota | `router.match(url, 'GET', shouldDecodeParam, hostname)` → `{ route, params, routeKey, subdomains }` | ✅ existe |
| rodar handler da rota | `route.execute(routeJSON, resolver, ctx, errorResponder)` (executor.ts) | ✅ existe (ver ressalva) |
| classe `Inertia` extensível | **exportada** de `@adonisjs/inertia` → dá pra estender via prototype + module augmentation | ✅ |

`InertiaHeaders` exportado; valores em `headers.ts`.

---

## 3. O ponto crítico (acesso direto) no AdonisJS — abordagem recomendada

Laravel troca um `request` **global** (`app('request')`). No AdonisJS **não há request
global** — tudo vive no `ctx`. Então o re-dispatch é diferente. Há duas opções:

### ❌ Opção "full dispatch" (`route.execute`) — NÃO recomendada como padrão
Rodar `route.execute(baseRoute, resolver, ctx, errorResponder)` reexecuta **toda a
pilha de middleware** da base route. **Armadilha:** isso inclui o
`InertiaMiddleware.init()`, que faz `ctx.inertia = manager.createForRequest(ctx)` —
criando uma **instância nova** e **descartando o `share({modal})`** que fizemos. Além
de re-rodar auth/session duas vezes. Risco alto.

### ✅ Opção recomendada — invocar o handler da base route manualmente no mesmo `ctx`
1. `ctx.inertia.share({ modal: payload })`.
2. `const base = router.match(baseURL, 'GET', shouldDecodeParam, hostname)`.
3. Ajustar o `ctx` para a base route: `ctx.params = base.params`, `ctx.route =
   base.route`, `ctx.routeKey = base.routeKey`, `ctx.subdomains = base.subdomains`.
4. Resolver e invocar **só o handler** da base route (de `base.route.handler` —
   string `Controller.method`, array `[Controller, 'method']` ou função; resolver a
   controller pelo container e chamar o método com `ctx`). Replicar só o
   `finalHandler` do `executor.ts`, **sem** a pilha de middleware global.
5. A controller chama `ctx.inertia.render('users/index', baseProps)`. Como **não** é
   request Inertia (acesso direto), `render` devolve o HTML shell já com `props.modal`.
6. Restaurar `ctx.params/route/...` se necessário (geralmente fim da request).

**Vantagens vs. Laravel:**
- O `page.url` usa `ctx.request.url(true)` = a **URL do modal** → o navegador
  permanece em `/users/5/tweets/42` (deep-link correto, melhor que o swap do Laravel).
- Controle total: não re-roda auth/session/inertia-middleware.

**Ressalvas a validar em app real:**
- AdonisJS **não tem** route-model-binding implícito por padrão — controllers acessam
  `ctx.params.id` e fazem `findOrFail`. Logo, setar `ctx.params` basta na maioria dos
  casos. (Se o projeto usar o binding opcional, replicar essa etapa.)
- Middleware específico da base route (ex.: um `can:view` por rota) **não** roda nesse
  caminho manual. Decidir: (a) aceitável (a modal route já passou pela auth), ou
  (b) rodar seletivamente o middleware da base route. Começar com (a).

---

## 4. Como expor `inertia.modal(...)`

A classe `Inertia` **não** é `Macroable`, mas **é exportada**. Opções:

- **(A) Prototype + module augmentation (idiomático, recomendado):**
  ```ts
  // provider (boot)
  import { Inertia } from '@adonisjs/inertia'
  // declare module '@adonisjs/inertia' { interface Inertia<Pages> { modal(...) } }
  Inertia.prototype.modal = function (component, props) {
    return new ModalBuilder(this, /* ctx */, component, props)
  }
  ```
  Como `ctx.inertia` é instância dessa classe, o método fica disponível como
  `ctx.inertia.modal('users/show', { user }).baseRoute('users.index')`.
  > A `Inertia` guarda `ctx` como `protected` — o builder precisa do `ctx`. Avaliar:
  > guardar `ctx` acessível, ou o builder receber `ctx` via `ctx.inertia` (ele já o
  > tem internamente). Talvez patch no construtor/middleware para expor.

- **(B) Helper standalone (sem patch):** `return modal(ctx, 'users/show', props).baseRoute(...)`.
  Mais simples e sem mexer em internals, porém menos "idiomático".

Recomendação: começar com **(B)** no spike de implementação (zero risco com internals),
e migrar para **(A)** quando estabilizar a API.

O `ModalBuilder` deve ser **awaitable** (implementar `then`) ou ter `.render()`
terminal, devolvendo o mesmo tipo de `inertia.render` (string | PageObject), porque o
`useReturnValue` do AdonisJS faz `response.send(value)` no retorno do controller (não
existe auto-resolução de "Responsable" como no Laravel).

---

## 5. Esboço de API (proposta)

```ts
// Controller
export default class TweetsController {
  async show({ inertia, params }: HttpContext) {
    const tweet = await Tweet.findOrFail(params.id)
    return inertia.modal('tweets/show', { tweet })
      .baseRoute('users.show', { id: tweet.userId })
    // .baseUrl('/users/5') | .refreshBackdrop() | .with({...})
  }
}
```

```ts
// Frontend (plugin + ModalRoot + ModalLink + useModal) — próximo spike
<ModalLink href="/users/5/tweets/42">abrir</ModalLink>
// e <ModalRoot /> no layout lê props.modal e empilha
```

---

## 6. Próximos passos

1. **Implementar o `ModalBuilder` server-side** (caminhos A/B/C) seguindo a seção 3.
   - Spike menor: validar o caminho C (re-dispatch manual) num app de exemplo real
     do starter kit Inertia do AdonisJS.
2. Definir `ModalHeaders` (`X-Inertia-Modal`, `-Key`, `-Redirect`) reaproveitando
   `InertiaHeaders`.
3. Implementar desempacotamento de `modal.props.*` e a lógica de `key` (sparse reload
   + validação) — portar de emargareten.
4. Frontend: plugin que intercepta `<ModalLink>`, lê o header/`props.modal`, mantém
   stack e renderiza (Vue primeiro).
5. Empacotar com o `pkg-starter-kit` (ver
   [`../research/adonis-package-starter-kit.md`](../research/adonis-package-starter-kit.md)).

## 7. Referências de código (lidas no spike)
- `@adonisjs/inertia`: `src/inertia.ts` (`render/page/share/requestInfo`),
  `src/inertia_middleware.ts` (`init/share/getValidationErrors/dispose`),
  `src/headers.ts`, `src/props.ts`, `index.ts` (exporta `Inertia`).
- `@adonisjs/http-server`: `src/server/factories/route_finder.ts` (`router.match` +
  `route.execute`), `src/router/executor.ts` (pipeline + `useReturnValue`),
  `src/router/factories/use_return_value.ts` (`canWriteResponseBody` checa
  `hasLazyBody`), `src/router/route.ts` (`getHandler`, `toJSON.execute`).
- `momentum/src/Modal.php`, `momentum/src/ModalServiceProvider.php`.
- `emargareten/src/Modal.php` (3 caminhos, `unpackDotProps`, `modalKey`).
