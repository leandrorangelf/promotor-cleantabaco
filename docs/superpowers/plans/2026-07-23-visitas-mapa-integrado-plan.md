# Mapa Integrado à Aba Visitas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar mapa, sequência de visitas por promotor e detalhe interativo em uma única aba Visitas, sem duplicar dados, marcadores, listeners ou chamadas.

**Architecture:** A página existente em `app/www/index.html` continuará sendo a superfície principal. Uma coleção normalizada derivada de `visitasGestor` alimentará simultaneamente a lista e os marcadores; a interação reutilizará `abrirDetalheVisita`/`renderModal` existentes. A antiga tela textual de Mapas será removida somente depois de confirmar referências e testes, mantendo `mudarAbaG` compatível com links antigos durante a transição.

**Tech Stack:** HTML/CSS/JavaScript vanilla existente, mapa Leaflet já usado pelo app, testes Node.js em `tests/`.

## Global Constraints

- Não criar um segundo modal de visita; reutilizar o modal atual com fotos, edição, ações e fechamento.
- `visitasGestor` é a única fonte de dados; nenhum clique deve disparar nova API.
- Não instanciar mais de um mapa para o mesmo container e limpar marcadores/listeners antes de cada render.
- Visitas sem coordenadas continuam na lista e no modal, sinalizadas como “sem localização”.
- Preservar filtros, período, edição, exclusão, dashboard e APIs existentes.
- Desktop deve usar mapa + lista lado a lado; mobile deve empilhar mapa acima da lista sem overflow horizontal.

---

### Task 1: Mapear o fluxo atual e criar contratos de normalização

**Files:**
- Modify: `app/www/index.html` (funções de dados do gestor, renderização de visitas e mapa)
- Create: `tests/mapa-visitas-integrado.test.js`

**Interfaces:**
- Produces `normalizarVisitasMapa(visitas)` returning `Array<{id, visita, promotor, ordem, data, pdv, latitude, longitude, localizavel}>`.
- Produces `ordenarVisitasPorPromotor(itens)` returning a stable array sorted by promotor, explicit numeric `ordem` when present, then timestamp and id.

- [ ] **Step 1: Write failing tests** covering explicit sequence, chronological fallback, stable tie-breaker, missing promoter, and missing coordinates.

```js
const { normalizarVisitasMapa, ordenarVisitasPorPromotor } = require('../app/www/mapa-visitas.js');

test('ordena por promotor e ordem crescente com fallback cronológico', () => {
  const itens = ordenarVisitasPorPromotor(normalizarVisitasMapa([
    { id: 'b', promotor: 'Bia', criado_em: '2026-07-23T10:00:00Z', ordem: 2 },
    { id: 'a', promotor: 'Bia', criado_em: '2026-07-23T09:00:00Z', ordem: 1 },
    { id: 'c', promotor: 'Bia', criado_em: '2026-07-23T08:00:00Z' },
  ]));
  expect(itens.map(item => item.id)).toEqual(['a', 'b', 'c']);
});

test('mantém visita sem coordenadas como item não localizável', () => {
  const [item] = normalizarVisitasMapa([{ id: 'x', dados: { pdv: {} } }]);
  expect(item.localizavel).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/mapa-visitas-integrado.test.js`
Expected: FAIL because the normalization module/functions do not exist.

- [ ] **Step 3: Extract the pure helper module**

Create `app/www/mapa-visitas.js` with no DOM or Leaflet dependency. Read coordinates from the existing location fields, normalize numeric strings, derive `localizavel`, and use `id` as the final deterministic tie-breaker. Export helpers for Node tests and expose them to the page through the existing script loading convention.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `node --test tests/mapa-visitas-integrado.test.js`
Expected: PASS for all normalization and ordering cases.

- [ ] **Step 5: Commit the isolated data contract**

```bash
git add app/www/mapa-visitas.js tests/mapa-visitas-integrado.test.js app/www/index.html
git commit -m "feat: normalize visits for integrated map"
```

### Task 2: Integrar o layout mapa + sequência na aba Visitas

**Files:**
- Modify: `app/www/index.html` (markup da aba Visitas, estilos `.visitas-mapa-layout`, render da lista)
- Modify: `tests/mapa-layout.test.js`

**Interfaces:**
- Produces containers `#visitasMapaIntegrado`, `#visitasMapaCanvas`, `#visitasSequencia`, `#visitasMapaStatus`.
- Produces `renderSequenciaVisitas(itens)` that groups by promoter and renders keyboard-accessible controls with `data-visita-id`.

- [ ] **Step 1: Add failing DOM-contract assertions** for the integrated containers, group headings, ascending sequence labels, and no duplicate Mapas text block.
- [ ] **Step 2: Run `node tests/mapa-layout.test.js` and confirm failure** on the missing containers.
- [ ] **Step 3: Add the two-column markup and responsive CSS** inside the existing Visitas page. Set the map to a reduced height, use CSS grid for desktop, stack at the existing mobile breakpoint, and make only the sequence panel scroll when its content exceeds the viewport.
- [ ] **Step 4: Render grouped sequence from the normalized collection**. Each button must include promoter, ordinal position, PDV name, city, status, and a “sem localização” label when needed. Use event delegation on `#visitasSequencia`; do not attach one listener per rerendered row.
- [ ] **Step 5: Remove the obsolete textual Mapas section only after `rg` confirms no dashboard/test dependency**. Preserve the navigation entry as a compatibility redirect to `mudarAbaG('visitas')` until all callers are migrated, then remove dead markup and functions.
- [ ] **Step 6: Run focused layout tests and commit**

