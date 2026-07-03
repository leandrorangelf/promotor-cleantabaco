# Bonificacao Por Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar a bonificacao mensal estimada por promotor na pagina Performance.

**Architecture:** Extrair a regra para `bonus.js`, exportando funcoes puras para testes Node e anexando ao `window` para uso no HTML. Atualizar `renderPerformance()` para consumir o resumo de bonus junto dos indicadores ja existentes.

**Tech Stack:** HTML estatico, JavaScript puro, Node.js `assert` para teste sem novas dependencias.

## Global Constraints

- Nao criar nova aba de Bonificacao.
- Cada meta vale R$ 500.
- O total maximo por promotor e R$ 1.500.
- A meta de visitas usa semanas ativas com minimo de 100 visitas por semana.
- "Cliente novo" e a primeira ocorrencia do PDV no periodo filtrado.

---

### Task 1: Calculo Testavel De Bonificacao

**Files:**
- Create: `bonus.js`
- Create: `tests/bonus.test.js`

**Interfaces:**
- Produces: `calcularBonificacaoPromotores(visitas)` returning an object keyed by promotor name.

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `node tests/bonus.test.js` and verify it fails because `bonus.js` does not exist**
- [ ] **Step 3: Implement `bonus.js` with pure calculation functions**
- [ ] **Step 4: Run `node tests/bonus.test.js` and verify it passes**

### Task 2: Integracao Na Pagina Performance

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `window.calcularBonificacaoPromotores(visitasGestor)`

- [ ] **Step 1: Include `bonus.js` before the inline script in `index.html`**
- [ ] **Step 2: In `renderPerformance()`, merge the bonus summary by promotor**
- [ ] **Step 3: Render bonus total and three goal statuses in cards and table**
- [ ] **Step 4: Run static checks for script inclusion and Node syntax**
