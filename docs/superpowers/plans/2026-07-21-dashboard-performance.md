# Dashboard Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o dashboard pesado por um resumo mensal agregado, filtrável e rápido, com cards essenciais, mapa e ranking.

**Architecture:** Uma nova função serverless agrega os dados no Postgres e devolve um contrato pequeno. O frontend mantém os filtros multisseleção, cache curto e cancelamento de respostas obsoletas, renderizando apenas cards, mapa e ranking.

**Tech Stack:** HTML/CSS/JavaScript standalone, Vercel Functions, Neon Postgres, testes Node com `assert`.

## Global Constraints

- O dashboard abre no mês atual e todos os filtros abrem em `Todos`.
- Meses selecionados são somados em um único resultado.
- Filtros: promotor, coordenador, UF, cidade e produto.
- A Visão geral mostra apenas visitas, pedidos, quatro SKUs, mapa e ranking.
- Novos ícones são SVG; não usar emojis.
- Preservar autenticação e escopo de gestor/coordenador.
- Meta: dashboard inicial em até 2 segundos e atualização em até 1 segundo em condições normais.
- Não adicionar framework ou dependência frontend.

---

## File Structure

- `api/dashboard-resumo.js`: valida filtros, aplica escopo e executa agregações.
- `index.html`: barra de filtros, estado/cache, carregamento e renderização do dashboard.
- `tests/dashboard-resumo-api.test.js`: contrato, segurança e forma da consulta agregada.
- `tests/dashboard-simplificado.test.js`: conteúdo, filtros, SVG, mapa e ranking.
- `tests/dashboard-performance.test.js`: impede retorno ao carregamento sequencial e ao payload completo.

### Task 1: Contrato da API agregada

**Files:**
- Create: `tests/dashboard-resumo-api.test.js`
- Create: `api/dashboard-resumo.js`

**Interfaces:**
- Consumes: `autenticar(req)` de `api/_auth.js` e `DATABASE_URL`.
- Produces: `GET /api/dashboard-resumo?meses=YYYY-MM,...&promotores=...&coordenadores=...&ufs=...&cidades=...&produtos=...` com `{ periodo, totais, estados, ranking, opcoes }`.

- [ ] **Step 1: Escrever o teste de contrato que falha**

```js
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('api/dashboard-resumo.js', 'utf8');

assert.ok(src.includes("import { autenticar } from './_auth.js'"));
assert.ok(src.includes("sessao.tipo === 'promotor'"));
assert.ok(src.includes("sessao.tipo === 'coordenador'"));
assert.ok(src.includes('coordenador_usuario'));
assert.ok(src.includes('jsonb_to_recordset'));
assert.ok(src.includes("pedidoPac"));
assert.ok(src.includes("pedidoQty"));
assert.ok(src.includes("statusPedido"));
assert.ok(src.includes("Pedido confirmado"));
assert.ok(src.includes("Pedido entregue"));
assert.ok(src.includes('totais'));
assert.ok(src.includes('estados'));
assert.ok(src.includes('ranking'));
assert.ok(src.includes('opcoes'));
assert.ok(!src.includes('SELECT * FROM visitas'));
console.log('dashboard-resumo-api.test.js passou');
```

- [ ] **Step 2: Executar e confirmar a falha**

Run: `node tests\dashboard-resumo-api.test.js`

Expected: FAIL com `ENOENT` para `api/dashboard-resumo.js`.

- [ ] **Step 3: Implementar validação, escopo e agregação mínima**

Criar helpers com estas assinaturas:

```js
function listaQuery(valor = '') {
  return [...new Set(String(valor).split(',').map(v => v.trim()).filter(Boolean))];
}

function intervaloMeses(meses) {
  const validos = meses.filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)).sort();
  if (!validos.length) throw new Error('Informe ao menos um mes valido');
  const inicio = `${validos[0]}-01T00:00:00.000Z`;
  const [ano, mes] = validos[validos.length - 1].split('-').map(Number);
  const fim = new Date(Date.UTC(ano, mes, 1)).toISOString();
  return { meses: validos, inicio, fim };
}
```

O handler deve normalizar as seis listas antes de consultar o banco:

```js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=30');
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Metodo nao permitido' });
  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  if (sessao.tipo === 'promotor') return res.status(403).json({ erro: 'Acesso restrito a gestao' });
  const periodo = intervaloMeses(listaQuery(req.query.meses));
  const filtros = {
    promotores: listaQuery(req.query.promotores),
    coordenadores: listaQuery(req.query.coordenadores),
    ufs: listaQuery(req.query.ufs).map(v => v.toUpperCase()),
    cidades: listaQuery(req.query.cidades),
    produtos: listaQuery(req.query.produtos).filter(v => ['GR','GM','CM','CC'].includes(v))
  };
  const sql = neon(process.env.DATABASE_URL);
  const resultado = await consultarResumoDashboard(sql, sessao, periodo, filtros);
  return res.status(200).json(resultado);
}
```