```bash
node tests/mapa-layout.test.js
git add app/www/index.html tests/mapa-layout.test.js
git commit -m "feat: add integrated visits map layout"
```

### Task 3: Sincronizar lista, marcadores e modal sem acúmulo

**Files:**
- Modify: `app/www/index.html` (lifecycle do mapa, handlers e seleção)
- Modify: `tests/mapa-visitas-integrado.test.js`

**Interfaces:**
- Produces `renderMapaVisitas(itens)`, `limparMarcadoresVisitas()`, `selecionarVisitaNoMapa(id)` and `selecionarVisitaNaLista(id)`.
- Consumes the existing `abrirDetalheVisita`/`renderModal` path, passing the original visit object.

- [ ] **Step 1: Add failing interaction tests** for list→marker→modal, marker→list→modal, repeated filter renders, and one missing-coordinate row.
- [ ] **Step 2: Run the focused interaction tests and confirm failure** because selection/lifecycle functions are absent.
- [ ] **Step 3: Implement idempotent map lifecycle**. Reuse the existing Leaflet instance if present, remove the previous marker layer/group before adding the new collection, and keep a single delegated list listener. Store marker references by stable visit id in a `Map`.
- [ ] **Step 4: Implement selection behavior**. A list activation updates selected CSS/ARIA state, centers the marker when localizable, and invokes the existing full detail modal. A marker click performs the inverse selection and modal invocation. Missing-coordinate rows open the modal without attempting map movement.
- [ ] **Step 5: Wire render to existing filter/period updates** so one normalized collection drives both views. Do not add API calls, timers, or polling.
- [ ] **Step 6: Run focused tests and commit**

```bash
node --test tests/mapa-visitas-integrado.test.js
git add app/www/index.html tests/mapa-visitas-integrado.test.js
git commit -m "feat: sync visit sequence markers and details"
```

### Task 4: Estados, limpeza e acessibilidade

**Files:**
- Modify: `app/www/index.html`
- Modify: `tests/mapa-layout.test.js`

- [ ] **Step 1: Add failing tests to `tests/mapa-layout.test.js`** for empty period, map error/tiles unavailable, partial coordinates, Escape/overlay modal close, and mobile layout class.
- [ ] **Step 2: Implement explicit states**: no visits, visits without location, mixed location coverage, and Leaflet initialization failure. Keep the sequence and modal usable in every non-crash state.
- [ ] **Step 3: Make controls accessible** with real buttons/links, visible focus, `aria-current`/`aria-selected` for the selected item, descriptive labels, and keyboard activation.
- [ ] **Step 4: Verify cleanup after repeated renders** by asserting one map instance, one marker group, no duplicate sequence rows, and no detached listener references.
- [ ] **Step 5: Run the focused suite and commit**

```bash
node tests/mapa-layout.test.js
git add app/www/index.html tests/mapa-layout.test.js
git commit -m "fix: harden integrated visits map states"
```

### Task 5: Validação renderizada e regressão

**Files:**
- Modify only if needed: `app/www/index.html`, `app/www/mapa-visitas.js`, tests from Tasks 1–4

- [ ] **Step 1: Run all relevant existing map/jornada/UI tests**

```bash
node tests/mapa-layout.test.js
node tests/jornada-mapa.test.js
node tests/map-match.test.mjs
node tests/jornada-integracao.test.js
```

Expected: PASS, with no regressions to existing map matching, jornada, or layout behavior.

- [ ] **Step 2: Start the existing app command from `package.json`** and exercise the flow: open Visitas → apply period/promoter filter → select list item → verify map focus and full modal → close modal → select marker → verify list highlight → repeat filter twice.

- [ ] **Step 3: Capture desktop and mobile evidence**. Confirm no framework overlay, no console errors, no horizontal overflow, no duplicated markers/rows, and usable empty/partial states.

- [ ] **Step 4: Commit only the final implementation/test changes**

```bash
git status --short
git diff --check
git add app/www/index.html app/www/mapa-visitas.js tests/mapa-visitas-integrado.test.js tests/mapa-layout.test.js
git commit -m "feat: integrate map into visits workflow"
```

## Self-review checklist

- Spec coverage: layout, ordering, shared modal, two-way selection, cleanup, missing coordinates, errors, accessibility, responsive behavior, and regression validation each have a task.
- Placeholder scan: no `TODO`, `TBD`, or unspecified edge-case instruction remains.
- Interface consistency: `normalizarVisitasMapa`, `ordenarVisitasPorPromotor`, `renderSequenciaVisitas`, `renderMapaVisitas`, `limparMarcadoresVisitas`, `selecionarVisitaNoMapa`, and `selecionarVisitaNaLista` are defined before consumers.
