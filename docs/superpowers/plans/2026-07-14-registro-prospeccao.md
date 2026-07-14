# Registro de Prospecção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o promotor registre rapidamente uma visita "de prospecção" (nome do local + foto com timestamp + GPS), sem passar pelo formulário completo de 5 seções, para comprovar que esteve em locais que não compraram.

**Architecture:** Reaproveita a tabela `visitas` existente com `dados.tipo = 'prospeccao'` (sem migration). Um modal leve e independente do wizard de "Nova visita" reaproveita as funções já existentes de captura de GPS (`capturarLocalizacaoAtual`), metadados de foto (`criarFotoComMetadados`) e o endpoint `POST /api/salvar` sem alterações no backend de salvamento. `api/rota-km.js` ganha um parâmetro opcional para excluir prospecção do cálculo de km, exposto como checkbox no mapa do gestor.

**Tech Stack:** Vanilla JS inline em `index.html` (sem framework, sem build), Node.js `assert` para testes (`node tests/<arquivo>.test.js`), Neon Postgres via `api/*.js`.

## Global Constraints

- Não criar tabela nova nem migration — tudo via `dados` JSON da tabela `visitas` já existente.
- Não modificar o wizard de "Nova visita" (`salvarVisita`, seções 0-4) além da extração pontual descrita na Task 1.
- Sem fila de validação por IA para foto de prospecção — `registrarValidacoesVisita` já não dispara pra ela (só roda quando `dados.presenca?.tabelaVisivel` é `true`), não precisa de mudança.
- `api/salvar.js` não muda — o upsert de cliente por `nomeFantasia` já existente cobre a exigência de "prospecção vira carteira".
- Comportamento de `api/rota-km.js` sem o parâmetro novo não pode mudar (default = inclui prospecção, igual hoje).
- Depois de validar no navegador, seguir o fluxo já estabelecido nas fases do app Android: copiar `index.html` atualizado para `app/www/index.html`, reaplicar a troca do `const API` para `https://promotor-cleantabaco.vercel.app`, rodar `npx cap sync android`.
- Rodar todos os testes com `node tests/<arquivo>.test.js` (não há `npm test`); ao final de cada task, também rodar `node tests/exif-timestamp.test.js` e `node tests/gps-captura.test.js` pra garantir que não quebrou nada preexistente.

---

### Task 1: Extrair `prepararFotoProcessada` (refactor puro, sem mudança de comportamento)

**Files:**
- Modify: `index.html:2466-2483` (função `processarImagemCapturada`)
- Test: `tests/prospeccao-foto-refactor.test.js`

**Interfaces:**
- Produces: `async function prepararFotoProcessada(dataUrl, origem, exifDataExterna = null)` retornando um objeto foto (mesmo shape de `criarFotoComMetadados`), consumido pela Task 2 para a captura de foto de prospecção.
- Consumes: `carimbarDataHora(ctx, w, h)` e `criarFotoComMetadados(dataUrl, origem, exifData)`, já existentes, sem mudança de assinatura.

O código atual de `processarImagemCapturada` faz resize da imagem num canvas e empurra o resultado pra `fotos` (array do wizard). Vamos extrair a parte de resize+metadados pra uma função que apenas retorna o objeto, sem mexer em `fotos`/`renderFotos`, mantendo `processarImagemCapturada` funcionando exatamente igual.

- [ ] **Step 1: Escrever o teste que verifica a extração**

Criar `tests/prospeccao-foto-refactor.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('async function prepararFotoProcessada(dataUrl, origem, exifDataExterna = null)'), 'deve existir helper prepararFotoProcessada reaproveitavel');
assert.ok(/async function prepararFotoProcessada\(dataUrl, origem, exifDataExterna = null\) \{[\s\S]*?return criarFotoComMetadados/.test(html), 'prepararFotoProcessada deve retornar o resultado de criarFotoComMetadados, sem push');
assert.ok(/async function processarImagemCapturada\(dataUrl, origem, exifDataExterna = null\) \{\s*fotos\.push\(await prepararFotoProcessada\(dataUrl, origem, exifDataExterna\)\);\s*renderFotos\(\);\s*\}/.test(html), 'processarImagemCapturada deve delegar para prepararFotoProcessada e manter o push em fotos');

console.log('prospeccao-foto-refactor.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/prospeccao-foto-refactor.test.js`
Expected: `AssertionError` (a função `prepararFotoProcessada` ainda não existe).

