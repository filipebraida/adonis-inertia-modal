# Documentação — adonis-modal

Biblioteca de modais para o adapter oficial de Inertia.js do AdonisJS.

## Design

- [Plano de desenvolvimento](./design/development-plan.md) — fases core-first
  (React primeiro), o que entra em cada uma e a definição de "núcleo".
- [Plano detalhado por fase](./design/phases-detailed.md) — design, referências de
  código real (inertiaui/momentum/adapter) e estratégia de teste por fase.
- [Arquitetura backend-driven](./design/backend-driven-architecture.md) — design
  técnico da abordagem escolhida (API server-side, protocolo HTTP, frontend, riscos).
- [Spike: viabilidade do server dispatch](./design/spike-server-dispatch.md) —
  investigação do código-fonte; conclui que é **viável** e define a abordagem do
  re-dispatch da base route no AdonisJS.
- [Compatibilidade Inertia v2/v3](./design/inertia-v3-compat.md) — impacto da migração
  do adapter para Inertia v3 (v5.0.0-next.0); decisão de versão e o ponto do partial
  reload aninhado.

## Estudos

- [Referência de features (inertiaui)](./research/inertiaui-feature-reference.md) —
  spec destilada da doc oficial do inertiaui (API React, config, comportamentos) com
  o impacto de cada feature no nosso modelo backend-driven.
- [Soluções de Modal para Inertia.js](./research/inertia-modal-solutions.md) —
  levantamento das soluções existentes (Laravel, Rails) e as duas arquiteturas
  (frontend-driven vs backend-driven), com recomendações para a nossa lib.
- [AdonisJS Package Starter Kit](./research/adonis-package-starter-kit.md) —
  convenções para empacotar a lib no estilo oficial do AdonisJS.
