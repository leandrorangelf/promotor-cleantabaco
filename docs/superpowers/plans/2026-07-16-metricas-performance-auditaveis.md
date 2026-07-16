# Métricas de Performance Auditáveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir e tornar auditável o cálculo mensal de bônus e performance, exibindo a origem dos valores no painel do promotor e na visão do gestor.

**Architecture:** `bonus.js` permanece responsável pela apuração das três métricas e passa a expor contagens, bases e valores por indicador. `performance.js` adapta esse resumo para os cards individuais. `index.html` apenas renderiza o resumo compartilhado em duas visões, sem repetir regras de negócio; a cópia em `app/www/index.html` deve ser sincronizada ao final.

**Tech Stack:** JavaScript vanilla, HTML/CSS inline e módulos CommonJS/UMD existentes, testes Node com `assert`.

## Global Constraints

- Todos os promotores usam os parâmetros padrão: R$15, teto R$500, alvo 200 e alvo 50%.
- Cliente novo positivado exige cadastro no mês vigente, visita no mês vigente e pelo menos um SKU com quantidade positiva.
- Cobertura conta clientes distintos cadastrados e visitados no mês vigente.
- Tabela conta somente clientes distintos com qualquer validação de foto `aprovado`, manual ou automática; `pendente` e `reprovado` não contam.
- Aprovação automática deve contar mesmo quando houver outra validação manual pendente.
- CNPJ é a chave preferencial; nome fantasia é fallback; registros sem ambas as chaves não contam.
- O cálculo deve continuar sendo compartilhado entre promotor e gestor.
- Não criar API nova, não alterar histórico e não implementar exceções por estado/promotor nesta entrega.

---

### Task 1: Cobrir a apuração correta no módulo de bônus

**Files:**
- Modify: `tests/metas-performance.test.js`
- Modify: `bonus.js`

**Interfaces:**
- Consumes: `calcularBonificacaoPromotores(visitas, clientes, periodo, metasPorPromotor)`.
- Produces: resumo com `metas.clienteNovoPositivado`, `metas.baseDuzentosPdvs` e `metas.tabelaVisivelBase`, incluindo `atual`, `alvo`, `valor` e dados auxiliares necessários para a UI (`valorUnitario`, `teto`, `carteira`, `comTabela`, `clientesNovos`).

- [ ] **Step 1: Write the failing tests**

Atualizar o helper de teste para aceitar `promotor = 'Ana'` e adicionar casos que expressem a regra sem depender de implementação:

```js
const bonusWil = calcularBonificacaoPromotores(
  [
    visita({ promotor: 'Wil', pdv: 'Wil 1', data: '2026-07-03T10:00:00Z', pedido: true }),
    visita({ promotor: 'Wil', pdv: 'Wil 2', data: '2026-07-03T10:00:00Z', pedido: true })
  ],
  [
    { promotor: 'Wil', nome_fantasia: 'Wil 1', criado_em: '2026-07-02T10:00:00Z' },
    { promotor: 'Wil', nome_fantasia: 'Wil 2', criado_em: '2026-07-02T10:00:00Z' }
  ],
  { de: '2026-07-01T00:00:00Z', ate: '2026-07-31T23:59:59Z' },
  { Wil: { bonus_pdv_venda_valor: 15, bonus_pdv_venda_teto: 500, base_clientes: 200, tabela_percentual: 50 } }
).Wil;
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.atual, 2);
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.valor, 30);
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.valorUnitario, 15);

const validacoes = [{ status_manual: 'pendente', status_ia: 'aprovado' }];
const aprovadoAutomaticamente = visita({ promotor: 'Ana', pdv: 'Tabela 1', data: '2026-07-03T10:00:00Z', tabela: false });
aprovadoAutomaticamente.dados.presenca.tabelaValidacoesFotos = validacoes;
const tabelaResumo = calcularBonificacaoPromotores(
  [aprovadoAutomaticamente],
  [{ promotor: 'Ana', nome_fantasia: 'Tabela 1', criado_em: '2026-06-01T10:00:00Z' }],
  { de: '2026-07-01T00:00:00Z', ate: '2026-07-31T23:59:59Z' }
).Ana;
assert.strictEqual(tabelaResumo.metas.tabelaVisivelBase.comTabela, 1);
```

