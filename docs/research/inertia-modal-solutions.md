# Estudo: Soluções de Modal para Inertia.js

> Pesquisa realizada para fundamentar a criação de uma biblioteca de modais para o
> adapter oficial de Inertia.js do AdonisJS.
> Data: 2026-06-17

## 1. O problema

Em aplicações Inertia.js, modais são uma das partes mais incômodas de implementar
bem. O fluxo "ingênuo" (renderizar o modal só no frontend com estado local) sofre de
vários problemas:

- **Voltar para a página anterior** — ao fechar o modal ou usar o botão "voltar" do
  navegador, o estado fica inconsistente.
- **Erros de validação** — quando um formulário dentro do modal falha, o Inertia
  normalmente devolve a página inteira, fazendo o modal "piscar"/recarregar ou
  perder o contexto.
- **Deep-linking / URL** — não dá para compartilhar a URL de um modal aberto; abrir
  essa URL diretamente não funciona (não há página de fundo).
- **SEO / acessibilidade** — modais puramente client-side não têm rota própria.
- **Recarregar dados** (partial reloads) dentro do modal sem recarregar a página de
  fundo.
- **Modais empilhados** (stacked/nested) e slideovers.

As soluções da comunidade resolvem isso reaproveitando o próprio ciclo de
requisição/resposta do Inertia, sem exigir gerenciamento manual de estado.

---

## 2. As duas arquiteturas

Existem **dois grandes padrões** para resolver modais no Inertia. Entender a diferença
é o ponto central deste estudo, porque define toda a arquitetura da nossa lib.

### 2.1 Frontend-driven (sem mudanças no backend)

> Representante principal: **Inertia UI Modal** (`@inertiaui/modal-*`).

- O backend **não muda em nada**. Rotas e controllers continuam retornando páginas
  Inertia normais.
- No frontend, um componente `<ModalLink>` (substituto do `<Link>`) intercepta a
  navegação. Em vez de trocar a página inteira, ele faz a visita Inertia "por baixo"
  e renderiza o componente de destino dentro de um `<Modal>`, sobre a página atual.
- A página de destino é responsável por se "embrulhar" em `<Modal>`.

**Prós:** zero mudança no backend; qualquer rota vira modal; ótimo DX.
**Contras:** quando o modal é aberto **direto pela URL**, precisa de um mecanismo de
"base route/URL" para saber qual página renderizar de fundo. A lógica de
interceptação é mais complexa no cliente.

### 2.2 Backend-driven (rota define que é modal)

> Representantes: **Momentum Modal**, **emargareten/inertia-modal** (Laravel),
> **Inertia Rails Modal** (Rails).

- O controller decide que a resposta é um modal, ex.:
  `Inertia::modal('Users/Show', props)->baseRoute('users.index')`.
- A resposta carrega: **componente do modal**, **props** e a **base route/URL**
  (página de fundo).
- O frontend tem um componente `<Modal />` no layout que lê esse "envelope" e
  renderiza o modal por cima da página de fundo.
- Acesso direto pela URL: o backend despacha a base route pelo pipeline normal
  (middleware, model binding) e devolve a página de fundo + o modal por cima.

**Prós:** rotas próprias, bookmarkáveis e SEO-friendly; o backend controla tudo;
integra naturalmente com validação e redirects do Inertia.
**Contras:** exige suporte no backend (macro/renderer/middleware) — ou seja, é
exatamente onde a nossa lib AdonisJS precisa atuar.

---

## 3. Soluções por framework

### 3.1 Inertia UI Modal — Laravel (frontend-driven)

- Site/docs: https://inertiaui.com/inertia-modal/docs/introduction
- Repo: https://github.com/inertiaui/modal
- Pacotes: `@inertiaui/modal-vue`, `@inertiaui/modal-react`

**Componentes principais:**
- `<ModalLink>` — igual ao `<Link>` do Inertia, mas abre a rota em modal/slideover.
  Atributo `navigate` faz o modal atualizar o histórico do navegador (URL própria).
