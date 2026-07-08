# Redesenho do card de metas + meio pacote no pedido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o card de metas da tela inicial do promotor mais legível/visual, e permitir vender meio pacote (0,5) de cada SKU no pedido da visita.

**Architecture:** Ambas as mudanças ficam inteiramente em `index.html` (CSS inline no `<style>` do topo + funções JS inline). Não há mudança de schema de banco, endpoint novo, ou dependência nova. Segue o padrão de testes já usado no repo: scripts Node avulsos em `tests/*.test.js` que leem `index.html` como texto e fazem `assert.ok(html.includes(...))`.

**Tech Stack:** HTML/CSS/JS vanilla (sem build), Node puro para os testes.

## Global Constraints

- Sem build step — tudo é editado direto em `index.html`.
- Testes rodam com `node tests/<arquivo>.test.js` (sem framework); para rodar tudo: `for f in tests/*.test.js; do node "$f"; done`.
- Não duplicar lógica de negócio dentro de `index.html` que já exista em `bonus.js`/`performance.js` — aqui não se aplica pois as mudanças são de UI/parsing de formulário, não de regra de bonificação.
- Manter compatibilidade com registros antigos de `pedidoPac`/`pedidoQty` já salvos no banco (não requer migração: valores fracionários são JSON números normais).

---

## Task 1: Meio pacote no pedido da visita

**Files:**
- Modify: `index.html:929-1000` (8 botões `onclick="alterarQty(...)"`, um par −/+ por SKU: GR, GM, CM, CC)
- Modify: `index.html:1908-1934` (`alterarQty`, `calcularTotalPedido`)
- Modify: `index.html:2338-2342` (montagem de `pedidoPac` em `salvarVisita`)
- Test: `tests/pedido-meio-pacote.test.js`

