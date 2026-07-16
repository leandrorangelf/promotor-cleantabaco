# Task 2 — Relatório

Status: concluída — correção da revisão aplicada.

Commit: `fix: centraliza alvos da performance`

## Alterações

- `calcularPerformancePromotor` continua usando `calcularBonificacaoPromotores` como fonte única.
- O retorno agora inclui `resumoBonus` e os detalhes auditáveis nos três cards.
- `bonus.js` agora expõe `alvoUnidades`, `baseCadastrada` e `baseCadastradaAtingida` no resumo.
- `performance.js` consome esses campos sem recalcular `pdvsParaTeto` ou a regra de base cadastrada.
- O teste de performance prova os novos campos derivados.

## Testes

- `node tests\\metas-performance.test.js` — PASS
- `node tests\\bonus.test.js` — PASS

## Preocupações

Nenhuma conhecida. A alteração é um adapter mínimo; a regra permanece centralizada no resumo de bonificação.
