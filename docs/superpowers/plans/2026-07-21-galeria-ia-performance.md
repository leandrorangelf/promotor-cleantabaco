# Gallery and AI Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a galeria paginada e leve e consolidar a análise manual do Gemini em uma única operação auditável.

**Architecture:** A listagem devolve metadados paginados e URLs protegidas para miniatura/original. Um endpoint de análise valida acesso, impede duplicidade, chama um modelo fixo e persiste resultado e uso sem participar do salvamento da visita.

**Tech Stack:** HTML/CSS/JavaScript standalone, Vercel Functions, Neon Postgres, Gemini GenerateContent REST, testes Node com `assert`.

## Global Constraints

- Primeira página da galeria: 24 itens.
- Não transferir imagens originais na resposta inicial.
- A análise permanece manual e não bloqueia o promotor.
- Usar modelo fixo; não usar `latest`.
- Não cobrar novamente por foto já analisada sem `Reanalisar` explícito.
- Registrar modelo, tokens, custo estimado, horário e erro.
- Falhas do Gemini não alteram visita nem foto.
- Meta: primeira página em até 2 segundos em condições normais.

---

## File Structure

- `api/validacoes-fotos.js`: paginação por cursor e metadados.
- `api/foto.js`: entrega protegida de uma foto por visita/índice e variante.
- `api/analisar-foto.js`: operação única de análise e persistência.
- `api/avaliar-foto.js`: helper reutilizável com modelo fixo e metadados de uso.
- `index.html`: paginação, estados e ação manual única.
- `tests/galeria-paginacao.test.js`: cursor, limite e ausência de imagem original.
- `tests/validacao-ia-imagem.test.js`: modelo fixo e uso.
- `tests/validacao-ia-fluxo.test.js`: idempotência, permissões e gravação.

### Task 1: Paginação leve da galeria

**Files:**
- Create: `tests/galeria-paginacao.test.js`
- Modify: `api/validacoes-fotos.js:82-164`

**Interfaces:**
- Consumes: filtros atuais `promotor`, `status`, `de`, `ate`.
- Produces: `GET /api/validacoes-fotos?limite=24&cursor=<base64url>` com `{ validacoes, proximo_cursor, tem_mais }`.

- [ ] **Step 1: Escrever teste que falha**

```js
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('api/validacoes-fotos.js', 'utf8');
assert.ok(src.includes("limite = '24'"));
assert.ok(src.includes('cursor'));
assert.ok(src.includes('proximo_cursor'));
assert.ok(src.includes('tem_mais'));
assert.ok(src.includes('LIMIT ${limiteFotos + 1}'));
assert.ok(!/itens\.push\(\{[\s\S]{0,700}\bfoto,/.test(src));
assert.ok(src.includes('miniatura_url'));
assert.ok(src.includes('foto_url'));
console.log('galeria-paginacao.test.js passou');
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\galeria-paginacao.test.js`

Expected: FAIL em `limite = '24'`.

- [ ] **Step 3: Implementar cursor estável**

```js
function codificarCursor(item) {
  return Buffer.from(JSON.stringify({ criado_em: item.criado_em, id: String(item.visita_id), foto_index: item.foto_index })).toString('base64url');
}

function decodificarCursor(cursor = '') {
  if (!cursor) return null;
  try { return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); }
  catch { throw new Error('Cursor invalido'); }
}
```

Ordenar por `criado_em DESC, visita_id DESC, foto_index DESC`, buscar `limiteFotos + 1`, remover o excedente e gerar o próximo cursor do último item devolvido. A resposta inclui apenas metadados, `miniatura_url` e `foto_url`.

- [ ] **Step 4: Executar teste, sintaxe e commit**

Run: `node tests\galeria-paginacao.test.js`

Run: `node --check api\validacoes-fotos.js`

Expected: teste imprime `passou`; sintaxe retorna exit code 0.

```powershell
git add api/validacoes-fotos.js tests/galeria-paginacao.test.js
git commit -m "perf: paginate gallery metadata"
```

### Task 2: Entrega de imagem sob demanda

**Files:**
- Modify: `api/foto.js`
- Modify: `tests/galeria-paginacao.test.js`

**Interfaces:**
- Consumes: `GET /api/foto?id=<visita>&index=<n>&variant=thumb|full`.
- Produces: resposta binária ou data URL protegida conforme o formato armazenado.

- [ ] **Step 1: Ampliar teste antes da implementação**

```js
const foto = fs.readFileSync('api/foto.js', 'utf8');
assert.ok(foto.includes('req.query.index'));
assert.ok(foto.includes('req.query.variant'));
assert.ok(foto.includes("variant === 'thumb'"));
assert.ok(foto.includes('Cache-Control'));
assert.ok(foto.includes('private'));
```

- [ ] **Step 2: Implementar acesso por índice**

