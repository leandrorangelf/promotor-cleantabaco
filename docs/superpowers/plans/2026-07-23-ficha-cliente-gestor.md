# Ficha de Cliente (aba Clientes do gestor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma aba **Clientes** no painel do gestor (`index.html`) onde é possível pesquisar um cliente e abrir sua ficha com 3 sub-abas (Resumo, Pedidos, Visitas), sem criar endpoint novo nem alterar o banco.

**Architecture:** Tudo em `index.html` (fonte única do front). A busca filtra client-side o array `clientesGestor` (já carregado e autorizado por `carregarGestor()`). A ficha casa cliente↔visitas reaproveitando `clienteMatchesVisita(cliente, visita)` sobre `visitasGestor` (já carregado e autorizado). As sub-abas Pedidos e Visitas reaproveitam `valorPedido`, `pacotesPedido`, `textoProdutosPedido`, `statusDaVisita`, `statusClass` e o modal de detalhe já existente `abrirDetalheGestor(id)` (que já mostra horário, PDV, pedido e fotos). Nenhuma lógica de negócio é duplicada.

**Tech Stack:** HTML/CSS/JS vanilla inline em `index.html`, sem framework, sem build. Testes em `tests/*.test.js` rodados com `node` puro (asserções de texto sobre o HTML, sem DOM real — mesmo padrão de `tests/area-pedidos.test.js`).

## Global Constraints

- Não criar endpoint novo em `api/*.js` nem alterar schema do banco.
- Não duplicar lógica já existente em `valorPedido`, `pacotesPedido`, `textoProdutosPedido`, `statusDaVisita`, `statusClass`, `clienteMatchesVisita`, `normalizarTexto`, `abrirDetalheGestor`, `renderModal`, `carregarFotosModal` — reaproveitar.
- Tela é somente leitura: nenhum controle de edição de cliente, pedido ou visita nesta feature.
- Após a última tarefa, sincronizar `app/www/index.html` via `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1` (executado no diretório raiz do projeto, PowerShell nativo — não Bash).
- Testes rodam com `node tests/<arquivo>.test.js` (sem `npm test`).

---

### Task 1: Aba "Clientes" — nav, página de busca e listagem client-side

**Files:**
- Modify: `index.html:1351-1352` (menu mobile — inserir botão entre Visitas e Pedidos)
- Modify: `index.html:1365-1366` (menu desktop — inserir botão entre Visitas e Pedidos)
- Modify: `index.html:1540` (inserir novo `<div class="page" id="gClientes">` antes da página `gPedidos`)
- Modify: `index.html:362` (CSS — inserir bloco de estilos usados pela ficha, após `.empty-icon`)
- Modify: `index.html:2511-2529` (função `mudarAbaG` — adicionar case `'clientes'`)
- Modify: `index.html` (adicionar função `renderBuscaClientesGestor()` perto de `renderClientes` / `ultimaVisitaCliente`, ex.: logo após `function nomeCoordenadorPedido` em `index.html:2559-2563`)
- Test: `tests/clientes-busca-gestor.test.js`

**Interfaces:**
- Consumes: `clientesGestor` (array, já populado por `carregarGestor()` em `index.html:4732`), `normalizarTexto(valor)` (`index.html:2704`), `carregarGestor()` (`index.html:4711`).
- Produces: `renderBuscaClientesGestor()` (lê `#gClientesBusca`, escreve `#gClientesResultados`), `abrirFichaClienteGestor(id)` (chamada pelas linhas da tabela de resultados — implementada na Task 2, mas referenciada aqui no `onclick`).

- [ ] **Step 1: Escrever o teste (vai falhar)**