- `<Modal>` — container do modal usado dentro da página de destino.

**Requisitos:** React 19+ / Vue 3.4+, `@inertiajs/*` 2.3.15+, Tailwind 4+,
(no caso Laravel) PHP 8.2+, Inertia Laravel 2.0+.

**Recursos:**
- Modal **e** slideover
- Modais aninhados/empilhados (stacked)
- Reload de props dentro do modal
- Comunicação entre modais aninhados
- **Prefetch** para abertura mais rápida
- Suporte ao elemento nativo `<dialog>` do HTML (acessibilidade)
- Modo **headless** para UI customizada

**Arquitetura:** padrão *interceptor* — captura os eventos de visita do Inertia e
decide renderizar como modal, slideover ou navegação normal, preservando o roteamento
existente. Quando aberto direto pela URL, usa o conceito de **base URL** para
renderizar a página de fundo.

> Observação: o pacote tem um suporte oficial para Laravel, mas o lado frontend
> (`@inertiaui/modal-vue|react`) é, em essência, agnóstico de backend — o que o torna
> uma referência forte de DX. Existe inclusive integração com Rails via gem
> `inertia_rails-contrib` para suporte a base URL.

### 3.2 Momentum Modal — Laravel (backend-driven)

- Repo: https://github.com/lepikhinb/momentum-modal
- Pacote: `momentum-modal` (npm) + pacote Composer
- Faz parte do conjunto **Momentum** (Modal, Preflight, Paginator, Trail, Lock).

**Backend (macro `Inertia::modal`):**
```php
class ShowTweet extends Controller
{
    public function __invoke(User $user, Tweet $tweet)
    {
        return Inertia::modal('Tweets/Show')
            ->with(['user' => $user, 'tweet' => $tweet])
            ->baseRoute('users.show', $user); // página de fundo no acesso direto
    }
}
```

**Frontend:** registra um plugin de modal com um *resolver* de componente igual ao
resolver de páginas; coloca `<Modal />` no layout. O plugin intercepta a requisição
Inertia e renderiza o modal sobre a página de fundo preservada.

**Fluxo:**
1. Link navega para a URL do modal.
2. Frontend detecta a resposta de modal.
3. Renderiza o modal por cima da página de fundo (estado preservado).
4. Acesso direto à URL → `baseRoute` carrega o fundo, depois o modal sobrepõe.

Características: headless, rotas próprias bookmarkáveis, estado do fundo preservado.
Pioneiro da abordagem backend-driven (boa referência conceitual).

### 3.3 emargareten/inertia-modal — Laravel (backend-driven)

- Repo: https://github.com/emargareten/inertia-modal

A resposta do modal carrega **3 elementos**:
1. **Componente** (ex.: `'Users/Show'`)
2. **Props** — suportam recursos do Inertia: `defer()`, `merge()`, `once()`
3. **Base route** — página de fundo no acesso direto

```php
public function show(User $user): Modal
{
    return Inertia::modal('Users/Show', ['user' => $user])
        ->baseRoute('users.index');
}
```

**Acesso direto vs. via link:**
- *URL direta:* a base route é despachada pelo router normal do Laravel
  (middleware + model binding), a página base carrega com contexto completo e o modal
  sobrepõe.
- *Via link:* a página de fundo é preservada com os dados atuais enquanto o modal
  abre.

**Controle do fundo:**
- `refreshBackdrop()` — recarrega a base route com dados frescos.
- `forceBase()` — ignora o header de redirect do modal e força uma base route.

**Frontend:**
```js
// setup do plugin (Vue)
createApp({ render: () => h(App, props) })
  .use(plugin)
  .use(modal, {
    resolve: (name) => resolvePageComponent(`./Pages/${name}.vue`, pages),
  })
  .mount(el)
```
```vue
<!-- layout -->
<Modal />

<!-- dentro da página de modal -->
<script setup>
import { useModal } from 'inertia-modal'
const { show, close, redirect } = useModal()
</script>
```

