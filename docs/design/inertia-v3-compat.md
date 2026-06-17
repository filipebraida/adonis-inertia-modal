# Compatibilidade: Inertia v2 vs v3 (@adonisjs/inertia)

> Contexto: `@adonisjs/inertia` v5.0.0-next.0 migra para Inertia v3
> (https://github.com/adonisjs/inertia/releases/tag/v5.0.0-next.0). É um **prerelease**.
> O estável atual ainda é Inertia v2. O usuário usa **Inertia v2** hoje.
> Data: 2026-06-17

## Decisão de versão

- **Alvo v1 da lib:** `@adonisjs/inertia` **estável (Inertia v2)** — é o que o usuário
  usa e o que está em produção.
- **Design forward-compatible com v3:** não usar nada que quebre no v3; isolar as
  diferenças (eventos, SSR) atrás de pontos de extensão.
- `peerDependencies`: declarar faixa que cubra o estável; reavaliar para incluir v5
  quando sair estável.

> Conclusão do usuário: a migração para v3 **não é impeditiva**. Confirmado.

## O que muda no v5-next (Inertia v3) e como nos afeta

| Mudança no adapter v3 | Impacto na lib | Ação |
|---|---|---|
| Page data via `<script type="application/json">` (não `data-page`) | nenhum (detalhe de render do shell) | — |
| Eventos client renomeados (`inertia:invalid`→`httpException`, `inertia:exception`→`networkError`) | **frontend plugin** | abstrair nomes de evento por versão |
| `router.cancel()` → `router.cancelAll()` | frontend plugin | idem |
| Layouts React não podem ser arrow fn | docs/stubs de exemplo | nota nos stubs |
| Plugin Vite removido; SSR via `serverEntrypoints` (`@adonisjs/vite` v6) | **configure.ts/stubs** de SSR | gerar setup conforme versão |
| `flags clearHistory/encryptHistory` omitidos salvo `true` | nenhum (já é assim no PageObject) | — |
| Props de página podem retornar `null` | leve positivo | — |
| Fix: deferred mergeable não roda `compute()` em visita normal | usar defer/merge com segurança | — |

## ⚠️ O ponto que define arquitetura: partial reload aninhado

**Inertia v3 traz "nested/dot-notation prop resolution", mas o adapter AdonisJS ainda
NÃO implementou** (listado como "not yet implemented" no v5-next). E no estável (v2)
nunca existiu.

Verificado em `@adonisjs/inertia` `src/inertia.ts#buildPageProps`:
```ts
const cherryPickProps = Object.keys(finalProps).filter((propName) => {
  if (only) return only.includes(propName) && !except.includes(propName)
  return !except.includes(propName)
})
```
→ cherry-pick **só de chaves de topo**. Logo
`router.reload({ only: ['modal.props.stats'] })` **não casa nada** nativamente.

**Consequência para a lib:** precisamos implementar a resolução de `modal.props.*`
**nós mesmos** no `ModalBuilder` (portar `unpackDotProps` + `isSparseModalReload` do
emargareten — ver [`spike-server-dispatch.md`](./spike-server-dispatch.md) §1 e §3).
Não dá para depender do partial reload nativo do adapter para caminhos aninhados.

Quando o adapter implementar dot-notation nativo (v3), podemos simplificar essa parte
— mas a nossa implementação própria continua funcionando como fallback compatível.

## Features v3 ainda ausentes no adapter (irrelevantes para o core do modal v1)
- Rescued deferred props
- Fragment-preserving redirects
- Shared-props tracking / once props
- Keyed/directional e infinite-scroll merges
- Múltiplos erros por campo e flash de primeira classe

Nenhuma bloqueia o modal v1; revisitar se forem úteis depois (ex.: infinite-scroll
dentro de modal).
