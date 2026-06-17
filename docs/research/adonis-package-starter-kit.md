# Estudo: AdonisJS Package Starter Kit

> Convenções para criar um pacote no estilo oficial do AdonisJS, base estrutural da
> nossa lib de modal.
> Repo: https://github.com/adonisjs/pkg-starter-kit
> Data: 2026-06-17

## Estrutura de pastas

- **`src/`** — código-fonte principal do pacote
- **`providers/`** — service providers para integração com o AdonisJS
- **`bin/`** — entrypoint para rodar os testes Japa
- **`stubs/`** — templates para geração de código (scaffolding)
- **`configure.ts`** — hook de configuração, executado via `node ace configure`
- **`index.ts`** — export principal do pacote

## Build & desenvolvimento

- **Compilação:** TypeScript → JavaScript via `tsc` para publicação no npm.
- **Testes:** Japa test runner.
  - `npm run test` — lint + testes + cobertura (c8)
  - `npm run quick:test` — só testes
- **Runtime de dev:** TS-Node + SWC executam TS sem compilar.
- **Lint/format:** ESLint + Prettier herdados da config compartilhada do AdonisJS.

## package.json (exports & distribuição)

- Subpath exports:
  - `"."` → entry principal (`build/index.js`)
  - `"./types"` → definições de tipo
- O array `files` seleciona só os artefatos compilados para publicação (exclui o TS
  fonte).

## Convenções-chave

- **Naming:** arquivos em `snake_case` (regra de ESLint).
- **Peer dependencies:** pacotes que já existem na app do usuário (ex.:
  `@adonisjs/inertia`, `@adonisjs/core`) entram em `peerDependencies` — garante
  instância única do framework compartilhada.
- **tsconfig:** estende `@adonisjs/tsconfig`, ES modules (`NodeNext`).
- **CI:** GitHub Actions roda em Node 20.x/21.x, Linux + Windows.

## Como um pacote AdonisJS registra serviços

- **`configure.ts`** — roda no `node ace configure`: publica stubs, registra o
  provider no `adonisrc`, cria arquivos de config, adiciona middleware, etc.
- **Provider** (em `providers/`) — `register()`/`boot()` para fazer bindings no
  container (ex.: adicionar métodos em `ctx.inertia`, registrar middleware, estender o
  response).
- **Stubs** — templates copiados para a app do usuário durante o configure
  (ex.: componente `<Modal>`, config, exemplo de página).

## Aplicação para a lib de modal

- `peerDependencies`: `@adonisjs/core`, `@adonisjs/inertia`, `edge.js`.
- `configure.ts`: publicar o componente `<Modal>`/`<ModalLink>` no frontend do
  usuário, registrar provider e (se necessário) middleware/rootView.
- Provider: estender `ctx.inertia` com `.modal(...)` / `.baseRoute(...)` (caso
  optemos pela abordagem backend-driven da seção 6 do estudo principal).
- Stubs: páginas/exemplos + setup do plugin no `inertia/app.ts(x)`.

Ver o estudo principal: [`inertia-modal-solutions.md`](./inertia-modal-solutions.md)