**Partial reload** dentro do modal usa o caminho aninhado `modal.props.*`:
```js
router.reload({ only: ['modal.props.stats'] })
```
Isso preserva a estrutura de resposta esparsa do Inertia e deixa o `mergeProps()` /
`deepMergeProps()` nativos funcionarem.

### 3.4 Inertia Rails Modal — Rails (backend-driven)

- Docs: https://inertia-rails.dev/cookbook/inertia-modal
- Usa o frontend do **Inertia UI Modal** + gem `inertia_rails-contrib`.

```ruby
class UsersController < ApplicationController
  def edit
    render inertia_modal: {
      user:,
      roles: -> { Role.all },
    }, base_url: users_path
  end
end
```
```vue
<ModalLink navigate href="/users/create">Create User</ModalLink>
```

`base_url` = fallback quando o modal é aberto direto pela URL: ao visitar
`/users/create` diretamente, o sistema sabe que a base é `/users`, renderiza essa
página de fundo e mostra o modal por cima → acessível e SEO-friendly.

> Este é o exemplo mais didático de como integrar o **frontend agnóstico do Inertia
> UI** com um **backend que não é Laravel** — exatamente a posição da nossa lib
> AdonisJS.

### 3.5 Laravel Jetstream — componentes puros (não é "modal de rota")

- `DialogModal` e `ConfirmationModal`: componentes de modal client-side prontos
  (confirmação de ações destrutivas etc.).
- **Não** resolvem rota/URL/history — são só UI. Servem de referência para o design
  visual do componente, não para a arquitetura.

---

## 4. Mecanismos técnicos que toda solução precisa resolver

Resumo do que precisamos reimplementar/portar para o AdonisJS:

| Mecanismo | Frontend-driven (Inertia UI) | Backend-driven (Momentum/emargareten) |
|---|---|---|
| **Detecção do modal** | `<ModalLink>` intercepta a visita no cliente | Header HTTP custom (ex.: `X-Inertia-Modal`) + envelope na resposta |
| **Página de fundo (acesso direto)** | `base URL` resolvida no cliente | `baseRoute`/`base_url` despachada no backend pelo router |
| **Estado do fundo (via link)** | preservado no cliente | preservado (não re-renderiza o fundo) |
| **History / URL própria** | atributo `navigate` controla o push de history | rota real → URL própria nativa |
| **Validação / erros** | erros voltam via `errors` compartilhados; modal não recarrega | idem, com `errorBag` por modal |
| **Partial reload** | `reload` de props do modal | `only: ['modal.props.*']`, usa merge nativo |
| **Stacked/slideover** | suportado no cliente | depende da lib |
| **Prefetch** | suportado (Inertia UI) | — |

**Pontos sutis:**
- *Validação:* o segredo é o modal **não** disparar uma navegação completa quando o
  POST/PUT falha — os `errors` chegam como prop compartilhada e o formulário no modal
  os consome. `errorBag` isola erros por instância de modal (útil em modais
  empilhados).
- *Direct URL:* sem página de fundo, um modal sozinho na tela fica órfão. Por isso
  todas as soluções têm o conceito de **base route/URL**.
- *Partial reload aninhado:* manter as props do modal sob um namespace
  (`modal.props.*`) deixa o motor de merge do Inertia funcionar sem hacks.

---

## 5. AdonisJS: o que já temos e onde "plugar"