Criar `tests/clientes-busca-gestor.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('data-gestor-page="clientes"'), 'gestor deve ter aba Clientes no menu');
assert.ok(html.includes('id="gClientes"'), 'deve existir pagina de clientes do gestor');
assert.ok(html.includes('id="gClientesBusca"'), 'deve existir campo de busca de clientes');
assert.ok(html.includes('id="gClientesResultados"'), 'deve existir container de resultados da busca');
assert.ok(html.includes('function renderBuscaClientesGestor'), 'deve existir renderizacao da busca de clientes');
assert.ok(/aba === 'clientes'/.test(html), 'mudarAbaG deve tratar a aba clientes');

console.log('clientes-busca-gestor.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `node tests/clientes-busca-gestor.test.js`
Expected: `AssertionError` (nenhuma das strings existe ainda).

- [ ] **Step 3: Inserir os botões de navegação**

No menu mobile, em `index.html`, localizar (por volta da linha 1351):

```html
    <button class="nav-btn" data-gestor-page="visitas" onclick="mudarAbaG('visitas'); alternarMenuMobile('G', false)">Visitas</button>
    <button class="nav-btn" data-gestor-page="pedidos" onclick="mudarAbaG('pedidos'); alternarMenuMobile('G', false)">Pedidos</button>
```

Substituir por:

```html
    <button class="nav-btn" data-gestor-page="visitas" onclick="mudarAbaG('visitas'); alternarMenuMobile('G', false)">Visitas</button>
    <button class="nav-btn" data-gestor-page="clientes" onclick="mudarAbaG('clientes'); alternarMenuMobile('G', false)">Clientes</button>
    <button class="nav-btn" data-gestor-page="pedidos" onclick="mudarAbaG('pedidos'); alternarMenuMobile('G', false)">Pedidos</button>
```

No menu desktop (por volta da linha 1365, sem o `alternarMenuMobile`), localizar:

```html
    <button class="nav-btn" data-gestor-page="visitas" onclick="mudarAbaG('visitas')">Visitas</button>
    <button class="nav-btn" data-gestor-page="pedidos" onclick="mudarAbaG('pedidos')">Pedidos</button>
```

Substituir por:

```html
    <button class="nav-btn" data-gestor-page="visitas" onclick="mudarAbaG('visitas')">Visitas</button>
    <button class="nav-btn" data-gestor-page="clientes" onclick="mudarAbaG('clientes')">Clientes</button>
    <button class="nav-btn" data-gestor-page="pedidos" onclick="mudarAbaG('pedidos')">Pedidos</button>
```

- [ ] **Step 4: Inserir a página de busca**

Localizar (por volta da linha 1540):

```html
  <div class="page pedidos-page" id="gPedidos">
```

Inserir imediatamente antes dessa linha:

```html
  <div class="page" id="gClientes">
    <div class="page-intro"><h1>Clientes</h1><p>Pesquise um cliente para ver dados, pedidos e visitas.</p></div>
    <div class="gestor-wrap">
      <div id="clientesBuscaView">
        <input type="text" class="busca-input" id="gClientesBusca" oninput="renderBuscaClientesGestor()" placeholder="Buscar por nome ou CNPJ...">
        <div id="gClientesResultados"></div>
      </div>
      <div id="clientesFichaView" style="display:none;"></div>
    </div>
  </div>

```

(A `clientesFichaView` fica vazia por enquanto — seu conteúdo é preenchido na Task 2.)

- [ ] **Step 5: Inserir CSS de apoio**

Localizar (por volta da linha 362):

```css
.empty-icon { font-size: 44px; margin-bottom: 10px; }
```

Inserir logo depois:

```css
.empty-icon { font-size: 44px; margin-bottom: 10px; }

