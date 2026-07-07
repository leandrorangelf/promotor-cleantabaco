# Coordenadores Permissoes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add coordinator users and restrict coordinator visibility to their assigned promoters.

**Architecture:** Extend the existing `promotores` table with `coordenador_usuario`, include coordinator data in login/session payloads, and enforce coordinator scope in backend APIs. Update the existing single-file frontend to manage coordinator assignments in the Promotores admin area and to show coordinator dashboards using the same gestor screens with restricted data.

**Tech Stack:** Vercel serverless functions, Neon Postgres, plain HTML/CSS/JavaScript, Node `assert` tests.

## Global Constraints

- Promotor can see only their own visits, photos, clients, map and indicators.
- Coordenador can see only promoters whose `coordenador_usuario` equals the coordinator's `usuario`.
- Gestor and diretoria can see all data.
- Backend APIs must enforce permissions; hiding UI is not enough.
- Do not allow multiple coordinators per promoter in this increment.
- Do not implement cadastral history in this increment; keep it for a later plan.

---

### Task 1: Persist Coordinator Assignment

**Files:**
- Modify: `api/promotores.js`
- Modify: `api/login.js`
- Test: `tests/coordenadores-promotores.test.js`

**Interfaces:**
- Produces: `promotores.coordenador_usuario TEXT`.
- Produces: API user objects containing `coordenador_usuario`.
- Accepts: `tipo = 'coordenador'` and `coordenador_usuario` when creating/updating promoters.

- [ ] **Step 1: Write failing test**

Create `tests/coordenadores-promotores.test.js` that asserts:

```js
const assert = require('assert');
const fs = require('fs');

const promotores = fs.readFileSync('api/promotores.js', 'utf8');
const login = fs.readFileSync('api/login.js', 'utf8');

assert.ok(promotores.includes('coordenador_usuario'), 'promotores deve ter coordenador_usuario');
assert.ok(promotores.includes("coordenador"), 'promotores deve aceitar perfil coordenador');
assert.ok(promotores.includes('ALTER TABLE promotores ADD COLUMN IF NOT EXISTS coordenador_usuario TEXT'), 'deve migrar coluna coordenador_usuario');
assert.ok(promotores.includes('coordenador_usuario ='), 'PUT deve salvar coordenador_usuario');
assert.ok(login.includes('coordenador_usuario'), 'login deve retornar coordenador_usuario');
assert.ok(login.includes('criarToken({ usuario: contaLogada.usuario, nome: contaLogada.nome, tipo: contaLogada.tipo, coordenador_usuario: contaLogada.coordenador_usuario })'), 'token deve incluir coordenador_usuario');

console.log('coordenadores-promotores.test.js passou');
```

- [ ] **Step 2: Run test and verify failure**

Run: `node tests/coordenadores-promotores.test.js`

Expected: FAIL because coordinator assignment is not implemented.

- [ ] **Step 3: Implement migration and fields**

Update `api/promotores.js`:

- Add `coordenador_usuario TEXT` to `CREATE TABLE`.
- Add `ALTER TABLE promotores ADD COLUMN IF NOT EXISTS coordenador_usuario TEXT`.
- Include `coordenador_usuario` in SELECTs and RETURNING clauses.
- Accept `tipo = 'coordenador'`.
- Normalize `coordenador_usuario`; save it only when `tipo === 'promotor'`, otherwise save `''`.

Update `api/login.js`:

- Add `coordenador_usuario TEXT` to table creation and migration.
- Select `coordenador_usuario`.
- Return it in `usuario`.
- Include it in `criarToken`.

- [ ] **Step 4: Run test and verify pass**

Run: `node tests/coordenadores-promotores.test.js`

Expected: PASS.

### Task 2: Enforce Coordinator Scope In APIs

**Files:**
- Modify: `api/listar.js`
- Modify: `api/foto.js`
- Modify: `api/clientes.js`
- Test: `tests/coordenadores-permissoes-api.test.js`

**Interfaces:**
- Consumes: authenticated session with `tipo`, `usuario`, `nome`.
- Produces: API responses restricted to `promotores.coordenador_usuario = sessao.usuario` when session is coordinator.

- [ ] **Step 1: Write failing test**

Create `tests/coordenadores-permissoes-api.test.js` that checks each API has coordinator handling:

```js
const assert = require('assert');
const fs = require('fs');

const listar = fs.readFileSync('api/listar.js', 'utf8');
const foto = fs.readFileSync('api/foto.js', 'utf8');
const clientes = fs.readFileSync('api/clientes.js', 'utf8');

for (const [nome, src] of [['listar', listar], ['foto', foto], ['clientes', clientes]]) {
  assert.ok(src.includes("sessao.tipo === 'coordenador'"), `${nome} deve tratar coordenador`);
  assert.ok(src.includes('coordenador_usuario'), `${nome} deve consultar coordenador_usuario`);
}

assert.ok(listar.includes('promotores_permitidos'), 'listar deve restringir por lista de promotores permitidos');
assert.ok(foto.includes('Sem permissao para ver fotos desta visita'), 'foto deve negar foto fora da equipe');
assert.ok(clientes.includes('promotores_permitidos'), 'clientes deve restringir carteira por lista de promotores permitidos');

console.log('coordenadores-permissoes-api.test.js passou');
```

