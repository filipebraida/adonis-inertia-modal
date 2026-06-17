# Design técnico — adonis-modal (backend-driven)

> Arquitetura escolhida (2026-06-17): solução **backend-driven 100% própria**, no
> estilo Momentum/emargareten, idiomática do AdonisJS. Sem dependência do frontend do
> Inertia UI.
> Base do estudo: [`../research/inertia-modal-solutions.md`](../research/inertia-modal-solutions.md)

## 1. Visão geral

O controller decide que uma resposta é um modal. A lib monta um "envelope" de modal
nas props do Inertia, escolhe o layout/rootView e o frontend (componentes próprios)
renderiza o modal por cima de uma **página de fundo** (base route).

```
Controller ──> inertia.modal('users/show', props).baseRoute('users.index')
                         │
                         ▼
      props normais do Inertia + envelope `modal`:
      {
        ...props,
        modal: { component, props, baseUrl, key, nonce, redirectUrl }
      }
                         │
        ┌────────────────┴───────────────────┐
   acesso via link                      acesso direto pela URL
   (header X-Inertia + X-Inertia-Modal) (request HTML normal)
        │                                     │
   só o envelope `modal` volta;         backend despacha a baseRoute
   fundo preservado no cliente          internamente → página de fundo +
                                        envelope `modal` por cima
```

## 2. API server-side (AdonisJS)

Estender `ctx.inertia` com um método `modal()` que retorna um builder encadeável.

```ts
// no controller
export default class UsersController {
  async show({ inertia, params }: HttpContext) {
    const user = await User.findOrFail(params.id)
    return inertia.modal('users/show', { user })
      .baseRoute('users.index')          // nome de rota OU
      // .baseUrl('/users')              // URL crua
  }
}
```

**Builder (`ModalResponse`):**
- `.baseRoute(name, params?)` — resolve via `router` do AdonisJS para a URL de fundo.
- `.baseUrl(url)` — define a URL de fundo diretamente.
- `.refreshBackdrop()` — força recarregar o fundo com dados frescos no acesso via link.
- Suporta os mesmos recursos de props do Inertia: `inertia.optional()`,
  `inertia.defer()`, `inertia.merge()` (props do modal vivem sob `modal.props.*`).

Internamente o builder chama `inertia.render(...)` com:
- o **componente da página de fundo** quando for acesso direto, OU
- um envelope mínimo quando for navegação via link.

## 3. Protocolo HTTP

Headers custom para o frontend e o backend se entenderem:

| Header | Direção | Significado |
|---|---|---|
| `X-Inertia-Modal` | request | o cliente está pedindo apenas o modal (navegação via link) |
| `X-Inertia-Modal-Base` | response | URL/rota de fundo associada ao modal |
| `X-Inertia-Modal-Key` | response | id único da instância do modal (history/stack) |

Reusa todo o protocolo do Inertia (`X-Inertia`, `X-Inertia-Version`, 409 +
`X-Inertia-Location`, partial reload via `X-Inertia-Partial-Data`).

## 4. Resolução da página de fundo (o ponto crítico)

- **Acesso direto pela URL** (sem `X-Inertia-Modal`): a lib precisa renderizar a
  página de fundo + o modal. Estratégia: o builder, ao detectar que não é navegação
  via link, **resolve internamente o handler da baseRoute** e o executa para obter as
  props do fundo, então envia ambos (fundo + `modal`) numa única resposta Inertia.
  - Implementação no AdonisJS: usar `router.findOrFail()` / despachar o controller da
    base route. Avaliar reexecutar o middleware vs. só o handler. (Ponto a validar no
    spike — ver seção 8.)
- **Acesso via link** (com `X-Inertia-Modal`): devolve só o envelope `modal`; o fundo
  já está montado no cliente e é preservado.

## 5. Estrutura da resposta (props)

```jsonc
{
  // props da página de fundo (somente no acesso direto)
  "user": { /* ... */ },
  // envelope do modal (sempre)
  "modal": {
    "component": "users/show",
    "props": { "user": { /* ... */ } },
    "baseUrl": "/users",
    "key": "modal-abc123",
    "redirectUrl": "/users",   // para onde voltar ao fechar
    "nonce": "..."             // evita reuso indevido de instância
  }
}
```

Props do modal sob `modal.props.*` → partial reload nativo:
`router.reload({ only: ['modal.props.stats'] })`.

## 6. Middleware / rootView

- Provider registra o método `modal()` em `ctx.inertia` (decorate/macro).
- `rootView` pode permanecer o mesmo; o modal é só uma prop. (Não precisamos
  necessariamente trocar o layout — diferente do Inertia UI que é frontend-driven.)
- `errors` de validação continuam vindo do `share()` do `InertiaMiddleware` → o
  formulário do modal consome de graça. Avaliar `errorBag` por `modal.key` para
  isolar validação em modais empilhados.

## 7. Frontend (componentes próprios)

Pacotes: `adonis-modal-vue`, `adonis-modal-react` (nomes provisórios).

- **Plugin/provider**: lê a prop `modal` do page object a cada visita; mantém uma
  **pilha** de modais (stack) e renderiza-os por cima do `<App>`.
  ```ts
  createInertiaApp({
    setup({ el, App, props, plugin }) {
      createApp({ render: () => h(App, props) })
        .use(plugin)
        .use(modal, { resolve: (name) => resolvePageComponent(/* ... */) })
        .mount(el)
    },
  })
  ```
- **`<ModalRoot />`**: colocado uma vez no layout; observa o stack e renderiza cada
  modal resolvendo o componente por `modal.component`.
- **`<ModalLink>`**: wrapper do `<Link>` que adiciona o header `X-Inertia-Modal` à
  visita (abre em modal em vez de page-load completo).
- **`useModal()`**: composable/hook com `show`, `close()`, `redirect()`,
  `reload()`, e acesso às props do modal e aos `errors`.
- **Slideover**: mesma mecânica, variação de apresentação (`variant: 'slideover'`).
- **Headless**: `<ModalRoot>` só fornece estado/transição; UI fica a cargo do usuário
  (ou oferecemos um `<Modal>` default com `<dialog>` nativo para acessibilidade).

## 8. Riscos / pontos a validar em spike

1. **Despachar a baseRoute no servidor** (acesso direto): qual a forma limpa de
   executar o handler/controller de outra rota dentro do AdonisJS e mesclar as props?
   (Provavelmente o maior risco técnico.)
2. **History do navegador** ao abrir/fechar/voltar com modais empilhados.
3. **Versão de assets do Inertia** (`X-Inertia-Version`) em respostas de modal.
4. **SSR**: comportamento do stack de modal no primeiro paint.
5. **Partial reload** do fundo vs. do modal sem colisão de namespaces.

## 9. Próximos passos sugeridos

1. Scaffolding do pacote com o `pkg-starter-kit` (estrutura, `configure.ts`, provider,
   exports, Japa). Ver [`../research/adonis-package-starter-kit.md`](../research/adonis-package-starter-kit.md).
2. Spike do item 8.1 (despachar baseRoute no servidor) — valida a viabilidade do
   acesso direto antes de tudo.
3. Implementar `ModalResponse` (builder) + provider que decora `ctx.inertia.modal`.
4. Implementar o plugin frontend + `<ModalRoot>` + `<ModalLink>` + `useModal()` (Vue
   primeiro, depois React).
5. App de exemplo (starter kit do Inertia AdonisJS) para validar o fluxo ponta a ponta.