/* FICHA DE CLIENTE */
.ficha-subtabs { display: flex; gap: 8px; margin: 16px 0; border-bottom: 1px solid var(--border); }
.ficha-subtab-btn { background: none; border: none; padding: 10px 4px; font-size: 13px; font-weight: 700; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; }
.ficha-subtab-btn.active { color: var(--purple); border-bottom-color: var(--purple); }
.ficha-subpage { display: none; }
.ficha-subpage.active { display: block; }
```

(Nota: a linha antiga `.empty-icon { ... }` continua existindo uma única vez — o passo acima apenas mostra o texto de ancoragem antes de inserir; não duplicar essa linha ao editar.)

- [ ] **Step 6: Implementar `renderBuscaClientesGestor` e o case `'clientes'` em `mudarAbaG`**

Em `index.html`, localizar a função `nomeCoordenadorPedido` (por volta da linha 2559):

```js
function nomeCoordenadorPedido(usuario) {
  if (!usuario) return 'Sem coordenador';
  const p = promotoresAdmin.find(x => x.usuario === usuario);
  return p?.nome || usuario;
}
```

Inserir logo depois:

```js

function renderBuscaClientesGestor() {
  const termo = normalizarTexto(document.getElementById('gClientesBusca').value.trim());
  const el = document.getElementById('gClientesResultados');
  if (!termo) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><div>Digite um nome ou CNPJ para buscar</div></div>'; return; }
  const termoDigitos = termo.replace(/\D/g, '');
  const resultados = clientesGestor.filter(c => {
    const cnpjDigitos = String(c.cnpj || '').replace(/\D/g, '');
    return normalizarTexto(c.nome_fantasia).includes(termo) || (termoDigitos && cnpjDigitos.includes(termoDigitos));
  }).slice(0, 50);
  if (!resultados.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🏪</div><div>Nenhum cliente encontrado</div></div>'; return; }
  el.innerHTML = `<table class="data-table"><thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Promotor</th></tr></thead><tbody>${resultados.map(c => `<tr onclick="abrirFichaClienteGestor('${c.id}')"><td><strong>${c.nome_fantasia}</strong></td><td>${[c.cidade, c.uf].filter(Boolean).join('/') || '—'}</td><td>${c.promotor || '—'}</td></tr>`).join('')}</tbody></table>`;
}
```

Em seguida, localizar em `mudarAbaG` (por volta da linha 2522):

```js
  if (aba === 'pedidos') { renderPedidos('G'); if (!visitasGestor.length) carregarGestor().then(() => renderPedidos('G')); }
```

Inserir logo antes dessa linha:

```js
  if (aba === 'clientes') {
    document.getElementById('clientesFichaView').style.display = 'none';
    document.getElementById('clientesBuscaView').style.display = 'block';
    if (!clientesGestor.length) carregarGestor().then(() => renderBuscaClientesGestor());
    else renderBuscaClientesGestor();
  }
```

- [ ] **Step 7: Rodar o teste e confirmar sucesso**

Run: `node tests/clientes-busca-gestor.test.js`
Expected: `clientes-busca-gestor.test.js passou`

- [ ] **Step 8: Commit**

```bash
git add index.html tests/clientes-busca-gestor.test.js
git commit -m "feat: aba Clientes no gestor com busca por nome/CNPJ"
```

---

### Task 2: Ficha do cliente — container, abrir/fechar e navegação entre sub-abas

**Files:**
- Modify: `index.html` (preencher `#clientesFichaView`, criado vazio na Task 1)
- Modify: `index.html` (adicionar `abrirFichaClienteGestor`, `fecharFichaClienteGestor`, `mudarSubAbaFichaCliente` — logo após `renderBuscaClientesGestor`, criada na Task 1)
- Test: `tests/clientes-ficha-navegacao.test.js`

**Interfaces:**
- Consumes: `clientesGestor`, `visitasGestor`, `clienteMatchesVisita(cliente, visita)` (`index.html:4456`), `renderBuscaClientesGestor()` (Task 1).
- Produces: `let fichaClienteAtual = null;`, `let fichaClienteVisitas = [];` (variáveis globais lidas pela Task 3), `abrirFichaClienteGestor(id)`, `fecharFichaClienteGestor()`, `mudarSubAbaFichaCliente(aba)` (aceita `'resumo' | 'pedidos' | 'visitas'`).

- [ ] **Step 1: Escrever o teste (vai falhar)**

Criar `tests/clientes-ficha-navegacao.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function abrirFichaClienteGestor'), 'deve existir funcao para abrir a ficha do cliente');
assert.ok(html.includes('function fecharFichaClienteGestor'), 'deve existir funcao para fechar a ficha e voltar a busca');
assert.ok(html.includes('function mudarSubAbaFichaCliente'), 'deve existir navegacao entre sub-abas da ficha');
assert.ok(html.includes('data-ficha-subtab="resumo"'), 'ficha deve ter sub-aba Resumo');
assert.ok(html.includes('data-ficha-subtab="pedidos"'), 'ficha deve ter sub-aba Pedidos');
assert.ok(html.includes('data-ficha-subtab="visitas"'), 'ficha deve ter sub-aba Visitas');
assert.ok(html.includes('id="fichaSubpageResumo"'), 'deve existir container da sub-aba Resumo');
assert.ok(html.includes('id="fichaSubpagePedidos"'), 'deve existir container da sub-aba Pedidos');
assert.ok(html.includes('id="fichaSubpageVisitas"'), 'deve existir container da sub-aba Visitas');
assert.ok(html.includes('clienteMatchesVisita(cliente, v)') || html.includes('clienteMatchesVisita(fichaClienteAtual, v)'), 'ficha deve casar visitas com o cliente via clienteMatchesVisita');

console.log('clientes-ficha-navegacao.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `node tests/clientes-ficha-navegacao.test.js`
Expected: `AssertionError`

- [ ] **Step 3: Preencher o container `clientesFichaView`**

Em `index.html`, localizar (criado na Task 1):

```html
      <div id="clientesFichaView" style="display:none;"></div>
```

Substituir por:

```html
      <div id="clientesFichaView" style="display:none;">
        <button class="btn-detalhes" type="button" onclick="fecharFichaClienteGestor()">← Voltar à busca</button>
        <div class="ficha-subtabs">
          <button class="ficha-subtab-btn active" type="button" data-ficha-subtab="resumo" onclick="mudarSubAbaFichaCliente('resumo')">Resumo</button>
          <button class="ficha-subtab-btn" type="button" data-ficha-subtab="pedidos" onclick="mudarSubAbaFichaCliente('pedidos')">Pedidos</button>
          <button class="ficha-subtab-btn" type="button" data-ficha-subtab="visitas" onclick="mudarSubAbaFichaCliente('visitas')">Visitas</button>
        </div>
        <div class="ficha-subpage active" id="fichaSubpageResumo"></div>
        <div class="ficha-subpage" id="fichaSubpagePedidos"></div>
        <div class="ficha-subpage" id="fichaSubpageVisitas"></div>
      </div>
```

- [ ] **Step 4: Declarar estado global da ficha**

Em `index.html`, localizar (por volta da linha 1830):

```js
let clientesGestor = [];
```

Inserir logo depois:

```js
let clientesGestor = [];
let fichaClienteAtual = null;
let fichaClienteVisitas = [];
```

- [ ] **Step 5: Implementar abrir/fechar e navegação de sub-aba**

Em `index.html`, localizar a função `renderBuscaClientesGestor` criada na Task 1 e inserir logo depois:

```js

function abrirFichaClienteGestor(id) {
  const cliente = clientesGestor.find(c => String(c.id) === String(id));
  if (!cliente) { toast('Cliente não encontrado'); return; }
  fichaClienteAtual = cliente;
  fichaClienteVisitas = visitasGestor.filter(v => clienteMatchesVisita(cliente, v)).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  document.getElementById('clientesBuscaView').style.display = 'none';
  document.getElementById('clientesFichaView').style.display = 'block';
  mudarSubAbaFichaCliente('resumo');
}

function fecharFichaClienteGestor() {
  fichaClienteAtual = null;
  fichaClienteVisitas = [];
  document.getElementById('clientesFichaView').style.display = 'none';
  document.getElementById('clientesBuscaView').style.display = 'block';
}

function mudarSubAbaFichaCliente(aba) {
  document.querySelectorAll('.ficha-subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ficha-subpage').forEach(p => p.classList.remove('active'));
  document.querySelector(`.ficha-subtab-btn[data-ficha-subtab="${aba}"]`).classList.add('active');
  const idPage = 'fichaSubpage' + aba.charAt(0).toUpperCase() + aba.slice(1);
  document.getElementById(idPage).classList.add('active');
  if (aba === 'resumo') renderFichaResumo();
  if (aba === 'pedidos') renderFichaPedidos();
  if (aba === 'visitas') renderFichaVisitas();
}
```

(`renderFichaResumo`, `renderFichaPedidos` e `renderFichaVisitas` ainda não existem — serão criadas na Task 3. Isso é esperado; a Task 2 só precisa passar no seu próprio teste, que verifica strings estáticas do HTML/JS, não execução.)

- [ ] **Step 6: Rodar o teste e confirmar sucesso**

Run: `node tests/clientes-ficha-navegacao.test.js`
Expected: `clientes-ficha-navegacao.test.js passou`

- [ ] **Step 7: Commit**

```bash
git add index.html tests/clientes-ficha-navegacao.test.js
git commit -m "feat: abrir/fechar ficha do cliente com sub-abas no gestor"
```

---

### Task 3: Conteúdo das sub-abas Resumo, Pedidos e Visitas

**Files:**
- Modify: `index.html` (adicionar `renderFichaResumo`, `renderFichaPedidos`, `renderFichaVisitas`, logo após `mudarSubAbaFichaCliente`, criada na Task 2)
- Test: `tests/clientes-ficha-conteudo.test.js`

**Interfaces:**
- Consumes: `fichaClienteAtual`, `fichaClienteVisitas` (Task 2), `valorPedido(v)`, `pacotesPedido(v)`, `textoProdutosPedido(v)` (`index.html:2535-2552`), `statusDaVisita(v)`, `statusClass(status)` (`index.html:2731,2739`), `abrirDetalheGestor(id)` (`index.html:6417`).
- Produces: `renderFichaResumo()`, `renderFichaPedidos()`, `renderFichaVisitas()` — todas leem `fichaClienteAtual`/`fichaClienteVisitas` e escrevem em `#fichaSubpageResumo`/`#fichaSubpagePedidos`/`#fichaSubpageVisitas` respectivamente. Nenhum retorno usado por outra task.

- [ ] **Step 1: Escrever o teste (vai falhar)**

Criar `tests/clientes-ficha-conteudo.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function renderFichaResumo'), 'deve existir renderizacao do resumo do cliente');
assert.ok(html.includes('function renderFichaPedidos'), 'deve existir renderizacao dos pedidos do cliente');
assert.ok(html.includes('function renderFichaVisitas'), 'deve existir renderizacao das visitas do cliente');
assert.ok(/Total de visitas/.test(html), 'resumo deve mostrar total de visitas');
assert.ok(/Total de pedidos/.test(html), 'resumo deve mostrar total de pedidos');
assert.ok(/Valor total comprado/.test(html), 'resumo deve mostrar valor total comprado');
assert.ok(/Pacotes totais/.test(html), 'resumo deve mostrar pacotes totais');
assert.ok(/M.dia entre visitas/.test(html), 'resumo deve mostrar media de dias entre visitas');
assert.ok(/.ltima visita/.test(html), 'resumo deve mostrar data da ultima visita');
assert.ok(/.ltimo pedido/.test(html), 'resumo deve mostrar data do ultimo pedido');
assert.ok(/renderFichaPedidos[\s\S]{0,600}abrirDetalheGestor/.test(html), 'linhas de pedidos da ficha devem abrir o modal de detalhe existente');
assert.ok(/renderFichaVisitas[\s\S]{0,600}abrirDetalheGestor/.test(html), 'linhas de visitas da ficha devem abrir o modal de detalhe existente');

console.log('clientes-ficha-conteudo.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `node tests/clientes-ficha-conteudo.test.js`
Expected: `AssertionError`

- [ ] **Step 3: Implementar `renderFichaResumo`, `renderFichaPedidos` e `renderFichaVisitas`**

Em `index.html`, localizar o final da função `mudarSubAbaFichaCliente` (criada na Task 2):

```js
  if (aba === 'resumo') renderFichaResumo();
  if (aba === 'pedidos') renderFichaPedidos();
  if (aba === 'visitas') renderFichaVisitas();
}
```

Inserir logo depois (fora da função):

```js