**Interfaces:**
- Produces: `function lerQtyPac(id)` — lê o texto de um elemento `.qty-val` (ex.: `"1,5"`) e retorna um `Number` (ex.: `1.5`). Usada por `calcularTotalPedido()` e por `salvarVisita()`.
- Produces: `alterarQty(id, delta)` continua com a mesma assinatura, mas `delta` agora é chamado com `0.5`/`-0.5` pelos botões (antes era `1`/`-1`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/pedido-meio-pacote.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

['GR', 'GM', 'CM', 'CC'].forEach(sku => {
  assert.ok(
    html.includes(`onclick="alterarQty('qty${sku}',-0.5)"`),
    `botao de menos do ${sku} deve decrementar 0.5`
  );
  assert.ok(
    html.includes(`onclick="alterarQty('qty${sku}',0.5)"`),
    `botao de mais do ${sku} deve incrementar 0.5`
  );
});

assert.ok(
  html.includes('function lerQtyPac(id)'),
  'deve existir o helper lerQtyPac para parsear quantidade com virgula decimal'
);
assert.ok(
  !/parseInt\(document\.getElementById\('qty/.test(html),
  'leitura de quantidade de pacote nao deve mais usar parseInt'
);

console.log('pedido-meio-pacote.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/pedido-meio-pacote.test.js`
Expected: `AssertionError` na primeira asserção (`onclick="alterarQty('qtyGR',-0.5)"` ainda não existe).

- [ ] **Step 3: Trocar o delta dos 8 botões de −1/+1 para −0,5/+0,5**

Em `index.html`, para cada um dos 4 SKUs (`GR`, `GM`, `CM`, `CC`), trocar o par de botões. Exemplo do GR (linhas 929 e 934 hoje):

```html
<!-- antes -->
<button class="qty-btn" onclick="alterarQty('qtyGR',-1)">−</button>
...
<button class="qty-btn" onclick="alterarQty('qtyGR',1)">+</button>
```

```html
<!-- depois -->
<button class="qty-btn" onclick="alterarQty('qtyGR',-0.5)">−</button>
...
<button class="qty-btn" onclick="alterarQty('qtyGR',0.5)">+</button>
```

Repetir exatamente o mesmo padrão (trocar `-1`→`-0.5` e `1`→`0.5`) para `qtyGM`, `qtyCM`, `qtyCC`.

- [ ] **Step 4: Reescrever `alterarQty` e adicionar `lerQtyPac`**

Substituir (hoje em `index.html:1908`):

```js
function alterarQty(id, delta) {
  const el = document.getElementById(id);
  el.textContent = Math.max(0, parseInt(el.textContent) + delta);
  calcularTotalPedido();
}
```

Por:

```js
function lerQtyPac(id) {
  const el = document.getElementById(id);
  const texto = (el?.textContent || '0').replace(',', '.');
  return parseFloat(texto) || 0;
}

function alterarQty(id, delta) {
  const el = document.getElementById(id);
  const novo = Math.max(0, lerQtyPac(id) + delta);
  el.textContent = novo.toString().replace('.', ',');
  calcularTotalPedido();
}
```

- [ ] **Step 5: Atualizar `calcularTotalPedido` para usar `lerQtyPac` e formatar o resto em pt-BR**

Substituir (hoje em `index.html:1916-1934`):

```js
function calcularTotalPedido() {
  let total = 0;
  ['GR','GM','CM','CC'].forEach(s => {
    const pac = parseInt(document.getElementById('qty'+s)?.textContent||'0');
    const preco = parseFloat(document.getElementById('preco'+s)?.value||'0');
    const subtotal = pac * preco;
    total += subtotal;
    // Mostrar caixas equivalentes
    const cx = Math.floor(pac / PACOTES[s]);
    const resto = pac % PACOTES[s];
    const elCx = document.getElementById('cx'+s);
    if (elCx) elCx.textContent = cx > 0 ? `${cx} cx${resto > 0 ? ' + '+resto+' pac' : ''}` : resto > 0 ? resto+' pac (< 1 cx)' : '0 cx';
    // Mostrar subtotal
    const elTotal = document.getElementById('total'+s);
    if (elTotal) elTotal.textContent = pac > 0 && preco > 0 ? `= R$ ${subtotal.toFixed(2)}` : '';
  });
  const elTotal = document.getElementById('totalPedido');
  if (elTotal) elTotal.textContent = `R$ ${total.toFixed(2)}`;
}
```

Por:

```js
function calcularTotalPedido() {
  let total = 0;
  ['GR','GM','CM','CC'].forEach(s => {
    const pac = lerQtyPac('qty'+s);
    const preco = parseFloat(document.getElementById('preco'+s)?.value||'0');
    const subtotal = pac * preco;
    total += subtotal;
    // Mostrar caixas equivalentes
    const cx = Math.floor(pac / PACOTES[s]);
    const resto = (pac % PACOTES[s]).toString().replace('.', ',');
    const elCx = document.getElementById('cx'+s);
    if (elCx) elCx.textContent = cx > 0 ? `${cx} cx${pac % PACOTES[s] > 0 ? ' + '+resto+' pac' : ''}` : pac % PACOTES[s] > 0 ? resto+' pac (< 1 cx)' : '0 cx';
    // Mostrar subtotal
    const elTotal = document.getElementById('total'+s);
    if (elTotal) elTotal.textContent = pac > 0 && preco > 0 ? `= R$ ${subtotal.toFixed(2)}` : '';
  });
  const elTotal = document.getElementById('totalPedido');
  if (elTotal) elTotal.textContent = `R$ ${total.toFixed(2)}`;
}
```

- [ ] **Step 6: Atualizar a montagem de `pedidoPac` em `salvarVisita`**

Substituir (hoje em `index.html:2338-2342`):

```js
      pedidoPac: {
        GR: parseInt(document.getElementById('qtyGR').textContent),
        GM: parseInt(document.getElementById('qtyGM').textContent),
        CM: parseInt(document.getElementById('qtyCM').textContent),
        CC: parseInt(document.getElementById('qtyCC').textContent),
      },
```

Por:

```js
      pedidoPac: {
        GR: lerQtyPac('qtyGR'),
        GM: lerQtyPac('qtyGM'),
        CM: lerQtyPac('qtyCM'),
        CC: lerQtyPac('qtyCC'),
      },
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `node tests/pedido-meio-pacote.test.js`
Expected: `pedido-meio-pacote.test.js passou`

- [ ] **Step 8: Rodar a suíte completa para garantir que nada quebrou**

Run: `for f in tests/*.test.js; do node "$f" || echo "FALHOU: $f"; done`
Expected: todas as linhas terminam em "passou", nenhuma linha "FALHOU".

- [ ] **Step 9: Commit**

```bash
git add index.html tests/pedido-meio-pacote.test.js
git commit -m "feat: permite meio pacote no pedido da visita"
```

---

## Task 2: Redesenho visual do card de metas

**Files:**
- Modify: `index.html:596-601` (CSS `.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-sub`)
- Modify: `index.html:3064-3082` (`renderPainelPromotor`)
- Test: `tests/painel-metas-visual.test.js`

**Interfaces:**
- Consumes: `perf.cards` — objeto vindo de `calcularPerformancePromotor` (`performance.js`), com chaves `bonus_pdv_venda`, `tabela_percentual`, `base_ou_cobertura`, cada uma com `{ label, atual, alvo, sufixo, atingida, pct, faltam, moeda?, valorAtual?, valorAlvo? }`. Essas chaves e formato **não mudam** nesta task.
- Produces: nenhuma interface nova consumida por outro código — é folha da árvore (só renderiza).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/painel-metas-visual.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('.kpi-status-pill'), 'CSS deve definir o badge de status do card de metas');
assert.ok(html.includes('.kpi-icon'), 'CSS deve definir o icone do card de metas');
assert.ok(html.includes('.kpi-bar-fill'), 'CSS deve definir a barra de progresso nova');
assert.ok(html.includes("bonus_pdv_venda: '💰'"), 'deve mapear icone do card de bonus de PDV');
assert.ok(html.includes("tabela_percentual: '📊'"), 'deve mapear icone do card de % de tabela');
assert.ok(html.includes("base_ou_cobertura: '🏪'"), 'deve mapear icone do card de base/cobertura');
assert.ok(html.includes('kpi-status-pill'), 'template do card deve usar a classe do badge de status');
assert.ok(!html.includes('height:6px;background:#EEF1F7'), 'barra de progresso antiga em linha deve ser removida do template');

console.log('painel-metas-visual.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/painel-metas-visual.test.js`
Expected: `AssertionError` na primeira asserção (`.kpi-status-pill` ainda não existe).

- [ ] **Step 3: Atualizar o CSS do card**

Substituir (hoje em `index.html:596-601`):

```css
.kpi-card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.kpi-card.green { border-color: var(--mint); background: var(--mint-light); }
.kpi-card.orange { border-color: #F4C36A; background: var(--orange-light); }
.kpi-label { font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.kpi-value { margin-top: 8px; font-size: 24px; line-height: 1.1; font-weight: 900; color: var(--text); }
.kpi-sub { margin-top: 5px; font-size: 12px; color: var(--text-muted); font-weight: 700; }
```

Por:

```css
.kpi-card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.kpi-card.green { border-color: var(--mint); background: var(--mint-light); }
.kpi-card.orange { border-color: #F4C36A; background: var(--orange-light); }
.kpi-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.kpi-icon { font-size: 20px; line-height: 1; }
.kpi-status-pill { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.kpi-status-pill.ok { background: var(--mint); color: #fff; }
.kpi-status-pill.pendente { background: #F4C36A; color: #6b4a06; }
.kpi-label { font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.kpi-value { margin-top: 8px; font-size: 28px; line-height: 1.1; font-weight: 900; color: var(--text); }
.kpi-alvo { font-size: 13px; color: var(--text-muted); font-weight: 700; }
.kpi-sub { margin-top: 5px; font-size: 12px; color: var(--text-muted); font-weight: 700; }
.kpi-bar { height: 10px; background: #EEF1F7; border-radius: 999px; margin-top: 10px; overflow: hidden; }
.kpi-bar-fill { height: 100%; border-radius: 999px; background: var(--amber); }
.kpi-card.green .kpi-bar-fill { background: var(--mint); }
```

- [ ] **Step 4: Atualizar `renderPainelPromotor`**

Substituir (hoje em `index.html:3064-3082`):

```js
function renderPainelPromotor() {
  const cardsEl = document.getElementById('pPerformanceCards');
  const acoesEl = document.getElementById('pPerformanceAcoes');
  if (!cardsEl || !acoesEl || typeof calcularPerformancePromotor !== 'function') return;
  const perf = calcularPerformancePromotor({ promotor: usuarioAtual, visitas: visitasPromotor, clientes: todosClientes, metas: metasSistema });
  const cards = Object.values(perf.cards);
  cardsEl.innerHTML = cards.map(c => `
    <div class="kpi-card ${c.atingida ? 'green' : 'orange'}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.atual}${c.sufixo || ''} <span style="font-size:13px;color:var(--text-muted);">/ ${c.alvo}${c.sufixo || ''}</span></div>
      ${c.moeda ? `<div class="kpi-sub">Bônus: R$ ${Number(c.valorAtual || 0).toLocaleString('pt-BR',{minimumFractionDigits:2})} / R$ ${Number(c.valorAlvo || 0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>` : ''}
      <div class="kpi-sub">${c.atingida ? 'Meta batida' : (c.sufixo === '%' ? 'Faltam ' + c.faltam + ' pontos' : 'Faltam ' + c.faltam)}</div>
      <div style="height:6px;background:#EEF1F7;border-radius:999px;margin-top:8px;overflow:hidden;"><div style="height:100%;width:${c.pct}%;background:${c.atingida?'var(--mint)':'var(--amber)'};"></div></div>
    </div>
  `).join('');
  acoesEl.innerHTML = perf.proximosPassos.length
    ? perf.proximosPassos.map(a => `<div class="visit-summary-item"><span>${a}</span></div>`).join('')
    : '<div class="empty">Todas as metas principais estão batidas neste mês.</div>';
}
```

Por:

```js
const KPI_ICONES = { bonus_pdv_venda: '💰', tabela_percentual: '📊', base_ou_cobertura: '🏪' };

function renderPainelPromotor() {
  const cardsEl = document.getElementById('pPerformanceCards');
  const acoesEl = document.getElementById('pPerformanceAcoes');
  if (!cardsEl || !acoesEl || typeof calcularPerformancePromotor !== 'function') return;
  const perf = calcularPerformancePromotor({ promotor: usuarioAtual, visitas: visitasPromotor, clientes: todosClientes, metas: metasSistema });
  cardsEl.innerHTML = Object.entries(perf.cards).map(([chave, c]) => `
    <div class="kpi-card ${c.atingida ? 'green' : 'orange'}">
      <div class="kpi-card-top">
        <span class="kpi-icon">${KPI_ICONES[chave] || '📌'}</span>
        <span class="kpi-status-pill ${c.atingida ? 'ok' : 'pendente'}">${c.atingida ? 'Meta batida ✓' : 'Faltam ' + c.faltam + (c.sufixo === '%' ? ' pts' : '')}</span>
      </div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.atual}${c.sufixo || ''} <span class="kpi-alvo">/ ${c.alvo}${c.sufixo || ''}</span></div>
      ${c.moeda ? `<div class="kpi-sub">Bônus: R$ ${Number(c.valorAtual || 0).toLocaleString('pt-BR',{minimumFractionDigits:2})} / R$ ${Number(c.valorAlvo || 0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>` : ''}
      <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${c.pct}%;"></div></div>
    </div>
  `).join('');
  acoesEl.innerHTML = perf.proximosPassos.length
    ? perf.proximosPassos.map(a => `<div class="visit-summary-item"><span>${a}</span></div>`).join('')
    : '<div class="empty">Todas as metas principais estão batidas neste mês.</div>';
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `node tests/painel-metas-visual.test.js`
Expected: `painel-metas-visual.test.js passou`

- [ ] **Step 6: Rodar a suíte completa para garantir que nada quebrou**

Run: `for f in tests/*.test.js; do node "$f" || echo "FALHOU: $f"; done`
Expected: todas as linhas terminam em "passou", nenhuma linha "FALHOU".

- [ ] **Step 7: Verificação visual manual**

Abrir `index.html` no navegador (ou `vercel dev` / servidor estático local), logar como promotor, e conferir na aba "Painel":
- Os 3 cards mostram ícone + pill de status no topo.
- Card com meta batida aparece com pill verde "Meta batida ✓"; card pendente aparece com pill âmbar "Faltam N".
- A barra de progresso está mais grossa e com cantos arredondados.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/painel-metas-visual.test.js
git commit -m "feat: redesenha card de metas do painel do promotor"
```

---

## Self-Review

- **Cobertura da spec:** seção 1 (meio pacote) → Task 1; seção 2 (redesenho do card) → Task 2. Ambas as seções da spec `docs/superpowers/specs/2026-07-08-painel-promotor-metas-meio-pacote-design.md` têm task correspondente.
- **Sem placeholders:** todos os steps têm código completo e comandos exatos.
- **Consistência de tipos/nomes:** `lerQtyPac(id)` é definida na Task 1 e usada em `calcularTotalPedido` e `salvarVisita` com o mesmo nome. `KPI_ICONES` é definida e usada só dentro da Task 2, sem dependência cruzada com a Task 1.
