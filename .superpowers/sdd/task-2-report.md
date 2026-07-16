# Task 2 — Relatório

Status: concluída.

Commit: `feat: expoe detalhamento da performance`

## Alterações

- `calcularPerformancePromotor` continua usando `calcularBonificacaoPromotores` como fonte única.
- O retorno agora inclui `resumoBonus` e os detalhes auditáveis nos três cards.
- Os testes existentes foram ampliados para validar bônus, carteira/tabela e cobertura.

## Testes

- `node tests\\metas-performance.test.js` — PASS
- `node tests\\bonus.test.js` — PASS

## Preocupações

Nenhuma conhecida. O adapter apenas projeta os campos já calculados pelo resumo de bonificação; não foram duplicadas regras de negócio.
