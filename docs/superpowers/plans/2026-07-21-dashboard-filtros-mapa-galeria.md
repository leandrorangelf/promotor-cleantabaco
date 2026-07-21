# Dashboard Filters, Visit Route and Gallery Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer cards e relatórios acompanharem todos os filtros, abrir Visitas no dia atual, desenhar a sequência diária de um promotor no mapa, restaurar fotos antigas na galeria e remover apenas a aba Diretoria.

**Architecture:** Manter os endpoints e componentes atuais, corrigindo a propagação dos filtros no endpoint agregado e os seletores usados pelo mapa. Preservar paginação/lazy loading da galeria, usando miniatura quando existente e fallback lazy para a imagem original legada.

**Tech Stack:** JavaScript, HTML/CSS, Vercel Functions, Neon PostgreSQL, Leaflet, testes Node com `assert`.

## Global Constraints

- Dashboard permanece mensal por padrão e soma múltiplos meses selecionados.
- GR, GM, CM e CC representam pacotes de pedidos confirmados ou entregues.
- A linha cronológica aparece somente para um promotor e nunca liga dias diferentes.
- O perfil `diretoria` permanece; somente a aba Diretoria será removida.
- `index.html` e `app/www/index.html` devem permanecer sincronizados por `app/sync-web.ps1`.

---

### Task 1: Corrigir filtros e atualização dos cards

**Files:**
- Modify: `api/dashboard-resumo.js`
- Modify: `index.html`
- Modify: `app/www/index.html`
- Modify: `tests/dashboard-resumo-api.test.js`
- Modify: `tests/dashboard-simplificado.test.js`

**Interfaces:**
- Consumes: query strings `meses`, `promotores`, `coordenadores`, `ufs`, `cidades`, `produtos`.
- Produces: `carregarDashboardResumo({ force: true })` e resposta agregada filtrada.

- [ ] **Step 1: Escrever testes que falham**

Adicionar asserções que exijam associação de `visitas.promotor` com `promotores.nome`, filtro por `coordenador_usuario`, atualização forçada e títulos explícitos:

```js
assert.ok(src.includes('coordenador_usuario = ANY'));
assert.ok(html.includes('carregarDashboardResumo({ force: true })'));
assert.ok(html.includes('Pacotes — Gudang Red'));
```

- [ ] **Step 2: Executar os testes e confirmar falha**

Run: `node tests\dashboard-resumo-api.test.js; node tests\dashboard-simplificado.test.js`

Expected: FAIL nas novas asserções.

- [ ] **Step 3: Aplicar o filtro de coordenador no SQL**

Nas CTEs do endpoint, incluir o coordenador junto à visita e compor o filtro:

```sql
FROM visitas v
LEFT JOIN promotores p ON p.nome = v.promotor
WHERE (...)
  AND (${filtros.coordenadores.length} = 0 OR p.coordenador_usuario = ANY(${filtros.coordenadores}))
```

Repetir a condição nas agregações de totais, estados e ranking.

- [ ] **Step 4: Forçar nova consulta e esclarecer rótulos**

```js
function aplicarFiltrosDashboard() {
  fecharFiltrosDashboard();
  return carregarDashboardResumo({ force: true });
}
```

Alterar os quatro títulos para `Pacotes — <produto>`.

- [ ] **Step 5: Sincronizar, testar e commit**

Run: `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1; node tests\dashboard-resumo-api.test.js; node tests\dashboard-simplificado.test.js`

Expected: PASS.

Commit: `fix: apply every dashboard filter to summary cards`

---

### Task 2: Abrir a aba Visitas na data atual

**Files:**
- Modify: `index.html`
- Modify: `app/www/index.html`
- Modify: `tests/filtros-periodo.test.js`

**Interfaces:**
- Consumes: `dataLocal(new Date())`.
- Produces: `definirPeriodoVisitasGestorHoje()` preenchendo `gFiltroDe` e `gFiltroAte`.

- [ ] **Step 1: Escrever teste que falha**

```js
assert.ok(html.includes('function definirPeriodoVisitasGestorHoje()'));
assert.ok(html.includes("document.getElementById('gFiltroDe').value = hoje"));
assert.ok(html.includes("document.getElementById('gFiltroAte').value = hoje"));
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\filtros-periodo.test.js`

Expected: FAIL porque o gestor ainda usa início do mês.

- [ ] **Step 3: Implementar inicialização diária**

```js
function definirPeriodoVisitasGestorHoje() {
  const hoje = dataLocal(new Date());
  document.getElementById('gFiltroDe').value = hoje;
  document.getElementById('gFiltroAte').value = hoje;
}
```

Chamar uma vez na entrada do painel, sem reaplicar ao trocar de abas para não sobrescrever escolha manual.

- [ ] **Step 4: Sincronizar, testar e commit**

Run: `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1; node tests\filtros-periodo.test.js`

Expected: PASS.

Commit: `fix: default management visits to current day`

---

### Task 3: Desenhar sequência diária das visitas no mapa