Implementar `consultarResumoDashboard(sql, sessao, periodo, filtros)` no mesmo arquivo. Primeiro consultar os nomes permitidos quando `sessao.tipo === 'coordenador'`; depois usar uma CTE `filtradas` para aplicar período, escopo e listas. Uma segunda CTE deve projetar UF, cidade, status resolvido e quantidades de `pedidoPac` com fallback para `pedidoQty`. Expandir os quatro campos de quantidade com `jsonb_to_recordset`, converter valores com `COALESCE(..., 0)` e contar pedido somente quando o status resolvido for confirmado ou entregue. Executar agregações de total, UF, promotor e opções com `Promise.all`; todas as listas entram como parâmetros do SQL tag.

- [ ] **Step 4: Executar o teste**

Run: `node tests\dashboard-resumo-api.test.js`

Expected: `dashboard-resumo-api.test.js passou`.

- [ ] **Step 5: Verificar sintaxe e commit**

Run: `node --check api\dashboard-resumo.js`

Expected: exit code 0.

```powershell
git add api/dashboard-resumo.js tests/dashboard-resumo-api.test.js
git commit -m "feat: add aggregated dashboard endpoint"
```

### Task 2: Filtros mensais multisseleção

**Files:**
- Create: `tests/dashboard-simplificado.test.js`
- Modify: `index.html:1340-1450`
- Modify: `index.html:1758-1785`
- Modify: `index.html:1980-1990`

**Interfaces:**
- Consumes: opções devolvidas por `/api/dashboard-resumo`.
- Produces: `dashboardFiltros`, `mesesDashboardSelecionados()`, `abrirFiltroDashboard(nome)`, `aplicarFiltrosDashboard()`.

- [ ] **Step 1: Escrever teste estrutural que falha**

```js
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

['meses','promotores','coordenadores','ufs','cidades','produtos'].forEach(nome => {
  assert.ok(html.includes(`data-dashboard-filter="${nome}"`), `filtro ${nome} ausente`);
});
assert.ok(html.includes('function mesesDashboardSelecionados'));
assert.ok(html.includes('function aplicarFiltrosDashboard'));
assert.ok(html.includes('Selecionar tudo'));
assert.ok(html.includes('Limpar'));
assert.ok(html.includes('dashboard-filter-search'));
assert.ok(html.includes('type="checkbox"'));
console.log('dashboard-simplificado.test.js passou');
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\dashboard-simplificado.test.js`

Expected: FAIL em `filtro meses ausente`.

- [ ] **Step 3: Implementar o componente sem dependências**

Adicionar estado:

```js
const dashboardFiltros = {
  meses: new Set(), promotores: new Set(), coordenadores: new Set(),
  ufs: new Set(), cidades: new Set(), produtos: new Set()
};

function mesesDashboardSelecionados() {
  return [...dashboardFiltros.meses].sort();
}

function aplicarFiltrosDashboard() {
  fecharFiltrosDashboard();
  return carregarDashboardResumo();
}
```

O dropdown deve ter busca local, checkboxes, `Selecionar tudo`, `Limpar` e resumo `Todos` quando o conjunto estiver vazio. Inicializar `meses` com `YYYY-MM` local do mês atual.

- [ ] **Step 4: Executar teste e commit**

Run: `node tests\dashboard-simplificado.test.js`

Expected: `dashboard-simplificado.test.js passou`.

```powershell
git add index.html tests/dashboard-simplificado.test.js
git commit -m "feat: add Excel-style dashboard filters"
```

### Task 3: Carregamento rápido, cache e corrida de respostas

**Files:**
- Create: `tests/dashboard-performance.test.js`
- Modify: `index.html:4443-4472`

**Interfaces:**
- Consumes: `dashboardFiltros` e `/api/dashboard-resumo`.
- Produces: `carregarDashboardResumo({ force = false } = {})` e `dashboardResumoAtual`.

- [ ] **Step 1: Escrever teste de regressão**

```js
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('/api/dashboard-resumo'));
assert.ok(html.includes('dashboardResumoCache'));
assert.ok(html.includes('dashboardRequestId'));
assert.ok(html.includes('AbortController'));
assert.ok(!/async function carregarDashboardResumo[\s\S]{0,1800}\/api\/clientes/.test(html));
assert.ok(!/async function carregarDashboardResumo[\s\S]{0,1800}\/api\/listar/.test(html));
console.log('dashboard-performance.test.js passou');
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\dashboard-performance.test.js`

Expected: FAIL em `/api/dashboard-resumo`.

- [ ] **Step 3: Implementar loader com cache de 30 segundos**

```js
const dashboardResumoCache = new Map();
let dashboardRequestId = 0;
let dashboardAbortController = null;
let dashboardResumoAtual = null;

async function carregarDashboardResumo({ force = false } = {}) {
  const params = parametrosDashboard();
  const chave = params.toString();
  const cached = dashboardResumoCache.get(chave);
  if (!force && cached && Date.now() - cached.em < 30000) {
    dashboardResumoAtual = cached.dados;
    renderDashboardResumo();
    return cached.dados;
  }
  const requestId = ++dashboardRequestId;
  dashboardAbortController?.abort();
  dashboardAbortController = new AbortController();
  marcarDashboardAtualizando(true);
  try {
    const res = await apiFetch(`${API}/api/dashboard-resumo?${params}`, {
      headers: headers(), signal: dashboardAbortController.signal
    });
    const dados = await res.json();
    if (!res.ok) throw new Error(dados.erro || 'Erro ao carregar dashboard');
    if (requestId !== dashboardRequestId) return null;
    dashboardResumoCache.set(chave, { em: Date.now(), dados });
    dashboardResumoAtual = dados;
    renderDashboardResumo();
    return dados;
  } finally {
    if (requestId === dashboardRequestId) marcarDashboardAtualizando(false);
  }
}
```