function renderFichaResumo() {
  const c = fichaClienteAtual;
  const visitas = fichaClienteVisitas;
  const pedidos = visitas.filter(v => v.dados?.comercial?.pedidoFeito === 'Sim');
  const valorTotal = pedidos.reduce((sum, v) => sum + valorPedido(v), 0);
  const pacotesTotal = pedidos.reduce((sum, v) => sum + pacotesPedido(v), 0);
  const ultimaVisita = visitas[0] || null;
  const ultimoPedido = pedidos[0] || null;
  let mediaDias = '—';
  if (visitas.length > 1) {
    const datas = visitas.map(v => new Date(v.criado_em).getTime()).sort((a, b) => a - b);
    const intervalos = [];
    for (let i = 1; i < datas.length; i++) intervalos.push((datas[i] - datas[i - 1]) / 86400000);
    mediaDias = Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length) + ' dias';
  }
  document.getElementById('fichaSubpageResumo').innerHTML = `
    <div class="rel-section">
      <div class="rel-title">Dados cadastrais</div>
      <div class="rel-row"><span class="rel-key">Código</span><span class="rel-val">${c.codigo || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">CNPJ</span><span class="rel-val">${c.cnpj || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Tipo</span><span class="rel-val">${c.tipo || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">IE</span><span class="rel-val">${c.ie || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Endereço</span><span class="rel-val">${c.endereco || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Cidade/UF</span><span class="rel-val">${[c.cidade, c.uf].filter(Boolean).join('/') || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Comprador</span><span class="rel-val">${c.nome_comprador || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Telefone</span><span class="rel-val">${c.telefone || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Distribuidor</span><span class="rel-val">${c.distribuidor || '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Promotor</span><span class="rel-val">${c.promotor || '—'}</span></div>
    </div>
    <div class="rel-section">
      <div class="rel-title">Indicadores</div>
      <div class="rel-row"><span class="rel-key">Total de visitas</span><span class="rel-val">${visitas.length}</span></div>
      <div class="rel-row"><span class="rel-key">Total de pedidos</span><span class="rel-val">${pedidos.length}</span></div>
      <div class="rel-row"><span class="rel-key">Valor total comprado</span><span class="rel-val">${valorTotal ? valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Pacotes totais</span><span class="rel-val">${pacotesTotal.toLocaleString('pt-BR')}</span></div>
      <div class="rel-row"><span class="rel-key">Média entre visitas</span><span class="rel-val">${mediaDias}</span></div>
      <div class="rel-row"><span class="rel-key">Última visita</span><span class="rel-val">${ultimaVisita ? new Date(ultimaVisita.criado_em).toLocaleDateString('pt-BR') : '—'}</span></div>
      <div class="rel-row"><span class="rel-key">Último pedido</span><span class="rel-val">${ultimoPedido ? new Date(ultimoPedido.criado_em).toLocaleDateString('pt-BR') : '—'}</span></div>
    </div>
  `;
}