**Files:**
- Modify: `index.html`
- Modify: `app/www/index.html`
- Modify: `tests/mapa-timeline.test.js`

**Interfaces:**
- Consumes: `mapaFiltroPromotor`, `visitasMapa`, `dados.localizacao`, `criado_em`.
- Produces: `agruparPontosMapaPorDia(pontos)` e polylines Leaflet por dia.

- [ ] **Step 1: Escrever testes que falham**

```js
assert.ok(html.includes("document.getElementById('mapaFiltroPromotor').value"));
assert.ok(html.includes('function agruparPontosMapaPorDia'));
assert.ok(html.includes("toLocaleDateString('sv-SE')"));
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\mapa-timeline.test.js`

Expected: FAIL no seletor e agrupamento diário.

- [ ] **Step 3: Implementar agrupamento e linhas**

```js
function agruparPontosMapaPorDia(pontos) {
  return pontos.reduce((grupos, visita) => {
    const dia = new Date(visita.criado_em).toLocaleDateString('sv-SE');
    (grupos[dia] ||= []).push(visita);
    return grupos;
  }, {});
}
```

Em `renderMapa`, usar `mapaFiltroPromotor`; quando preenchido, criar uma `L.polyline` para cada grupo com dois ou mais pontos. Manter a numeração global cronológica dos marcadores.

- [ ] **Step 4: Sincronizar, testar e commit**

Run: `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1; node tests\mapa-timeline.test.js; node tests\jornada-mapa.test.js`

Expected: PASS.

Commit: `feat: connect daily promoter visits on map`

---

### Task 4: Restaurar fotos antigas e remover a aba Diretoria

**Files:**
- Modify: `api/foto.js`
- Modify: `index.html`
- Modify: `app/www/index.html`
- Modify: `tests/galeria-paginacao.test.js`
- Modify: `tests/coordenadores-dashboard.test.js`

**Interfaces:**
- Consumes: `GET /api/foto?id=<id>&index=<n>&variant=thumb`.
- Produces: miniatura persistida ou imagem original legada no carregamento lazy; perfil diretoria encaminhado ao dashboard.

- [ ] **Step 1: Escrever testes que falham**

```js
assert.ok(foto.includes('fotoOriginal?.miniatura || fotoOriginal?.imagem'));
assert.ok(!html.includes('data-gestor-page="diretoria"'));
assert.ok(!html.includes('id="gDiretoria"'));
assert.ok(html.includes("if (tipo === 'diretoria') mudarAbaG('dashboard')"));
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\galeria-paginacao.test.js; node tests\coordenadores-dashboard.test.js`

Expected: FAIL no fallback legado e na aba ainda presente.

- [ ] **Step 3: Corrigir fallback de foto antiga**

```js
const imagemThumb = fotoOriginal?.miniatura || fotoOriginal?.imagem || (typeof fotoOriginal === 'string' ? fotoOriginal : '');
const foto = variante === 'thumb' ? { ...fotoOriginal, imagem: imagemThumb } : fotoOriginal;
```

Responder indisponível somente quando nenhuma imagem existir.

- [ ] **Step 4: Remover a tela Diretoria e redirecionar o perfil**

Remover os dois botões `data-gestor-page="diretoria"`, o bloco `gDiretoria` e chamadas de `renderDiretoria()` no carregamento comum. Para login `diretoria`, ativar `gDashboard` e carregar `carregarDashboardResumo()`.

- [ ] **Step 5: Sincronizar e executar suíte completa**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File app\sync-web.ps1
$testes = Get-ChildItem tests -File | Where-Object { $_.Name -match '\.test\.(js|mjs)$' }
foreach ($teste in $testes) { node $teste.FullName; if ($LASTEXITCODE -ne 0) { exit 1 } }
```

Expected: todos os testes passam.

- [ ] **Step 6: Commit**

Commit: `fix: restore legacy gallery photos and simplify navigation`

---

### Task 5: Verificação integrada e entrega

**Files:**
- Verify: `index.html`
- Verify: `app/www/index.html`
- Verify: `api/dashboard-resumo.js`
- Verify: `api/foto.js`

**Interfaces:**
- Consumes: todos os resultados das Tasks 1–4.
- Produces: branch pronta para revisão, merge e deploy.

- [ ] **Step 1: Confirmar sincronização web/app**

Run: `Get-FileHash index.html; Get-FileHash app\www\index.html`

Expected: hashes idênticos.

- [ ] **Step 2: Executar suíte completa novamente**

Run: o loop PowerShell da Task 4.

Expected: zero falhas.

- [ ] **Step 3: Revisar diff e estado do Git**

Run: `git diff --check; git status --short; git log --oneline -6`

Expected: sem erros de whitespace e apenas mudanças planejadas.

- [ ] **Step 4: Solicitar revisão de código**

Revisar propagação dos filtros, timezone local, separação diária das linhas, fallback legado de fotos e ausência de regressão nas permissões do perfil Diretoria.