- [ ] **Step 3: Fazer a extração em `index.html`**

Substituir o bloco atual (linhas 2466-2483):

```js
async function processarImagemCapturada(dataUrl, origem, exifDataExterna = null) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Nao foi possivel carregar a foto'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  const max = 800;
  let w = img.width, h = img.height;
  if (w > max || h > max) { if (w > h) { h = h*max/w; w = max; } else { w = w*max/h; h = max; } }
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  if (origem === 'camera') carimbarDataHora(ctx, w, h);
  fotos.push(await criarFotoComMetadados(canvas.toDataURL('image/jpeg', 0.7), origem, exifDataExterna));
  renderFotos();
}
```

por:

```js
async function prepararFotoProcessada(dataUrl, origem, exifDataExterna = null) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Nao foi possivel carregar a foto'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  const max = 800;
  let w = img.width, h = img.height;
  if (w > max || h > max) { if (w > h) { h = h*max/w; w = max; } else { w = w*max/h; h = max; } }
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  if (origem === 'camera') carimbarDataHora(ctx, w, h);
  return criarFotoComMetadados(canvas.toDataURL('image/jpeg', 0.7), origem, exifDataExterna);
}

async function processarImagemCapturada(dataUrl, origem, exifDataExterna = null) {
  fotos.push(await prepararFotoProcessada(dataUrl, origem, exifDataExterna));
  renderFotos();
}
```

- [ ] **Step 4: Rodar o teste novo e os testes de regressão**

Run:
```
node tests/prospeccao-foto-refactor.test.js
node tests/exif-timestamp.test.js
node tests/gps-captura.test.js
```
Expected: as três saídas terminam com "passou", sem `AssertionError`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/prospeccao-foto-refactor.test.js
git commit -m "refactor: extrai prepararFotoProcessada para reaproveitar no fluxo de prospeccao"
```

---

### Task 2: Estado e captura de foto para prospecção

**Files:**
- Modify: `index.html:1590` (declaração de `let fotos = [];`)
- Modify: `index.html` (perto da função `fotoSrc`, ~linha 2373 — inserir `renderFotoProspeccao`/`removerFotoProspeccao`)
- Modify: `index.html` (perto de `acionarCaptura`/`tirarFotoNativa`, ~linha 2507-2525 — inserir versões de prospecção)
- Test: `tests/prospeccao-captura-foto.test.js`

**Interfaces:**
- Consumes: `prepararFotoProcessada(dataUrl, origem, exifDataExterna)` (Task 1), `garantirCameraBridgeCarregada()`, `exifDataOriginalCamera(exif)`, `fotoSrc(foto)` — todas já existentes.
- Produces: `let fotoProspeccao = null;`, `function renderFotoProspeccao()`, `function removerFotoProspeccao()`, `async function processarFotoProspeccao(dataUrl, origem, exifDataExterna)`, `function acionarCapturaProspeccao()`, `async function tirarFotoProspeccaoNativa()`, `function processarFotoProspeccaoInput(event)` — consumidos pela Task 3 (markup do modal) e Task 4 (`salvarProspeccao`).

- [ ] **Step 1: Escrever o teste**

Criar `tests/prospeccao-captura-foto.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('let fotoProspeccao = null;'), 'deve existir estado global fotoProspeccao');
assert.ok(html.includes('async function processarFotoProspeccao(dataUrl, origem, exifDataExterna = null)'), 'deve existir processarFotoProspeccao');
assert.ok(/fotoProspeccao = await prepararFotoProcessada/.test(html), 'processarFotoProspeccao deve reaproveitar prepararFotoProcessada');
assert.ok(html.includes('function renderFotoProspeccao()'), 'deve existir renderFotoProspeccao');
assert.ok(html.includes('function removerFotoProspeccao()'), 'deve existir removerFotoProspeccao');
assert.ok(html.includes('function acionarCapturaProspeccao()'), 'deve existir acionarCapturaProspeccao');
assert.ok(html.includes('async function tirarFotoProspeccaoNativa()'), 'deve existir tirarFotoProspeccaoNativa para o caminho nativo');
assert.ok(html.includes('function processarFotoProspeccaoInput(event)'), 'deve existir handler do input de arquivo da prospeccao');
assert.ok(html.includes("document.getElementById('fotoProspeccaoInput').click()"), 'acionarCapturaProspeccao deve cair no input de arquivo fora do app nativo');