function renderFichaPedidos() {
  const pedidos = fichaClienteVisitas.filter(v => v.dados?.comercial?.pedidoFeito === 'Sim');
  const el = document.getElementById('fichaSubpagePedidos');
  if (!pedidos.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div>Nenhum pedido encontrado</div></div>'; return; }
  el.innerHTML = `<table class="data-table"><thead><tr><th>Data</th><th>Status</th><th>Produtos</th><th>Pacotes</th><th>Valor</th></tr></thead><tbody>${pedidos.map(v => {
    const data = new Date(v.criado_em).toLocaleDateString('pt-BR') + ' às ' + new Date(v.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const status = statusDaVisita(v);
    const val = valorPedido(v);
    return `<tr onclick="abrirDetalheGestor('${v.id}')"><td>${data}</td><td><span class="status-chip ${statusClass(status)}">${status}</span></td><td>${textoProdutosPedido(v)}</td><td>${pacotesPedido(v).toLocaleString('pt-BR')}</td><td>${val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function renderFichaVisitas() {
  const visitas = fichaClienteVisitas;
  const el = document.getElementById('fichaSubpageVisitas');
  if (!visitas.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div>Nenhuma visita encontrada</div></div>'; return; }
  el.innerHTML = `<table class="data-table"><thead><tr><th>Data</th><th>Promotor</th><th>Pedido</th></tr></thead><tbody>${visitas.map(v => {
    const data = new Date(v.criado_em).toLocaleDateString('pt-BR') + ' às ' + new Date(v.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<tr onclick="abrirDetalheGestor('${v.id}')"><td>${data}</td><td>${v.promotor || '—'}</td><td>${v.dados?.comercial?.pedidoFeito === 'Sim' ? 'Sim' : 'Não'}</td></tr>`;
  }).join('')}</tbody></table>`;
}
```

- [ ] **Step 4: Rodar o teste e confirmar sucesso**

Run: `node tests/clientes-ficha-conteudo.test.js`
Expected: `clientes-ficha-conteudo.test.js passou`

- [ ] **Step 5: Commit**

```bash
git add index.html tests/clientes-ficha-conteudo.test.js
git commit -m "feat: sub-abas Resumo, Pedidos e Visitas na ficha do cliente"
```

---

### Task 4: Sincronizar app/www, rodar a suíte completa e revisão final

**Files:**
- Modify: `app/www/index.html` (gerado pelo script de sync, não editar manualmente)
- Test: suíte completa em `tests/*.test.js`

**Interfaces:**
- Consumes: todas as mudanças das Tasks 1–3.
- Produces: nenhuma interface nova — task de fechamento.

- [ ] **Step 1: Rodar o script de sincronização**

No diretório raiz do projeto, em PowerShell nativo (não Bash):

```powershell
powershell -ExecutionPolicy Bypass -File app\sync-web.ps1
```

Expected: script conclui sem erro e `app/www/index.html` é atualizado com o mesmo conteúdo de `index.html`.

- [ ] **Step 2: Rodar a suíte de testes completa**

```bash
for f in tests/*.test.js; do node "$f" || echo "FALHOU: $f"; done
```

Expected: todas as linhas terminam com "passou"; nenhuma linha "FALHOU".

- [ ] **Step 3: Verificação manual rápida no navegador (opcional mas recomendado)**

Abrir `index.html` localmente (ou via ambiente de desenvolvimento já usado no projeto), logar como gestor, abrir a aba **Clientes**, buscar um cliente existente, abrir a ficha, navegar pelas 3 sub-abas e clicar em uma linha de Pedidos e de Visitas para confirmar que o modal de detalhe (com fotos) abre normalmente.

- [ ] **Step 4: Commit final (se `app/www/index.html` tiver diffs pendentes do sync)**

```bash
git add app/www/index.html
git commit -m "chore: sincroniza app/www/index.html com a aba Clientes do gestor"
```

(Se o sync não gerar diffs — por exemplo, se já estava incluído nos commits anteriores — pular este passo.)