Validar `index` como inteiro não negativo, aplicar as permissões já usadas pela rota e devolver somente a imagem solicitada. Para `thumb`, usar a versão compactada já persistida; se o legado não tiver variante, devolver a imagem existente sem regravar dados nesta tarefa.

- [ ] **Step 3: Executar testes e commit**

Run: `node tests\galeria-paginacao.test.js`

Run: `node tests\api-cache-control.test.js`

Expected: ambos imprimem `passou`.

```powershell
git add api/foto.js tests/galeria-paginacao.test.js tests/api-cache-control.test.js
git commit -m "perf: load gallery images on demand"
```

### Task 3: Modelo fixo e medição real de tokens

**Files:**
- Modify: `api/avaliar-foto.js`
- Modify: `tests/validacao-ia-imagem.test.js`

**Interfaces:**
- Produces: `avaliarComGemini(foto)` com `{ resultado, uso: { modelo, input_tokens, output_tokens, custo_usd_estimado } }`.

- [ ] **Step 1: Adicionar expectativas ao teste**

```js
assert.ok(api.includes("const MODELO_GEMINI = 'gemini-2.5-flash'"));
assert.ok(!api.includes('gemini-flash-latest'));
assert.ok(api.includes('usageMetadata'));
assert.ok(api.includes('promptTokenCount'));
assert.ok(api.includes('candidatesTokenCount'));
assert.ok(api.includes('custo_usd_estimado'));
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\validacao-ia-imagem.test.js`

Expected: FAIL na constante `MODELO_GEMINI`.

- [ ] **Step 3: Fixar modelo e devolver uso**

```js
const MODELO_GEMINI = 'gemini-2.5-flash';
const PRECO_INPUT_USD_M = 0.30;
const PRECO_OUTPUT_USD_M = 2.50;

function calcularUso(data = {}) {
  const input = Number(data.usageMetadata?.promptTokenCount || 0);
  const output = Number(data.usageMetadata?.candidatesTokenCount || 0);
  return {
    modelo: MODELO_GEMINI,
    input_tokens: input,
    output_tokens: output,
    custo_usd_estimado: (input * PRECO_INPUT_USD_M + output * PRECO_OUTPUT_USD_M) / 1_000_000
  };
}
```

Exportar o helper para reutilização server-side e manter o handler existente compatível.

- [ ] **Step 4: Executar teste, sintaxe e commit**

Run: `node tests\validacao-ia-imagem.test.js`

Run: `node --check api\avaliar-foto.js`

Expected: teste imprime `passou`; sintaxe retorna exit code 0.

```powershell
git add api/avaliar-foto.js tests/validacao-ia-imagem.test.js
git commit -m "feat: track Gemini usage with pinned model"
```

### Task 4: Endpoint único e idempotente de análise

**Files:**
- Create: `api/analisar-foto.js`
- Create: `tests/validacao-ia-fluxo.test.js`
- Modify: `api/validacoes-fotos.js:4-31`

**Interfaces:**
- Consumes: `POST /api/analisar-foto` com `{ visita_id, foto_index, reanalisar?: boolean }`.
- Produces: `{ validacao, reutilizada }`.

- [ ] **Step 1: Escrever teste estrutural**

```js
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('api/analisar-foto.js', 'utf8');
assert.ok(src.includes("import { autenticar } from './_auth.js'"));
assert.ok(src.includes('reanalisar'));
assert.ok(src.includes('FOR UPDATE'));
assert.ok(src.includes('status_ia'));
assert.ok(src.includes('modelo_ia'));
assert.ok(src.includes('input_tokens'));
assert.ok(src.includes('output_tokens'));
assert.ok(src.includes('custo_usd_estimado'));
assert.ok(src.includes('reutilizada: true'));
assert.ok(src.includes('avaliarComGemini'));
console.log('validacao-ia-fluxo.test.js passou');
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\validacao-ia-fluxo.test.js`

Expected: FAIL com `ENOENT`.

- [ ] **Step 3: Criar colunas de auditoria**

Em `garantirTabela`, adicionar migrações idempotentes para `modelo_ia TEXT`, `input_tokens INTEGER DEFAULT 0`, `output_tokens INTEGER DEFAULT 0`, `custo_usd_estimado NUMERIC DEFAULT 0` e `erro_ia TEXT DEFAULT ''`.

- [ ] **Step 4: Implementar operação única**

O endpoint deve autenticar, validar acesso à visita, travar/consultar a validação da foto, retornar o registro existente quando concluído e `reanalisar !== true`, extrair a foto do registro da visita, chamar `avaliarComGemini`, persistir resultado e uso e retornar a validação. Clique duplo deve reutilizar o resultado persistido.

```js
if (existente && statusFinal(existente) && reanalisar !== true) {
  return res.status(200).json({ validacao: existente, reutilizada: true });
}
```

- [ ] **Step 5: Executar testes e commit**

