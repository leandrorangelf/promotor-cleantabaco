# Validacao IA Fotos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated AI photo validation test area for gestores/admins without changing the real visit submission flow.

**Architecture:** Create one serverless API route, `api/avaliar-foto.js`, that accepts a base64 image and returns a normalized JSON result. Add a contained UI section in `index.html` for uploading a test image and displaying the result. The route defaults to mock mode and only calls Gemini when `IA_VALIDACAO_REAL=true` and `GEMINI_API_KEY` are configured.

**Tech Stack:** Existing Vercel serverless functions, plain HTML/CSS/JavaScript, Node tests with `assert`, Google Gemini REST API through `fetch`.

## Global Constraints

- Do not modify `api/salvar.js`.
- Do not modify the database schema.
- Do not save AI validation results into visits.
- Do not block visit submission.
- Do not expose `GEMINI_API_KEY` in frontend code.
- Mock mode must work without any paid service or API key.
- Keep changes scoped to `api/avaliar-foto.js`, `index.html`, and focused tests.

---

### Task 1: Add Mock-First API Route

**Files:**
- Create: `api/avaliar-foto.js`
- Test: `tests/validacao-ia-api.test.js`

**Interfaces:**
- Consumes: `POST /api/avaliar-foto` with JSON body `{ foto: string }`.
- Produces: JSON `{ aprovado: boolean, score: number, modo: string, materiais_detectados: string[], pdv_detectado: boolean, qualidade_foto: string, motivo: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/validacao-ia-api.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/avaliar-foto.js', 'utf8');

assert.ok(api.includes('export default async function handler'), 'deve exportar handler serverless');
assert.ok(api.includes("req.method !== 'POST'"), 'deve aceitar somente POST');
assert.ok(api.includes('IA_VALIDACAO_REAL'), 'deve ter flag para ativar IA real');
assert.ok(api.includes('GEMINI_API_KEY'), 'deve ler chave Gemini somente no backend');
assert.ok(api.includes('modo: \\'mock\\'') || api.includes('modo: "mock"'), 'deve ter resposta mockada segura');
assert.ok(api.includes('materiais_detectados'), 'resposta deve conter materiais_detectados');
assert.ok(!api.includes('process.env.GEMINI_API_KEY ||'), 'nao deve ter fallback hardcoded para chave');

console.log('validacao-ia-api.test.js passou');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/validacao-ia-api.test.js`

Expected: FAIL because `api/avaliar-foto.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `api/avaliar-foto.js`:

```js
function respostaMock() {
  return {
    aprovado: true,
    score: 82,
    modo: 'mock',
    materiais_detectados: ['tabela_precos'],
    pdv_detectado: false,
    qualidade_foto: 'boa',
    motivo: 'Simulacao: estrutura pronta para receber analise real da IA.'
  };
}

function normalizarResultado(valor) {
  return {
    aprovado: Boolean(valor?.aprovado),
    score: Number.isFinite(Number(valor?.score)) ? Math.max(0, Math.min(100, Number(valor.score))) : 0,
    modo: valor?.modo || 'gemini',
    materiais_detectados: Array.isArray(valor?.materiais_detectados) ? valor.materiais_detectados : [],
    pdv_detectado: Boolean(valor?.pdv_detectado),
    qualidade_foto: valor?.qualidade_foto || 'nao_avaliada',
    motivo: valor?.motivo || 'Analise concluida sem motivo detalhado.'
  };
}

function extrairJson(texto) {
  const bruto = String(texto || '').trim();
  try {
    return JSON.parse(bruto);
  } catch (e) {
    const match = bruto.match(/\{[\s\S]*\}/);
    if (!match) throw e;
    return JSON.parse(match[0]);
  }
}

