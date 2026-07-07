# Metas E Performance Do Promotor Design

## Objetivo

Criar metas configuraveis pelo gestor e exibir ao promotor, na tela inicial, sua evolucao do mes com o que falta para bater cada indicador.

## Escopo

- Criar API `api/metas.js` com tabela `metas`.
- Criar modulo puro `performance.js` para calcular a performance.
- Adicionar aba `Metas` no gestor.
- Adicionar tela inicial `Painel` no promotor.
- Usar as metas cadastradas diretamente no painel do promotor.

## Metas Do Primeiro Incremento

- `pdvs_cadastrados`: meta de carteira.
- `pdvs_visitados_mes`: meta de cobertura mensal.
- `tabela_percentual`: percentual da base com tabela visivel.
- `pedidos_mes`: pedidos no mes.
- `cliente_novo_positivado`: clientes novos cadastrados no mes.

## Escopos

As metas podem ser cadastradas por:

- `global`
- `uf`
- `coordenador`
- `promotor`

Prioridade de resolucao:

1. Promotor.
2. Coordenador.
3. UF.
4. Global.
5. Padrao do codigo.

## Regras

- Apenas gestor pode editar metas.
- Promotor pode ler metas para ver seu painel.
- Coordenador e diretoria podem ler metas.
- Nenhum indicador deve alterar visitas, clientes ou historico.
- Nenhum arquivo novo deve ficar sem chamada no sistema.

## UI

Gestor:

- Nova aba `Metas`.
- Editor de tipo, escopo, valor do escopo e valor da meta.
- Lista de metas cadastradas.

Promotor:

- Nova tela inicial `Painel`.
- Cards de progresso com atual, alvo e faltante.
- Lista de proximos passos.

## Testes

- `tests/metas-performance.test.js` valida o calculo puro.
- `tests/metas-integracao.test.js` valida API, links de menu, funcoes chamadas e tela inicial.