Também adicionar cenários com a mesma visita repetida (cobertura continua 1), `status_ia: 'reprovado'`, `status_manual: 'pendente'` sem aprovação automática e cliente sem CNPJ/nome (não conta).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests\metas-performance.test.js`

Expected: FAIL porque o resumo atual não expõe os campos auxiliares e porque uma aprovação automática acompanhada de aprovação manual pendente não é reconhecida.

- [ ] **Step 3: Implement the minimal calculation changes**

Em `bonus.js`:

1. substituir `statusValidacaoFoto`/`tabelaConfirmadaNaVisita` por uma verificação que procure qualquer validação com `status_manual === 'aprovado'` ou `status_ia === 'aprovado'`;
2. manter a deduplicação por chave de cliente antes de contar novos positivados, cobertura e tabela;
3. enriquecer cada métrica com os dados usados na fórmula, sem mudar os nomes existentes:

```js
resumo.metas.clienteNovoPositivado.valorUnitario = valorClienteNovo;
resumo.metas.clienteNovoPositivado.teto = tetoClienteNovo;
resumo.metas.clienteNovoPositivado.clientesNovos = clientesNovosPositivados;
resumo.metas.tabelaVisivelBase.carteira = totalBase;
resumo.metas.tabelaVisivelBase.comTabela = comTabelaVisivel;
resumo.metas.baseDuzentosPdvs.visitados = cadastradosEVisitados;
```

O valor total continua sendo a soma dos três valores e o teto da métrica unitária continua em R$500.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests\metas-performance.test.js`

Expected: PASS, incluindo a origem `2 × R$15`, deduplicação e aprovação manual/automática.

- [ ] **Step 5: Commit**

```bash
git add tests\metas-performance.test.js bonus.js
git commit -m "fix: torna calculo de bonus auditavel"
```

### Task 2: Expor o resumo consistente para os cards individuais

**Files:**
- Modify: `tests/metas-performance.test.js`
- Modify: `performance.js`

**Interfaces:**
- Consumes: campos auxiliares produzidos por `calcularBonificacaoPromotores`.
- Produces: `calcularPerformancePromotor(...)` retornando `cards.bonus_pdv_venda`, `cards.tabela_percentual`, `cards.base_ou_cobertura` e `resumoBonus` com contagens e valores explicáveis.

- [ ] **Step 1: Write the failing test**

Adicionar asserções ao teste de performance:

```js
assert.strictEqual(perf.cards.bonus_pdv_venda.valorUnitario, 15);
assert.strictEqual(perf.cards.bonus_pdv_venda.clientesPositivados, 30);
assert.strictEqual(perf.cards.tabela_percentual.carteira, 180);
assert.strictEqual(perf.cards.tabela_percentual.comTabela, 50);
assert.strictEqual(perf.cards.base_ou_cobertura.clientesVisitados, 90);
assert.ok(perf.resumoBonus);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests\metas-performance.test.js`

Expected: FAIL porque `performance.js` hoje repassa apenas `atual`, `alvo` e valores monetários mínimos.

- [ ] **Step 3: Implement the minimal adapter changes**

Em `performance.js`, copiar os campos auxiliares do resumo de `bonus.js` para os cards sem recalcular regras na camada de performance:

```js
const resumoBonus = resultadoBonus[promotor] || {};
const bonusPdvVenda = resumoBonus.metas?.clienteNovoPositivado || {};
const tabelaVisivel = resumoBonus.metas?.tabelaVisivelBase || {};
const baseVisitada = resumoBonus.metas?.baseDuzentosPdvs || {};
```

