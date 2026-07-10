# Fluxo de Fila para Revisao Manual de Fotos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a revisao manual de fotos sequencial, com analise/aprovacao no modal, avanco automatico e remocao imediata de itens concluidos da fila.

**Architecture:** Reutilizar a lista local `galeriaFotos`, a lista filtrada `galeriaVisiveis` e o modal existente. O frontend tera uma funcao unica para recalcular a fila, uma funcao para avancar apos sucesso e uma acao de analise IA no painel do modal. A API existente continua responsavel por persistir analises e revisoes.

**Tech Stack:** HTML/CSS/JavaScript vanilla, Node.js tests com `assert`.

## Global Constraints

- Nao recarregar a Galeria do servidor depois de analisar ou revisar uma foto.
- Erros de IA, rede ou API devem manter a foto atual aberta e permitir nova tentativa.
- Aprovacao e reprovacao continuam auditadas por `/api/validacoes-fotos`.
- A foto e os dados da visita nao podem ser alterados por esta melhoria.

---

### Task 1: Cobrir o contrato do fluxo em teste

**Files:**
- Modify: `tests/validacao-ia-galeria.test.js`
- Test target: `index.html`

**Interfaces:**
- Produces assertions para `analisarFotoModal`, `avancarParaProximaFotoPendente` e a atualizacao local sem `carregarGaleria()`.

- [ ] **Step 1: Write the failing test**

Adicionar ao final de `tests/validacao-ia-galeria.test.js`:

```js
assert.ok(html.includes('function analisarFotoModal'), 'modal deve permitir analisar IA a foto atual');
assert.ok(html.includes('function avancarParaProximaFotoPendente'), 'fila deve avancar para a proxima foto pendente');
assert.ok(html.includes('galeriaVisiveis = galeriaFotos.filter'), 'fila deve ser recalculada localmente apos revisao');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/validacao-ia-galeria.test.js`
Expected: FAIL com `modal deve permitir analisar IA a foto atual`.

- [ ] **Step 3: Confirm the failing assertions target the missing behavior**

Verificar que a falha ocorre porque as funcoes ainda nao existem no `index.html`, sem alterar o teste para aceitar nomes antigos.

### Task 2: Implementar a fila de revisao no modal

**Files:**
- Modify: `index.html:269-277`
- Modify: `index.html:2541-2645`
- Modify: `index.html:2680-2755`

**Interfaces:**
- `analisarFotoModal()` analisa a foto atual com `/api/avaliar-foto` e grava o resultado via `/api/validacoes-fotos`.
- `avancarParaProximaFotoPendente()` recalcula a fila e abre o primeiro item ainda nao concluido.
- `atualizarValidacaoLocal()` continua sendo a fonte de atualizacao sem novo GET.

- [ ] **Step 1: Add modal analysis controls**

Adicionar um botao `Analisar IA` no painel de revisao, com estado desabilitado enquanto a chamada estiver em andamento. Atualizar `fotoLightboxInfo` com status, score e progresso.

- [ ] **Step 2: Add local queue helpers**

Implementar:

```js
function filaRevisaoAtual() {
  return galeriaFotos.filter(item => statusValidacaoIA(item) !== 'aprovado' && statusValidacaoIA(item) !== 'reprovado');
}

function avancarParaProximaFotoPendente() {
  galeriaVisiveis = filaRevisaoAtual();
  renderGaleria();
  if (!galeriaVisiveis.length) { fecharFoto(); return; }
  abrirFoto(0, 'revisao');
}
```

Manter a navegacao anterior/proxima para consulta, mas fazer acoes concluidas avancarem pela fila recalculada.

- [ ] **Step 3: Add `analisarFotoModal()`**

Localizar `galeriaVisiveis[filaRevisaoIndex]`, preparar a imagem com `prepararFotoParaIA`, chamar `/api/avaliar-foto`, persistir em `/api/validacoes-fotos`, mesclar com `atualizarValidacaoLocal` e chamar `avancarParaProximaFotoPendente()`. Em erro, restaurar o botao e manter o modal aberto.

- [ ] **Step 4: Update manual review actions**

Alterar `revisarFotoGaleria` para, apos `atualizarValidacaoLocal`, chamar `avancarParaProximaFotoPendente()` em vez de depender apenas de `renderGaleria()`. Assim a foto aprovada/reprovada desaparece imediatamente da fila atual.

- [ ] **Step 5: Update modal rendering**

Alterar `abrirFoto` para mostrar acoes quando o item atual ainda nao tem validacao e incluir a posicao atual no texto. O botao `Analisar IA` deve ficar oculto quando a foto ja tem resultado IA; aprovar/reprovar devem permanecer disponiveis enquanto houver registro persistido.

### Task 3: Verificar regressao e sintaxe

**Files:**
- Test: `tests/validacao-ia-galeria.test.js`
- Test: `tests/validacao-fotos-visita-id.test.js`
- Test: `tests/validacao-ia-imagem.test.js`

- [ ] **Step 1: Run the focused tests**

Run: `node tests/validacao-ia-galeria.test.js`
Expected: `validacao-ia-galeria.test.js passou`.

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `validacao-fotos-visita-id.test.js passou`.

Run: `node tests/validacao-ia-imagem.test.js`
Expected: `validacao-ia-imagem.test.js passou`.

- [ ] **Step 2: Check JavaScript syntax**

Run: `node --check bonus.js`
Expected: exit code 0. O JavaScript principal esta embutido em `index.html`, portanto o teste estrutural e os testes de UI cobrem os nomes e chamadas adicionados.

- [ ] **Step 3: Review the diff**

Run: `git diff -- index.html tests/validacao-ia-galeria.test.js`
Expected: somente mudancas do fluxo de fila, controles do modal e teste correspondente.