async function avaliarComGemini(foto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY nao configurada');

  const base64 = String(foto).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const prompt = [
    'Analise a foto enviada para validar material de marketing da Clean Tabaco ou El Poncio.',
    'Procure tabela de precos, wobler, display, cartaz, adesivo, expositor ou material similar.',
    'Modo de teste: nao reprove apenas por nao parecer um PDV real.',
    'Responda somente JSON valido com os campos:',
    'aprovado boolean, score number 0-100, materiais_detectados array de strings,',
    'pdv_detectado boolean, qualidade_foto string, motivo string.'
  ].join(' ');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } }
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao chamar Gemini');
  }

  const texto = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
  return normalizarResultado({ ...extrairJson(texto), modo: 'gemini' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });

  const { foto } = req.body || {};
  if (!foto || typeof foto !== 'string') {
    return res.status(400).json({ erro: 'Foto obrigatoria' });
  }

  try {
    if (process.env.IA_VALIDACAO_REAL !== 'true') {
      return res.status(200).json(respostaMock());
    }

    const resultado = await avaliarComGemini(foto);
    return res.status(200).json(resultado);
  } catch (e) {
    return res.status(500).json({
      erro: 'Nao foi possivel avaliar a foto agora',
      detalhe: e.message
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/validacao-ia-api.test.js`

Expected: PASS with `validacao-ia-api.test.js passou`.

- [ ] **Step 5: Commit**

```bash
git add api/avaliar-foto.js tests/validacao-ia-api.test.js
git commit -m "feat: add mock photo AI validation api"
```

### Task 2: Add Isolated Gestor Test UI

**Files:**
- Modify: `index.html`
- Test: `tests/validacao-ia-ui.test.js`

**Interfaces:**
- Consumes: `POST /api/avaliar-foto` from browser code.
- Produces: an isolated `Validacao IA` section in the gestor/admin area.

- [ ] **Step 1: Write the failing test**

Create `tests/validacao-ia-ui.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('Validacao IA') || html.includes('Validação IA'), 'deve mostrar area Validacao IA');
assert.ok(html.includes('id="iaFotoInput"'), 'deve ter input de foto para IA');
assert.ok(html.includes('function analisarFotoIA'), 'deve ter funcao analisarFotoIA');
assert.ok(html.includes('/api/avaliar-foto'), 'deve chamar a rota isolada de avaliacao');
assert.ok(html.includes('id="iaResultado"'), 'deve ter container para resultado');
assert.ok(!html.includes('GEMINI_API_KEY'), 'frontend nao deve expor GEMINI_API_KEY');

console.log('validacao-ia-ui.test.js passou');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/validacao-ia-ui.test.js`

Expected: FAIL because the UI does not exist yet.

- [ ] **Step 3: Add contained UI markup**

In the gestor/admin area of `index.html`, add a card with:

```html
<div class="card" id="iaValidacaoCard">
  <div class="card-title">Validacao IA</div>
  <div class="foto-text">Area experimental: teste uma foto sem alterar visitas reais.</div>
  <input type="file" id="iaFotoInput" accept="image/*">
  <button class="btn" type="button" onclick="analisarFotoIA()">Analisar foto</button>
  <div id="iaResultado" class="foto-text" style="margin-top:12px;">Nenhuma foto analisada.</div>
</div>
```

- [ ] **Step 4: Add contained browser logic**

In the script section of `index.html`, add:

```js
function lerArquivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Nao foi possivel ler a foto'));
    reader.readAsDataURL(file);
  });
}

async function analisarFotoIA() {
  const input = document.getElementById('iaFotoInput');
  const resultado = document.getElementById('iaResultado');
  const file = input?.files?.[0];
  if (!file) {
    if (resultado) resultado.textContent = 'Selecione uma foto para analisar.';
    return;
  }

  try {
    if (resultado) resultado.textContent = 'Analisando foto...';
    const foto = await lerArquivoComoDataUrl(file);
    const res = await fetch(`${API}/api/avaliar-foto`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ foto })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro ao avaliar foto');
    if (resultado) {
      const status = data.aprovado ? 'Aprovado' : (data.score >= 50 ? 'Revisao manual' : 'Reprovado');
      resultado.innerHTML = `<strong>${status}</strong><br>Score: ${data.score}<br>Modo: ${data.modo}<br>Materiais: ${(data.materiais_detectados || []).join(', ') || 'nenhum'}<br>${data.motivo || ''}`;
    }
  } catch (e) {
    if (resultado) resultado.textContent = 'Nao foi possivel analisar a foto: ' + e.message;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/validacao-ia-ui.test.js`

Expected: PASS with `validacao-ia-ui.test.js passou`.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/validacao-ia-ui.test.js
git commit -m "feat: add isolated AI validation test UI"
```

### Task 3: Run Full Local Verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: all existing Node tests.
- Produces: confirmation that the isolated feature did not break current checks.

- [ ] **Step 1: Run all tests**

Run:

```bash
node tests/bonus.test.js
node tests/gps-captura.test.js
node tests/mapa-timeline.test.js
node tests/validacao-ia-api.test.js
node tests/validacao-ia-ui.test.js
```

Expected: all tests print their `passou` message.

- [ ] **Step 2: Inspect git diff**

Run: `git diff --stat`

Expected: only `api/avaliar-foto.js`, `index.html`, `tests/validacao-ia-api.test.js`, `tests/validacao-ia-ui.test.js`, and docs from planning are changed.

- [ ] **Step 3: Commit verification docs if still uncommitted**

```bash
git add docs/superpowers/specs/2026-07-07-validacao-ia-fotos-design.md docs/superpowers/plans/2026-07-07-validacao-ia-fotos.md
git commit -m "docs: plan AI photo validation"
```

## Self-Review

- Spec coverage: the plan covers mock mode, Gemini mode, isolated UI, no database changes, no visit-flow changes, and tests.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: the API response fields are consistent across the spec, route, UI, and tests.