- [ ] **Step 2: Run test and verify failure**

Run: `node tests/coordenadores-permissoes-api.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement API restrictions**

In `api/listar.js`:

- For coordinator, query `promotores` for active promoters where `coordenador_usuario = sessao.usuario`.
- If a `promotor` query param is present and not in allowed list, return 403.
- If no promotor param, restrict visits with `promotor = ANY(allowedNames)`.

In `api/foto.js`:

- Load visit promotor.
- For coordinator, allow only if visit promotor is assigned to coordinator.

In `api/clientes.js`:

- For coordinator, restrict customers by allowed promoter names.
- If a `promotor` param is present and not allowed, return 403.

- [ ] **Step 4: Run test and verify pass**

Run: `node tests/coordenadores-permissoes-api.test.js`

Expected: PASS.

### Task 3: Update Promotores UI

**Files:**
- Modify: `index.html`
- Test: `tests/coordenadores-ui.test.js`

**Interfaces:**
- Consumes: `promotoresAdmin` list from `/api/promotores`.
- Produces: form field `admCoordenador` and table/list display of coordinator assignment.

- [ ] **Step 1: Write failing test**

Create `tests/coordenadores-ui.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('<option value="coordenador">Coordenador</option>'), 'perfil deve incluir coordenador');
assert.ok(html.includes('id="admCoordenador"'), 'form deve ter campo coordenador responsavel');
assert.ok(html.includes('renderCoordenadoresAdmin'), 'deve renderizar lista de coordenadores');
assert.ok(html.includes('coordenador_usuario'), 'ui deve enviar/mostrar coordenador_usuario');
assert.ok(html.includes('Coordenador:'), 'lista deve exibir coordenador do promotor');

console.log('coordenadores-ui.test.js passou');
```

- [ ] **Step 2: Run test and verify failure**

Run: `node tests/coordenadores-ui.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement UI**

Update Promotores form:

- Add `Coordenador` as profile option.
- Add select `admCoordenador`.
- Populate with active coordinator users.
- Include `coordenador_usuario` in POST/PUT bodies.
- When editing a promoter, set the selected coordinator.
- In the list, display `Coordenador: Nome` when available.

- [ ] **Step 4: Run test and verify pass**

Run: `node tests/coordenadores-ui.test.js`

Expected: PASS.

### Task 4: Coordinator Frontend Experience

**Files:**
- Modify: `index.html`
- Test: `tests/coordenadores-dashboard.test.js`

**Interfaces:**
- Consumes: logged-in `tipoAtual === 'coordenador'`.
- Produces: coordinator users entering `appGestor`, with admin-only Promotores hidden.

- [ ] **Step 1: Write failing test**

Create `tests/coordenadores-dashboard.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes("tipo === 'coordenador'"), 'login deve tratar coordenador como painel gestor limitado');
assert.ok(html.includes("tipoAtual === 'coordenador'"), 'frontend deve reconhecer tipo coordenador');
assert.ok(html.includes('popularFiltroPromotoresPermitidos'), 'deve limitar filtro de promotores para coordenador');
assert.ok(html.includes('only-gestor'), 'acoes administrativas continuam restritas');

console.log('coordenadores-dashboard.test.js passou');
```

- [ ] **Step 2: Run test and verify failure**

Run: `node tests/coordenadores-dashboard.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement dashboard handling**

- Route `coordenador` to `appGestor`.
- Hide `.only-gestor` for coordinator.
- Populate promoter filters with only promoters assigned to the coordinator, based on `/api/promotores` response or data returned by restricted visits.
- Keep all API calls relying on backend restrictions.

- [ ] **Step 4: Run test and verify pass**

Run: `node tests/coordenadores-dashboard.test.js`

Expected: PASS.

### Task 5: Full Verification And Deploy

**Files:**
- Verify only.

- [ ] **Step 1: Run all tests**

Run:

```bash
node tests/bonus.test.js
node tests/gps-captura.test.js
node tests/mapa-timeline.test.js
node tests/validacao-ia-api.test.js
node tests/validacao-ia-ui.test.js
node tests/revisita-fallback.test.js
node tests/permissoes-visitas.test.js
node tests/coordenadores-promotores.test.js
node tests/coordenadores-permissoes-api.test.js
node tests/coordenadores-ui.test.js
node tests/coordenadores-dashboard.test.js
```

Expected: all pass.

- [ ] **Step 2: Deploy and push**

Run:

```bash
git add .
git commit -m "feat: add coordinator access control"
vercel --prod
git push origin main
```

Expected: deployment ready and branch pushed.

## Self-Review

- Spec coverage: coordinator profile, one coordinator per promoter, backend restrictions, UI assignment, and coordinator dashboard are covered.
- Scope control: cadastral history is intentionally left for a later implementation plan.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: uses `coordenador_usuario` consistently across API, login, token and UI.
