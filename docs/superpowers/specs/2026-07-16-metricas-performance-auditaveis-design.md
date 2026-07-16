# Métricas de performance auditáveis por promotor

Data: 2026-07-16

## Objetivo

Garantir que o painel do promotor e a visão de gestão apresentem as mesmas métricas mensais, com regras de contagem explícitas e detalhamento suficiente para explicar valores como `R$ 315,00`.

Nesta primeira versão, todos os promotores usam os mesmos parâmetros:

- R$ 15 por cliente novo positivado;
- teto de R$ 500 para esse bônus unitário;
- 200 clientes distintos cadastrados e visitados no mês;
- 50% da carteira com tabela confirmada por foto aprovada.

A estrutura atual de metas deve ser preservada para permitir exceções por estado ou promotor em uma etapa futura.

## Regras de negócio

### Cliente novo positivado

Conta uma vez cada cliente que:

1. esteja vinculado ao promotor;
2. tenha sido cadastrado no mês vigente;
3. tenha uma visita do mesmo promotor no mês vigente;
4. tenha pelo menos um item vendido nessa visita.

O valor é `quantidade de clientes × R$ 15`, limitado a R$ 500. A identificação deve priorizar CNPJ e usar nome fantasia como fallback, mantendo a normalização existente.

### Cobertura mensal

Conta clientes distintos cadastrados e visitados pelo promotor no mês vigente. Visitas repetidas ao mesmo cliente contam uma única vez. O alvo é 200.

### Tabela aprovada

Conta clientes distintos da carteira do promotor que possuem pelo menos uma validação de foto com status `aprovado`. Uma aprovação manual ou automática é suficiente. Status `reprovado` e `pendente` não contam.

Uma aprovação automática não pode ser ignorada apenas porque existe outra validação manual pendente; a regra deve verificar se existe qualquer validação aprovada para o cliente. O percentual é calculado sobre a carteira do promotor, com alvo de 50%, respeitando a regra de base mínima já adotada pelo sistema se ela for necessária para evitar distorções em carteiras pequenas.

## Fonte única de cálculo

O módulo de cálculo existente (`bonus.js`/`performance.js`) continua sendo a fonte de verdade. O painel do promotor e o gestor devem consumir o mesmo resumo, sem fórmulas duplicadas na camada visual.

Cada resumo deve expor, no mínimo:

- quantidade de clientes novos positivados;
- valor do bônus unitário e teto;
- quantidade de clientes distintos visitados no mês;
- total da carteira usada no percentual;
- quantidade e percentual de clientes com tabela aprovada;
- valor gerado por cada métrica;
- total estimado e valores faltantes para cada alvo.

## Interface

### Painel do promotor

Manter os cards atuais, mas tornar o primeiro explicável: exibir a contagem, o valor unitário, o valor atual e o teto. Os demais cards devem exibir atual/alvo, percentual quando aplicável, faltante e status.

Exemplo de detalhamento: `21 clientes × R$ 15 = R$ 315`.

### Gestão

Na visão de performance, cada promotor deve ter um resumo com total estimado e os três indicadores. A tabela de gestão deve usar os mesmos valores do painel individual e permitir identificar rapidamente:

- quantos clientes geraram o bônus de novos;
- quantos clientes distintos foram visitados no mês;
- quantos clientes têm tabela aprovada e qual percentual;
- quanto cada indicador contribuiu para o total.

## Dados e período

As métricas mensais devem usar o mês vigente no fuso já adotado pelo frontend. Clientes e visitas fora do período não entram nas métricas mensais, exceto aprovações de tabela que representam o estado aprovado da carteira, conforme regra acima.

## Tratamento de dados inválidos

- registros sem promotor não entram no resumo de um promotor identificado;
- registros sem CNPJ e sem nome não podem ser deduplicados e não contam como cliente;
- quantidades de venda não positivas não positivam o cliente;
- validações ausentes, pendentes ou reprovadas não confirmam tabela;
- valores numéricos inválidos devem cair nos padrões atuais, sem gerar `NaN` na interface.

## Testes

Adicionar ou ajustar testes para verificar:

- `21 × R$ 15` produz R$315 e mostra a contagem de origem;
- o bônus unitário respeita o teto de R$500;
- clientes novos são filtrados pelo mês de cadastro;
- visitas repetidas não duplicam cobertura;
- uma aprovação manual ou automática conta;
- aprovação automática conta mesmo com aprovação manual pendente;
- reprovada e pendente não contam;
- painel do promotor e gestão consomem o mesmo resumo;
- metas padrão continuam em 15, 500, 200 e 50.

## Fora de escopo

- edição de valores diferentes por promotor ou estado;
- criação de uma nova API de métricas;
- alteração no histórico de visitas, clientes ou validações;
- pagamento efetivo do bônus.
