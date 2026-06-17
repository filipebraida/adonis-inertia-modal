# Documentação — adonis-modal

Biblioteca de modais para o adapter oficial de Inertia.js do AdonisJS.

## Design

- [Arquitetura backend-driven](./design/backend-driven-architecture.md) — design
  técnico da abordagem escolhida (API server-side, protocolo HTTP, frontend, riscos).
- [Spike: viabilidade do server dispatch](./design/spike-server-dispatch.md) —
  investigação do código-fonte; conclui que é **viável** e define a abordagem do
  re-dispatch da base route no AdonisJS.
- [Compatibilidade Inertia v2/v3](./design/inertia-v3-compat.md) — impacto da migração
  do adapter para Inertia v3 (v5.0.0-next.0); decisão de versão e o ponto do partial
  reload aninhado.

## Estudos

- [Soluções de Modal para Inertia.js](./research/inertia-modal-solutions.md) —
  levantamento das soluções existentes (Laravel, Rails) e as duas arquiteturas
  (frontend-driven vs backend-driven), com recomendações para a nossa lib.
- [AdonisJS Package Starter Kit](./research/adonis-package-starter-kit.md) —
  convenções para empacotar a lib no estilo oficial do AdonisJS.