Run: `node tests\validacao-ia-fluxo.test.js`

Run: `node tests\validacao-ia-api.test.js`

Run: `node tests\permissoes-visitas.test.js`

Expected: todos imprimem `passou`.

```powershell
git add api/analisar-foto.js api/validacoes-fotos.js tests/validacao-ia-fluxo.test.js
git commit -m "feat: analyze and persist photos in one request"
```

### Task 5: Galeria incremental e análise sem congelamento

**Files:**
- Modify: `index.html:1530-1550`
- Modify: `index.html:3286-3465`
- Modify: `tests/validacao-ia-galeria.test.js`

**Interfaces:**
- Consumes: paginação e `POST /api/analisar-foto`.
- Produces: `carregarGaleria({ continuar = false } = {})`, `analisarFotoManual(item, { reanalisar = false } = {})`.

- [ ] **Step 1: Atualizar o teste primeiro**

```js
assert.ok(html.includes('galeriaProximoCursor'));
assert.ok(html.includes('galeriaTemMais'));
assert.ok(html.includes('Carregar mais'));
assert.ok(html.includes('/api/analisar-foto'));
assert.ok(html.includes('data-estado="analisando"'));
assert.ok(!/function analisarFotoGaleria[\s\S]{0,1800}\/api\/avaliar-foto/.test(html));
assert.ok(!/function analisarFotoGaleria[\s\S]{0,1800}\/api\/validacoes-fotos/.test(html));
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node tests\validacao-ia-galeria.test.js`

Expected: FAIL em `galeriaProximoCursor`.

- [ ] **Step 3: Implementar paginação e estados**

```js
let galeriaProximoCursor = '';
let galeriaTemMais = false;

async function carregarGaleria({ continuar = false } = {}) {
  if (!continuar) { galeriaFotos = []; galeriaProximoCursor = ''; }
  const params = parametrosGaleria();
  params.set('limite', '24');
  if (continuar && galeriaProximoCursor) params.set('cursor', galeriaProximoCursor);
  const res = await apiFetch(`${API}/api/validacoes-fotos?${params}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || 'Erro ao carregar galeria');
  galeriaFotos = continuar ? [...galeriaFotos, ...data.validacoes] : data.validacoes;
  galeriaProximoCursor = data.proximo_cursor || '';
  galeriaTemMais = Boolean(data.tem_mais);
  renderGaleria();
}
```

Durante análise, atualizar somente o card correspondente para `Analisando`, desabilitar o botão e manter rolagem/filtros. Ao terminar, mesclar a validação localmente.

- [ ] **Step 4: Remover análise automática do salvamento**

Excluir a chamada `await registrarValidacoesVisita(...)` do sucesso de `salvarVisita` e remover a função quando não houver outro consumidor. O salvamento deve seguir direto para toast, limpeza e atualização do histórico.

- [ ] **Step 5: Executar testes, sincronizar e commit**

Run: `node tests\validacao-ia-galeria.test.js`

Run: `node tests\salvamento-rascunho.test.js`

Run: `node tests\validacao-ia-ui.test.js`

Expected: todos imprimem `passou`.

Run: `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1`

```powershell
git add index.html app/www/index.html tests/validacao-ia-galeria.test.js
git commit -m "perf: paginate gallery and isolate manual AI"
```

### Task 6: Verificação integrada e medição

**Files:**
- Modify: `tests/galeria-paginacao.test.js`
- Modify: `tests/validacao-ia-fluxo.test.js`

**Interfaces:**
- Produces: proteção contra payload original e duplicidade de custo.

- [ ] **Step 1: Adicionar asserções finais**

```js
assert.ok(!src.includes('foto: foto'));
assert.ok(src.includes('Server-Timing'));
```

No teste do fluxo:

```js
assert.ok(src.includes('reanalisar !== true'));
assert.ok(src.includes('reutilizada: true'));
```

- [ ] **Step 2: Executar conjunto de regressão**

Run: `node tests\galeria-paginacao.test.js`

Run: `node tests\validacao-ia-fluxo.test.js`

Run: `node tests\validacao-ia-galeria.test.js`

Run: `node tests\validacao-ia-imagem.test.js`

Run: `node tests\validacao-ia-api.test.js`

Run: `node tests\validacao-fotos-visita-id.test.js`

Expected: todos imprimem `passou`.

- [ ] **Step 3: Verificar sintaxe das APIs**

Run: `node --check api\validacoes-fotos.js`

Run: `node --check api\foto.js`

Run: `node --check api\avaliar-foto.js`

Run: `node --check api\analisar-foto.js`

Expected: todos retornam exit code 0.

- [ ] **Step 4: Commit final de testes**

```powershell
git add tests/galeria-paginacao.test.js tests/validacao-ia-fluxo.test.js api/validacoes-fotos.js api/analisar-foto.js
git commit -m "test: enforce gallery and AI performance"
```