Adapter oficial: https://docs.adonisjs.com/guides/frontend/inertia
(`@adonisjs/inertia`, repo https://github.com/adonisjs/inertia)

**API server-side disponível (`ctx.inertia`):**
- `inertia.render(component, props, viewProps)`
- `inertia.optional(cb)` — só avaliado em partial reload
- `inertia.defer(cb, group?)` — carrega após o render inicial (agrupável)
- `inertia.always(cb)` — sempre incluído, mesmo em partial reload
- `inertia.merge(data)` / `inertia.deepMerge(data)`
- `inertia.location(url)` — redirect externo (409 + `X-Inertia-Location`)
- `inertia.clearHistory()` / `inertia.encryptHistory()`

**Middleware:** `app/middleware/inertia_middleware.ts` com método `share(ctx)` para
props globais (usuário, flash, **errors de validação**).

**Estrutura da resposta:** request inicial → HTML com `data-page`; requests
seguintes (header `X-Inertia`) → JSON só com componente + props.

**Frontend:** `inertia/app.tsx|vue`, `createInertiaApp`, packages
`@adonisjs/inertia/react|vue` que envolvem `Link`/`Form` com rotas type-safe e
tratamento de erros.

**Template raiz (Edge):** `resources/views/inertia_layout.edge` com `@inertia()` e
`@inertiaHead()`. `rootView` pode ser escolhido **por request** via callback.

**Pontos de extensão para a nossa lib (importantes):**
- `rootView` por request → permite layout específico para modal.
- `share()` é extensível → podemos injetar o **estado/envelope do modal**.
- `errors` já são populados automaticamente → formulários de modal consomem de graça.
- `inertia.optional()` / `defer()` → casam com conteúdo lazy do modal.
- `errorBag` → isola validação por instância de modal.

---

## 6. Conclusões e direção para a lib AdonisJS

1. **Reaproveitar o frontend do Inertia UI Modal** (`@inertiaui/modal-vue|react`) é
   uma rota muito atraente: é o melhor DX, é praticamente agnóstico de backend, e o
   Rails já provou que dá para integrá-lo a um backend não-Laravel (via base URL). A
   nossa lib forneceria o **lado servidor AdonisJS** equivalente ao
   `inertia_rails-contrib`.

2. **Alternativamente / complementarmente**, oferecer uma API backend-driven idiomática
   do AdonisJS, ex.:
   ```ts
   return inertia.modal('users/show', { user })
     .baseRoute('users.index')
   ```
   implementada como um wrapper sobre `inertia.render` + um header custom
   (ex.: `X-Inertia-Modal`) + escolha de `rootView` + injeção via `share()`.

3. **Pontos obrigatórios** que a lib precisa cobrir (lista derivada da seção 4):
   - Conceito de **base route/URL** para acesso direto.
   - Preservação do fundo em navegação via link.
   - Integração nativa com **validação/errors** (sem recarregar o modal).
   - **Partial reload** das props do modal sob namespace próprio.
   - Suporte a **slideover**, **stacked modals** e (ideal) **prefetch**.
   - **History/URL** corretos ao abrir/fechar.

4. **Tooling do pacote**: seguir o `pkg-starter-kit` (ver
   [`adonis-package-starter-kit.md`](./adonis-package-starter-kit.md)) — `configure.ts`,
   provider, stubs, exports map, Japa, build com `tsc`, peerDependencies para
   `@adonisjs/inertia`.

**Decisão tomada (2026-06-17):** construir uma **solução backend-driven 100% própria**
no estilo Momentum/emargareten — com API server-side e componentes frontend próprios,
sem depender do frontend do Inertia UI. Motivo: controle total e independência de
pacotes de terceiros. O design técnico está em
[`../design/backend-driven-architecture.md`](../design/backend-driven-architecture.md).

---

## 7. Referências

- Inertia UI Modal — introdução: https://inertiaui.com/inertia-modal/docs/introduction
- Inertia UI Modal — repo: https://github.com/inertiaui/modal
- Momentum Modal: https://github.com/lepikhinb/momentum-modal
- emargareten/inertia-modal: https://github.com/emargareten/inertia-modal
- Inertia Rails — cookbook modal: https://inertia-rails.dev/cookbook/inertia-modal
- Laravel Jetstream (Inertia stack): https://jetstream.laravel.com/stacks/inertia.html
- AdonisJS Inertia (docs): https://docs.adonisjs.com/guides/frontend/inertia
- AdonisJS Inertia (repo): https://github.com/adonisjs/inertia
- AdonisJS pkg-starter-kit: https://github.com/adonisjs/pkg-starter-kit
- Evil Martians — Inertia.js + Rails:
  https://evilmartians.com/chronicles/simplicity-vanished-solving-the-mystery-with-inertia-js-and-rails
