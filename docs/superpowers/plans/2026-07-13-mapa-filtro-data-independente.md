# Filtro de data independente na aba Mapa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a aba Mapa resetar para o dia atual ao ser aberta e deixar seus filtros isolados das demais abas.

**Architecture:** Adicionar uma coleção e uma rotina de carregamento próprias do Mapa. A navegação reseta as datas do Mapa e carrega essa coleção; `visitasGestor` e os campos da Visão geral permanecem inalterados.

**Tech Stack:** HTML/JavaScript inline, API `/api/listar`, testes Node.js com `assert` sobre `index.html`.

## Global Constraints

- Não alterar a API nem o banco.
- Preservar IDs e funções existentes usados pelos testes e pela interface.
- Validar com o teste específico do Mapa e com checagem sintática do JavaScript embutido quando aplicável.

### Task 1: Teste de regressão do isolamento do Mapa

**Files:**
- Modify: `tests/mapa-timeline.test.js`

- [ ] **Step 1: Write the failing test**

Adicionar asserts para `visitasMapa`, `carregarMapa`, o reset de datas ao entrar em Mapa e a ausência de cópia entre `gFiltroDe/gFiltroAte` e os campos do Mapa.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/mapa-timeline.test.js`
Expected: FAIL porque a implementação atual sincroniza os filtros e não possui carregamento independente.

### Task 2: Implementar o estado e carregamento independente

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement the minimal code**

Criar `visitasMapa`, uma rotina que consulta `/api/listar` com os valores de `mapaFiltroPromotor`, `mapaFiltroDe` e `mapaFiltroAte`, fazer `renderMapa()` consumir `visitasMapa`, e alterar `mudarAbaG('mapa')` para resetar as datas para hoje e chamar o carregamento próprio.

- [ ] **Step 2: Remove the cross-tab writes**

Retirar a sincronização de campos em `sincronizarFiltrosMapa()` e `aplicarFiltrosMapa()`, mantendo apenas a atualização do Mapa.

- [ ] **Step 3: Run the test to verify it passes**

Run: `node tests/mapa-timeline.test.js`
Expected: PASS.

### Task 3: Verificação final

- [ ] **Step 1: Run related regression tests**

Run: `node tests/mapa-timeline.test.js` e `node tests/coordenadores-dashboard.test.js`.
Expected: ambos terminam com saída de sucesso.
