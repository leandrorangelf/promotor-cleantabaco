# Bonificacao Por Performance Design

## Objetivo

Adicionar ao painel de Performance dos promotores um calculo estimado de bonificacao mensal, com tres metas independentes de R$ 500 e teto de R$ 1.500 por promotor.

## Escopo Aprovado

A bonificacao fica dentro da pagina existente `Performance dos promotores`; nao havera uma aba separada chamada Bonificacao. Cada promotor exibira o total estimado e o status das tres metas.

## Regras

- Cliente novo com venda de 4 SKUs: R$ 500 quando o promotor tiver pelo menos um PDV novo no periodo filtrado com venda de `GR`, `GM`, `CM` e `CC` em quantidade maior que zero.
- 10 pedidos no mes: R$ 500 quando o promotor tiver pelo menos 10 visitas com status `Pedido confirmado` ou `Pedido entregue` no periodo filtrado.
- 100 visitas por semana ativa: R$ 500 quando todas as semanas em que o promotor teve visitas no periodo tiverem pelo menos 100 visitas.
- Total maximo: R$ 1.500 por promotor.

## Dados E Inferencias

O calculo usa `visitasGestor`, que ja respeita os filtros de periodo, promotor, tipo, cidade e status carregados no gestor. Como o frontend nao recebe o historico completo quando ha filtro de data, "cliente novo" sera tratado como primeira ocorrencia do PDV dentro do periodo filtrado.

## UI

Na pagina Performance, os cards e a tabela passam a mostrar:

- Bonus estimado em reais.
- Meta Cliente 4 SKUs: batida ou pendente.
- Meta 10 pedidos: batida ou pendente.
- Meta 100 visitas/semana ativa: batida ou pendente.

## Testes

Criar um modulo puro `bonus.js` com o calculo de bonificacao e testes Node em `tests/bonus.test.js`.