Adicionar `valorUnitario`, `clientesPositivados`, `carteira`, `comTabela` e `clientesVisitados` aos cards e retornar `resumoBonus`. Manter a resolução de metas existente e os nomes dos três cards.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests\metas-performance.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests\metas-performance.test.js performance.js
git commit -m "feat: expoe detalhamento da performance"
```

### Task 3: Renderizar detalhamento no painel do promotor e na gestão

**Files:**
- Modify: `index.html`
- Modify: `tests/metas-integracao.test.js`
- Modify: `tests/painel-metas-visual.test.js`

**Interfaces:**
- Consumes: `calcularPerformancePromotor` e `calcularBonificacaoPromotores` já carregados no frontend.
- Produces: textos visíveis que explicam o total e os três indicadores com os mesmos valores em painel e gestão.

- [ ] **Step 1: Write the failing UI/integration tests**

Adicionar verificações estruturais:

```js
assert.ok(html.includes('clientesPositivados'), 'card deve renderizar quantidade que gerou bonus');
assert.ok(html.includes('valorUnitario'), 'card deve renderizar valor unitario');
assert.ok(html.includes('comTabela'), 'gestao deve renderizar quantidade de tabelas aprovadas');
assert.ok(html.includes('clientesVisitados'), 'gestao deve renderizar cobertura distinta');
assert.ok(html.includes('manual ou automática'), 'interface deve explicar regra de aprovacao');
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node tests\metas-integracao.test.js
node tests\painel-metas-visual.test.js
```

Expected: FAIL porque os templates atuais mostram apenas chips resumidos e usam textos fixos como `50% tabela` e `200 PDVs`.

- [ ] **Step 3: Implement the minimal rendering changes**

Em `index.html`:

1. atualizar o template do card de bônus para mostrar, por exemplo, `21 clientes × R$ 15 = R$ 315` e o teto;
2. atualizar o card de tabela para mostrar `comTabela/carteira`, percentual atual e alvo, deixando claro que são fotos aprovadas;
3. atualizar o card de cobertura para mostrar `clientesVisitados/alvo` e que são clientes distintos no mês;
4. substituir os textos fixos da tabela do gestor pelos dados do resumo calculado;
5. manter os estados visuais existentes (`kpi-status-pill`, barras e ícones) e escapar/formatar números com as funções de moeda já existentes.

Não criar cálculo novo nos templates: os valores devem vir dos objetos produzidos por `performance.js` ou do resumo de `bonus.js` usado pela gestão.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node tests\metas-integracao.test.js
node tests\painel-metas-visual.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests\metas-integracao.test.js tests\painel-metas-visual.test.js
git commit -m "feat: detalha metas no painel e na gestao"
```

### Task 4: Sincronizar a versão Android e validar o conjunto completo

**Files:**
- Modify: `app/www/index.html` via `app/sync-web.ps1` ou cópia equivalente já usada pelo projeto.
- Test: `tests/metas-performance.test.js`, `tests/metas-integracao.test.js`, `tests/painel-metas-visual.test.js`.

**Interfaces:**
- Consumes: versão web aprovada em `index.html`.
- Produces: `app/www/index.html` com os mesmos templates e regras visuais, sem divergência entre web e Android.

- [ ] **Step 1: Run the project sync command**

Executar o mecanismo existente em `app/sync-web.ps1` para atualizar `app/www/index.html` a partir dos arquivos web. Confirmar no diff que somente a cópia sincronizada foi alterada além dos arquivos da Task 3.

- [ ] **Step 2: Add a synchronization assertion if absent**

Se os testes atuais não verificarem a cópia Android, adicionar em `tests/metas-integracao.test.js` uma asserção de que `app/www/index.html` contém `clientesPositivados`, `comTabela` e `clientesVisitados`.

- [ ] **Step 3: Run focused tests**

Run:

```bash
node tests\metas-performance.test.js
node tests\metas-integracao.test.js
node tests\painel-metas-visual.test.js
```

Expected: os três comandos terminam com exit code 0 e suas mensagens `passou`.

- [ ] **Step 4: Run the full JavaScript test suite**

Run: `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`

Expected: todos os testes existentes terminam com exit code 0; qualquer falha não relacionada deve ser investigada antes da conclusão.

- [ ] **Step 5: Review the final diff and commit**

Run:

```bash
git diff --check
git status --short
git diff HEAD~4 --stat
```

Confirmar manualmente que:

- o valor de bônus mostra a fórmula de origem;
- tabela aprovada por IA ou manual conta;
- pendente/reprovada não conta;
- cobertura deduplica clientes;
- gestor e promotor usam os mesmos valores;
- alterações pré-existentes do usuário não foram incluídas.

```bash
git add app\www\index.html tests\metas-integracao.test.js
git commit -m "chore: sincroniza performance com app android"
```

## Self-review checklist

- Spec coverage: regras de bônus, cobertura, tabela aprovada, fonte única, UI, tratamento inválido e testes estão cobertos nas Tasks 1–4.
- Placeholder scan: não há `TBD`, `TODO` ou instruções sem arquivo/comando específico.
- Type consistency: os campos `valorUnitario`, `clientesPositivados`, `carteira`, `comTabela`, `clientesVisitados` são produzidos no cálculo, adaptados em `performance.js` e consumidos nos templates.
- Scope: não há mudança de API, banco, valores por estado ou pagamento efetivo.
