# Metas Performance Promotor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build configurable goals for managers and a promoter home panel showing monthly progress.

**Architecture:** Add a `metas` serverless API backed by Neon, a pure `performance.js` calculator, a manager Metas page, and a promoter Painel page. The UI consumes the API and calculator directly so no created file is orphaned.

**Tech Stack:** Vercel serverless functions, Neon Postgres, plain HTML/CSS/JavaScript, Node `assert` tests.

## Global Constraints

- Only `gestor` can edit metas.
- Promoters can only read metas and their own performance.
- The feature must not alter visits, clients, photos, or history.
- Every new module must be referenced by the running app or tests.
- No dead menus, broken links, or unused API routes.

---

### Task 1: Pure Performance Calculator

**Files:**
- Create: `performance.js`
- Test: `tests/metas-performance.test.js`

**Deliverable:** `calcularPerformancePromotor`, `resolverMetasPromotor`, and `metasPadrao` exported for browser and Node.

### Task 2: Goals API

**Files:**
- Create: `api/metas.js`
- Test: `tests/metas-integracao.test.js`

**Deliverable:** `GET /api/metas` for authenticated users and `POST /api/metas` restricted to gestor.

### Task 3: Manager Goals Page

**Files:**
- Modify: `index.html`
- Test: `tests/metas-integracao.test.js`

**Deliverable:** Gestor nav item `Metas`, page `gMetas`, `carregarMetas`, `renderMetasGestor`, and `salvarMetaGestor`.

### Task 4: Promoter Home Panel

**Files:**
- Modify: `index.html`
- Test: `tests/metas-integracao.test.js`

**Deliverable:** Promoter nav item `Painel`, page `pPainel`, and `renderPainelPromotor` using `calcularPerformancePromotor`.

### Task 5: Verification

**Run:**

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
node tests/metas-performance.test.js
node tests/metas-integracao.test.js
```

Expected: all pass.

## Self-Review

- Spec coverage: configurable goals, manager editor, promoter panel, and no orphan files are covered.
- Placeholder scan: no placeholders.
- Scope: cadastral history is not included here.