console.log('prospeccao-captura-foto.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/prospeccao-captura-foto.test.js`
Expected: `AssertionError`.

- [ ] **Step 3: Adicionar o estado global**

Em `index.html:1590`, logo após `let fotos = [];`, adicionar:

```js
let fotos = [];
let fotoProspeccao = null;
```

- [ ] **Step 4: Adicionar `renderFotoProspeccao` e `removerFotoProspeccao`**

Logo após a função `fotoMeta` (perto da linha 2373), adicionar:

```js
function renderFotoProspeccao() {
  const grid = document.getElementById('prospeccaoFotoGrid');
  if (!grid) return;
  if (!fotoProspeccao) { grid.innerHTML = ''; return; }
  grid.innerHTML = `
    <div class="foto-thumb">
      <img src="${fotoSrc(fotoProspeccao)}" alt="Foto da prospeccao">
      <button class="foto-del" onclick="removerFotoProspeccao()" aria-label="Remover foto">×</button>
    </div>
  `;
}
function removerFotoProspeccao() { fotoProspeccao = null; renderFotoProspeccao(); }
```

- [ ] **Step 5: Adicionar as funções de captura**

Logo após a função `tirarFotoNativa()` (perto da linha 2517), adicionar:

```js
async function processarFotoProspeccao(dataUrl, origem, exifDataExterna = null) {
  fotoProspeccao = await prepararFotoProcessada(dataUrl, origem, exifDataExterna);
  renderFotoProspeccao();
}

async function tirarFotoProspeccaoNativa() {
  await garantirCameraBridgeCarregada();
  const { getPhoto, CameraResultType, CameraSource } = window.NativeCameraBridge;
  const foto = await getPhoto({
    quality: 80,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    saveToGallery: false
  });
  await processarFotoProspeccao(foto.dataUrl, 'camera', exifDataOriginalCamera(foto.exif));
}

function acionarCapturaProspeccao() {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    tirarFotoProspeccaoNativa().catch(e => toast('Erro ao acessar camera: ' + e.message));
  } else {
    document.getElementById('fotoProspeccaoInput').click();
  }
}

function processarFotoProspeccaoInput(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => { await processarFotoProspeccao(e.target.result, 'camera', null); };
  reader.readAsDataURL(file);
}
```

- [ ] **Step 6: Rodar o teste novo e os testes de regressão**

Run:
```
node tests/prospeccao-captura-foto.test.js
node tests/exif-timestamp.test.js
node tests/gps-captura.test.js
```
Expected: as três terminam com "passou".

- [ ] **Step 7: Commit**

```bash
git add index.html tests/prospeccao-captura-foto.test.js
git commit -m "feat: adiciona estado e captura de foto para registro de prospeccao"
```

---

### Task 3: Modal de prospecção e botão de entrada no Painel

**Files:**
- Modify: `index.html:760-765` (nav do promotor)
- Modify: `index.html:768-781` (`#pPainel`)
- Modify: `index.html:1554` (logo após o fechamento de `#modalDetalhe`)
- Test: `tests/prospeccao-modal.test.js`

**Interfaces:**
- Consumes: `acionarCapturaProspeccao()`, `processarFotoProspeccaoInput(event)`, `renderFotoProspeccao()` (Task 2).
- Produces: `function abrirModalProspeccao()`, `function fecharModalProspeccao()`, elemento `id="modalProspeccao"`, campo `id="prospeccaoNome"`, botão `id="btnSalvarProspeccao"` — consumidos pela Task 4 (`salvarProspeccao`).

- [ ] **Step 1: Escrever o teste**

Criar `tests/prospeccao-modal.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes(`onclick="abrirModalProspeccao()"`), 'deve existir botao que abre o modal de prospeccao');
assert.ok(html.includes('id="modalProspeccao"'), 'deve existir o modal de prospeccao');
assert.ok(html.includes('id="prospeccaoNome"'), 'modal deve ter campo de nome do local');
assert.ok(html.includes('id="fotoProspeccaoInput"'), 'modal deve ter input de arquivo para foto');
assert.ok(html.includes('id="prospeccaoFotoGrid"'), 'modal deve ter grid para mostrar a foto capturada');
assert.ok(html.includes('id="btnSalvarProspeccao"'), 'modal deve ter botao de salvar');
assert.ok(html.includes('function abrirModalProspeccao()'), 'deve existir funcao abrirModalProspeccao');
assert.ok(html.includes('function fecharModalProspeccao()'), 'deve existir funcao fecharModalProspeccao');
assert.ok(/abrirModalProspeccao\(\)\s*\{[\s\S]{0,300}classList\.add\('open'\)/.test(html), 'abrirModalProspeccao deve abrir o overlay com classList.add(open)');
assert.ok(/fecharModalProspeccao\(\)\s*\{\s*document\.getElementById\('modalProspeccao'\)\.classList\.remove\('open'\)/.test(html), 'fecharModalProspeccao deve fechar com classList.remove(open)');

console.log('prospeccao-modal.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/prospeccao-modal.test.js`
Expected: `AssertionError`.

- [ ] **Step 3: Adicionar o botão no nav/Painel**

Em `index.html:761`, logo após o botão "＋ Nova", **não** mexer no nav (ele já está cheio) — em vez disso, adicionar o botão dentro do próprio `#pPainel`. Substituir o bloco (linhas 768-781):

```html
  <div class="page active" id="pPainel">
    <div class="page-intro">
      <h1>Minha performance</h1>
      <p>Acompanhe suas metas do mes e veja o que falta para bater.</p>
    </div>
    <div class="gestor-wrap">
      <div class="card" id="pResumoMesCard" style="margin-bottom:14px;"></div>
      <div class="resumo-grid" id="pPerformanceCards"></div>
      <div class="card">
        <div class="card-title">Próximos passos</div>
        <div id="pPerformanceAcoes"><div class="empty">Carregando metas...</div></div>
      </div>
    </div>
  </div>
```

por:

```html
  <div class="page active" id="pPainel">
    <div class="page-intro">
      <h1>Minha performance</h1>
      <p>Acompanhe suas metas do mes e veja o que falta para bater.</p>
    </div>
    <div class="gestor-wrap">
      <button type="button" class="camera-btn primary" style="margin-bottom:14px;" onclick="abrirModalProspeccao()">📍 Registrar prospecção (visita sem venda)</button>
      <div class="card" id="pResumoMesCard" style="margin-bottom:14px;"></div>
      <div class="resumo-grid" id="pPerformanceCards"></div>
      <div class="card">
        <div class="card-title">Próximos passos</div>
        <div id="pPerformanceAcoes"><div class="empty">Carregando metas...</div></div>
      </div>
    </div>
  </div>
```

- [ ] **Step 4: Adicionar o modal**

Logo após o fechamento de `</div>` do `#modalDetalhe` (linha 1554), adicionar:

```html

<div class="modal-overlay" id="modalProspeccao">
  <div class="modal">
    <div class="modal-header">
      <h3>Registrar prospecção</h3>
      <button class="modal-close" onclick="fecharModalProspeccao()">×</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>Nome do local *</label><input type="text" id="prospeccaoNome" placeholder="Ex: Mercadinho do Zé"></div>
      <input type="file" id="fotoProspeccaoInput" accept="image/*" capture="environment" onchange="processarFotoProspeccaoInput(event)">
      <div class="camera-actions">
        <button type="button" class="camera-btn primary" onclick="acionarCapturaProspeccao()">Tirar foto</button>
      </div>
      <div class="foto-text" style="margin-top:10px;">Registre o local mesmo sem venda — a foto e o GPS comprovam a visita.</div>
      <div class="foto-grid" id="prospeccaoFotoGrid"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-salvar" id="btnSalvarProspeccao" onclick="salvarProspeccao()">✓ Salvar prospecção</button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Adicionar `abrirModalProspeccao`/`fecharModalProspeccao` e o listener de clique fora**

Logo após a função `fecharModal()` (perto da linha 5513), adicionar:

```js
function abrirModalProspeccao() {
  document.getElementById('prospeccaoNome').value = '';
  fotoProspeccao = null;
  renderFotoProspeccao();
  document.getElementById('modalProspeccao').classList.add('open');
}
function fecharModalProspeccao() { document.getElementById('modalProspeccao').classList.remove('open'); }
document.getElementById('modalProspeccao').addEventListener('click', function(e) { if(e.target===this) fecharModalProspeccao(); });
```

- [ ] **Step 6: Rodar o teste novo e os testes de regressão**

Run:
```
node tests/prospeccao-modal.test.js
node tests/exif-timestamp.test.js
node tests/gps-captura.test.js
```
Expected: as três terminam com "passou".

- [ ] **Step 7: Commit**

```bash
git add index.html tests/prospeccao-modal.test.js
git commit -m "feat: adiciona modal e botao de entrada para registro de prospeccao"
```

---

### Task 4: `salvarProspeccao()` — salvar no backend existente

**Files:**
- Modify: `index.html` (perto de `salvarVisita`, ~linha 3141 — adicionar função nova antes ou depois)
- Test: `tests/prospeccao-salvar.test.js`

**Interfaces:**
- Consumes: `capturarLocalizacaoAtual()`, `prepararFotosParaEnvio(lista)`, `apiFetch(url, opts)`, `headers()`, `toast(msg)`, `fecharModalProspeccao()` (Task 3), `carregarVisitasPromotor(force)` — todos já existentes.
- Produces: `async function salvarProspeccao()`, chamada pelo botão `#btnSalvarProspeccao` (Task 3).

- [ ] **Step 1: Escrever o teste**

Criar `tests/prospeccao-salvar.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('async function salvarProspeccao()'), 'deve existir salvarProspeccao');
assert.ok(/tipo:\s*'prospeccao'/.test(html), 'dados enviados devem marcar tipo prospeccao');
assert.ok(/pdv:\s*\{\s*nomeFantasia:\s*nome\s*\}/.test(html), 'prospeccao deve enviar so nomeFantasia no pdv, sem os demais campos do formulario completo');
assert.ok(/localizacao\s*=\s*await capturarLocalizacaoAtual\(\)/.test(html), 'prospeccao deve capturar GPS na hora de salvar, igual a visita normal');
assert.ok(/prepararFotosParaEnvio\(\[fotoProspeccao\]\)/.test(html), 'prospeccao deve reaproveitar prepararFotosParaEnvio com a foto unica');
assert.ok(/await apiFetch\(`\$\{API\}\/api\/salvar`/.test(html), 'prospeccao deve usar o endpoint api/salvar ja existente, sem endpoint novo');

console.log('prospeccao-salvar.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/prospeccao-salvar.test.js`
Expected: `AssertionError`.

- [ ] **Step 3: Implementar `salvarProspeccao`**

Logo antes da função `async function salvarVisita() {` (linha 3141), adicionar:

```js
async function salvarProspeccao() {
  const nome = document.getElementById('prospeccaoNome').value.trim();
  if (!nome) { toast('⚠️ Informe o nome do local'); return; }
  if (!fotoProspeccao) { toast('⚠️ Anexe uma foto'); return; }

  const btn = document.getElementById('btnSalvarProspeccao');
  btn.disabled = true;
  btn.textContent = 'Capturando GPS... aguarde';

  try {
    const localizacao = await capturarLocalizacaoAtual();
    btn.textContent = 'Salvando...';

    const dados = { tipo: 'prospeccao', pdv: { nomeFantasia: nome }, localizacao };
    const fotosParaSalvar = prepararFotosParaEnvio([fotoProspeccao]);

    const res = await apiFetch(`${API}/api/salvar`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ promotor: usuarioAtual, dados, fotos: fotosParaSalvar })
    });
    const data = await res.json();
    if (data.ok) {
      toast('✅ Prospecção registrada');
      fecharModalProspeccao();
      carregarVisitasPromotor(true);
    } else {
      toast('❌ ' + (data.erro || 'Erro ao salvar'));
    }
  } catch (e) {
    toast('❌ Erro ao salvar: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Salvar prospecção';
  }
}

```

- [ ] **Step 4: Rodar o teste novo e os testes de regressão**

Run:
```
node tests/prospeccao-salvar.test.js
node tests/exif-timestamp.test.js
node tests/gps-captura.test.js
node tests/salvamento-rascunho.test.js
```
Expected: as quatro terminam com "passou".

- [ ] **Step 5: Commit**

```bash
git add index.html tests/prospeccao-salvar.test.js
git commit -m "feat: implementa salvarProspeccao reaproveitando api/salvar existente"
```

---

### Task 5: Badge de prospecção no histórico do promotor

**Files:**
- Modify: `index.html:3438-3464` (função `renderHistorico`)
- Test: `tests/prospeccao-historico.test.js`

**Interfaces:**
- Consumes: nenhuma nova — só lê `v.dados.tipo` das visitas já carregadas por `carregarVisitasPromotor`.
- Produces: nenhuma função nova — só o branch dentro de `renderHistorico()`.

- [ ] **Step 1: Escrever o teste**

Criar `tests/prospeccao-historico.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(/d\.tipo === 'prospeccao'/.test(html), 'renderHistorico deve verificar o tipo prospeccao');
assert.ok(html.includes('🔍 Prospecção'), 'deve existir badge visual identificando prospeccao no historico');

console.log('prospeccao-historico.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/prospeccao-historico.test.js`
Expected: `AssertionError`.

- [ ] **Step 3: Adicionar o branch em `renderHistorico`**

Substituir o corpo do `.map` (linhas 3438-3464):

```js
  lista.innerHTML = filtradas.map((v,i) => {
    const d = v.dados || {};
    const data = new Date(v.criado_em);
    const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const skus = (d.presenca?.skusPresentes||[]).length;
    const temPedido = d.comercial?.pedidoFeito === 'Sim';
    const status = statusDaVisita(v);
    return `
      <div class="visita-card">
        <div class="visita-header">
          <div class="visita-nome">${d.pdv?.nomeFantasia||'—'}</div>
          <div class="visita-data">${dataStr}</div>
        </div>
        <div class="visita-info">${d.pdv?.tipo||''} ${d.pdv?.cidade ? '· '+d.pdv.cidade : ''}</div>
        <div>
          <span class="badge badge-purple">${d.presenca?.temProduto||''}</span>
          ${skus > 0 ? `<span class="badge badge-green">${skus} SKU${skus>1?'s':''}</span>` : ''}
          ${temPedido ? `<span class="badge badge-orange">Pedido feito</span>` : ''}
          <span class="status-chip ${statusClass(status)}">${status}</span>
        </div>
        <div class="visita-actions">
          <button class="btn-detalhes" onclick="abrirDetalhePromotor('${v.id}')">Ver detalhes</button>
          <button class="btn-editar" onclick="editarVisita('${v.id}', visitasPromotor)">Editar</button>
        </div>
      </div>
    `;
  }).join('');
```

por:

```js
  lista.innerHTML = filtradas.map((v,i) => {
    const d = v.dados || {};
    const data = new Date(v.criado_em);
    const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    if (d.tipo === 'prospeccao') {
      return `
        <div class="visita-card">
          <div class="visita-header">
            <div class="visita-nome">${d.pdv?.nomeFantasia||'—'}</div>
            <div class="visita-data">${dataStr}</div>
          </div>
          <div><span class="badge badge-purple">🔍 Prospecção</span></div>
          <div class="visita-actions">
            <button class="btn-detalhes" onclick="abrirDetalhePromotor('${v.id}')">Ver detalhes</button>
          </div>
        </div>
      `;
    }
    const skus = (d.presenca?.skusPresentes||[]).length;
    const temPedido = d.comercial?.pedidoFeito === 'Sim';
    const status = statusDaVisita(v);
    return `
      <div class="visita-card">
        <div class="visita-header">
          <div class="visita-nome">${d.pdv?.nomeFantasia||'—'}</div>
          <div class="visita-data">${dataStr}</div>
        </div>
        <div class="visita-info">${d.pdv?.tipo||''} ${d.pdv?.cidade ? '· '+d.pdv.cidade : ''}</div>
        <div>
          <span class="badge badge-purple">${d.presenca?.temProduto||''}</span>
          ${skus > 0 ? `<span class="badge badge-green">${skus} SKU${skus>1?'s':''}</span>` : ''}
          ${temPedido ? `<span class="badge badge-orange">Pedido feito</span>` : ''}
          <span class="status-chip ${statusClass(status)}">${status}</span>
        </div>
        <div class="visita-actions">
          <button class="btn-detalhes" onclick="abrirDetalhePromotor('${v.id}')">Ver detalhes</button>
          <button class="btn-editar" onclick="editarVisita('${v.id}', visitasPromotor)">Editar</button>
        </div>
      </div>
    `;
  }).join('');
```

- [ ] **Step 4: Rodar o teste novo e os testes de regressão**

Run:
```
node tests/prospeccao-historico.test.js
node tests/filtros-periodo.test.js
```
Expected: as duas terminam com "passou".

- [ ] **Step 5: Commit**

```bash
git add index.html tests/prospeccao-historico.test.js
git commit -m "feat: mostra badge de prospeccao no historico de visitas do promotor"
```

---

### Task 6: Parâmetro `incluirProspeccao` em `api/rota-km.js`

**Files:**
- Modify: `api/rota-km.js:15,37-40` (destructure do query e filtro de `visitasComGps`)
- Test: `tests/prospeccao-rota-km.test.js`

**Interfaces:**
- Consumes: nenhuma — só o `dados.tipo` já gravado pela Task 4.
- Produces: query param `incluirProspeccao` (string `'false'` exclui prospecção; qualquer outro valor ou ausência mantém o comportamento atual de incluir tudo), consumido pela Task 7 (checkbox do gestor).

- [ ] **Step 1: Escrever o teste**

Criar `tests/prospeccao-rota-km.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync('api/rota-km.js', 'utf8');

assert.ok(/let \{ promotor, de, ate, incluirProspeccao \} = req\.query;/.test(src), 'rota-km deve aceitar o parametro incluirProspeccao');
assert.ok(/tipo:\s*d\?\.tipo/.test(src), 'visitasComGps deve carregar o tipo de cada visita para poder filtrar');
assert.ok(/incluirProspeccao !== 'false' \|\| v\.tipo !== 'prospeccao'/.test(src), 'deve filtrar fora prospeccao apenas quando incluirProspeccao=false for explicito');

console.log('prospeccao-rota-km.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/prospeccao-rota-km.test.js`
Expected: `AssertionError`.

- [ ] **Step 3: Atualizar `api/rota-km.js`**

Na linha 15, substituir:

```js
  let { promotor, de, ate } = req.query;
```

por:

```js
  let { promotor, de, ate, incluirProspeccao } = req.query;
```

Nas linhas 37-40, substituir:

```js
    const visitasComGps = rows
      .map(v => typeof v.dados === 'string' ? JSON.parse(v.dados) : v.dados)
      .map(d => ({ nome: d?.pdv?.nomeFantasia || 'PDV não identificado', localizacao: d?.localizacao }))
      .filter(v => v.localizacao?.ok && Number.isFinite(+v.localizacao.latitude) && Number.isFinite(+v.localizacao.longitude));
```

por:

```js
    const visitasComGps = rows
      .map(v => typeof v.dados === 'string' ? JSON.parse(v.dados) : v.dados)
      .map(d => ({ nome: d?.pdv?.nomeFantasia || 'PDV não identificado', localizacao: d?.localizacao, tipo: d?.tipo }))
      .filter(v => v.localizacao?.ok && Number.isFinite(+v.localizacao.latitude) && Number.isFinite(+v.localizacao.longitude))
      .filter(v => incluirProspeccao !== 'false' || v.tipo !== 'prospeccao');
```

- [ ] **Step 4: Rodar o teste novo**

Run: `node tests/prospeccao-rota-km.test.js`
Expected: "prospeccao-rota-km.test.js passou".

- [ ] **Step 5: Commit**

```bash
git add api/rota-km.js tests/prospeccao-rota-km.test.js
git commit -m "feat: permite excluir prospeccao do calculo de km via parametro incluirProspeccao"
```

---

### Task 7: Checkbox "Incluir prospecção no km" no mapa do gestor

**Files:**
- Modify: `index.html:1479-1480` (filtros do mapa)
- Modify: `index.html:4108-4121` (`carregarKmRota`)
- Test: `tests/prospeccao-mapa-checkbox.test.js`

**Interfaces:**
- Consumes: parâmetro `incluirProspeccao` da API (Task 6).
- Produces: elemento `id="mapaIncluirProspeccao"`, usado só dentro de `carregarKmRota`.

- [ ] **Step 1: Escrever o teste**

Criar `tests/prospeccao-mapa-checkbox.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('id="mapaIncluirProspeccao"'), 'mapa deve ter checkbox para incluir/excluir prospeccao do km');
assert.ok(/mapaIncluirProspeccao['"]\)\?\.checked/.test(html), 'carregarKmRota deve ler o estado do checkbox');
assert.ok(/incluirProspeccao=\$\{incluirProspeccao\}/.test(html), 'carregarKmRota deve repassar o parametro na URL da API');
assert.ok(html.includes(`onclick="aplicarFiltrosMapa()"`), 'aplicarFiltrosMapa continua sendo o gatilho existente de recarregar o mapa');

console.log('prospeccao-mapa-checkbox.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/prospeccao-mapa-checkbox.test.js`
Expected: `AssertionError`.

- [ ] **Step 3: Adicionar o checkbox nos filtros do mapa**

Em `index.html:1479-1480`, logo após:

```html
          <div class="filtro-group"><label>Até</label><input type="date" id="mapaFiltroAte"></div>
```

adicionar:

```html
          <div class="filtro-group"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-weight:400;"><input type="checkbox" id="mapaIncluirProspeccao" checked onchange="aplicarFiltrosMapa()"> Incluir prospecção no km</label></div>
```

- [ ] **Step 4: Repassar o parâmetro em `carregarKmRota`**

Em `index.html:4108-4121`, substituir:

```js
async function carregarKmRota(promotor, de, ate) {
  const card = document.getElementById('mapaKmCard');
  const valor = document.getElementById('mapaKmValor');
  const trechosEl = document.getElementById('mapaKmTrechos');
  if (!card || !valor) return;
  if (!promotor) { card.style.display = 'none'; if (trechosEl) trechosEl.innerHTML = ''; return; }
  card.style.display = 'block';
  valor.textContent = 'Calculando...';
  if (trechosEl) trechosEl.innerHTML = '';
  try {
    let url = `${API}/api/rota-km?promotor=${encodeURIComponent(promotor)}&`;
    if (de) url += `de=${de}T00:00:00Z&`;
    if (ate) url += `ate=${ate}T23:59:59Z&`;
```

por:

```js
async function carregarKmRota(promotor, de, ate) {
  const card = document.getElementById('mapaKmCard');
  const valor = document.getElementById('mapaKmValor');
  const trechosEl = document.getElementById('mapaKmTrechos');
  if (!card || !valor) return;
  if (!promotor) { card.style.display = 'none'; if (trechosEl) trechosEl.innerHTML = ''; return; }
  card.style.display = 'block';
  valor.textContent = 'Calculando...';
  if (trechosEl) trechosEl.innerHTML = '';
  try {
    const incluirProspeccao = document.getElementById('mapaIncluirProspeccao')?.checked !== false;
    let url = `${API}/api/rota-km?promotor=${encodeURIComponent(promotor)}&incluirProspeccao=${incluirProspeccao}&`;
    if (de) url += `de=${de}T00:00:00Z&`;
    if (ate) url += `ate=${ate}T23:59:59Z&`;
```

- [ ] **Step 5: Rodar o teste novo e os testes de regressão**

Run:
```
node tests/prospeccao-mapa-checkbox.test.js
node tests/mapa-timeline.test.js
```
Expected: as duas terminam com "passou".

- [ ] **Step 6: Commit**

```bash
git add index.html tests/prospeccao-mapa-checkbox.test.js
git commit -m "feat: adiciona checkbox de incluir/excluir prospeccao no km do mapa do gestor"
```

---

### Task 8: Validar no navegador e propagar para o app Android

**Files:**
- Modify: `app/www/index.html` (cópia sincronizada)

**Interfaces:** N/A — task de validação manual e propagação, sem código novo.

- [ ] **Step 1: Rodar a suíte completa de testes**

Run (bash):
```bash
for f in tests/*.test.js; do node "$f" || echo "FALHOU: $f"; done
```
Expected: nenhuma linha "FALHOU".

- [ ] **Step 2: Testar manualmente no navegador**

Abrir `index.html` localmente (ou no ambiente de dev), logar como promotor, clicar em "📍 Registrar prospecção", preencher nome, tirar/escolher foto, salvar. Confirmar: toast de sucesso, item aparece no Histórico com badge "🔍 Prospecção", e o nome aparece na Carteira de clientes.

Como gestor, abrir a aba Mapa, filtrar pelo promotor usado no teste, conferir que o card de km aparece e que desmarcar "Incluir prospecção no km" muda o valor calculado (ou o texto de motivo, se ficar com menos de 2 pontos).

- [ ] **Step 3: Propagar para o app Android**

```powershell
Copy-Item index.html app\www\index.html
```

Em `app\www\index.html`, trocar `const API = '';` por `const API = 'https://promotor-cleantabaco.vercel.app';` (mesma troca já documentada nas fases anteriores do app).

```powershell
cd app
npx cap sync android
```
Expected: saída terminando em "Sync finished".

- [ ] **Step 4: Atualizar o plano com o status desta sessão**

Editar este arquivo marcando os checkboxes concluídos e adicionar ao final:

```markdown
## Status (atualizar a cada sessão)

- Registro de prospecção concluído em: <data>.
- Testado manualmente: registro salva, aparece no histórico com badge, entra na carteira, km reflete o checkbox de incluir/excluir prospecção.
```

- [ ] **Step 5: Commit**

```bash
git add app/www/index.html docs/superpowers/plans/2026-07-14-registro-prospeccao.md
git commit -m "docs: marca registro de prospeccao como concluido e propaga para o app Android"
```