- [ ] **Step 4: Executar teste e commit**

Run: `node tests\dashboard-performance.test.js`

Expected: `dashboard-performance.test.js passou`.

```powershell
git add index.html tests/dashboard-performance.test.js
git commit -m "perf: load dashboard from cached summary"
```

### Task 4: Cards, mapa e ranking simplificados

**Files:**
- Modify: `index.html:1365-1450`
- Modify: `index.html:4889-4998`
- Modify: `index.html:5571-5950`
- Modify: `tests/dashboard-simplificado.test.js`
- Modify: `tests/dashboard-pacotes.test.js`

**Interfaces:**
- Consumes: `dashboardResumoAtual`.
- Produces: `renderDashboardResumo()`, `renderMapaBrasilResumo()`, `renderRankingDashboard()`.

- [ ] **Step 1: Ampliar o teste antes da implementação**

```js
['dashboardVisitas','dashboardPedidos','dashboardPacotesGR','dashboardPacotesGM','dashboardPacotesCM','dashboardPacotesCC','gMapaBrasil','gRanking'].forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `${id} ausente`);
});
assert.ok(html.includes('function renderMapaBrasilResumo'));
assert.ok(html.includes('function renderRankingDashboard'));
assert.ok(html.includes('data-icon="visitas"'));
assert.ok(html.includes('<svg'));
assert.ok(!html.includes('gResumoInteligente'));
assert.ok(!html.includes('gEvolucao'));
assert.ok(!html.includes('gReceptividade'));
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\dashboard-simplificado.test.js`

Expected: FAIL em `dashboardVisitas ausente`.

- [ ] **Step 3: Substituir os blocos antigos**

Usar seis cards com ícones SVG inline e valores vindos exclusivamente de `dashboardResumoAtual.totais`. O mapa lê `dashboardResumoAtual.estados`; a tabela de estados oferece `visitas`, `pedidos`, `pacotes` e `uf`. O ranking oferece `visitas`, `pedidos`, `pacotes`, `GR`, `GM`, `CM` e `CC`.

```js
function ordenarDashboard(lista, campo, direcao = 'desc') {
  const fator = direcao === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => {
    if (campo === 'uf' || campo === 'promotor') return fator * String(a[campo] || '').localeCompare(String(b[campo] || ''), 'pt-BR');
    return fator * (Number(a[campo] || 0) - Number(b[campo] || 0));
  });
}
```

- [ ] **Step 4: Atualizar expectativas antigas e executar testes**

Run: `node tests\dashboard-simplificado.test.js`

Run: `node tests\dashboard-pacotes.test.js`

Run: `node tests\mapa-timeline.test.js`

Expected: todos imprimem `passou`.

- [ ] **Step 5: Sincronizar web e commit**

Run: `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1`

```powershell
git add index.html app/www/index.html tests/dashboard-simplificado.test.js tests/dashboard-pacotes.test.js
git commit -m "feat: simplify monthly management dashboard"
```

### Task 5: Medição e regressão completa

**Files:**
- Create: `tests/dashboard-response-budget.test.js`
- Modify: `api/dashboard-resumo.js`

**Interfaces:**
- Consumes: resposta do endpoint.
- Produces: header `Server-Timing` e limite testável de contrato.

- [ ] **Step 1: Criar teste de orçamento de resposta**

```js
const assert = require('assert');
const fs = require('fs');
const api = fs.readFileSync('api/dashboard-resumo.js', 'utf8');
assert.ok(api.includes("res.setHeader('Server-Timing'"));
assert.ok(!api.includes('fotos'));
assert.ok(!api.includes('validacoes_fotos'));
console.log('dashboard-response-budget.test.js passou');
```

- [ ] **Step 2: Adicionar medição**

Medir com `performance.now()` ou `Date.now()` no início do handler e, antes da resposta:

```js
res.setHeader('Server-Timing', `dashboard;dur=${Date.now() - inicioMs}`);
return res.status(200).json(resultado);
```

- [ ] **Step 3: Executar conjunto relevante**

Run: `node tests\dashboard-response-budget.test.js`

Run: `node tests\dashboard-resumo-api.test.js`

Run: `node tests\dashboard-performance.test.js`

Run: `node tests\dashboard-simplificado.test.js`

Run: `node tests\filtros-periodo.test.js`

Run: `node tests\coordenadores-dashboard.test.js`

Expected: todos imprimem `passou`.

- [ ] **Step 4: Commit**

```powershell
git add api/dashboard-resumo.js tests/dashboard-response-budget.test.js
git commit -m "test: enforce dashboard response budget"
```
