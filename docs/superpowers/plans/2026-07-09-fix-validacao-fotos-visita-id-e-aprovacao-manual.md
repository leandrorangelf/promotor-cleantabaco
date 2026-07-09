# Fix validação de fotos (visita_id UUID) + aprovação manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o bug que impede o botão "Analisar IA" de funcionar na Galeria (causado por `visitas.id` ser UUID mas ser tratado como inteiro), e adicionar um botão de aprovação manual que confirma que uma foto tem tabela de preços sem depender da IA.

**Architecture:** `validacoes_fotos.visita_id` passa de `INTEGER` para `TEXT` (compatível com UUID), removendo todas as coerções `Number()` indevidas em cima de ids de visita no backend (`api/validacoes-fotos.js`, `api/listar.js`) e corrigindo a interpolação sem aspas nos `onclick` do frontend (`index.html`). A aprovação manual reaproveita os endpoints `POST`/`PUT` de `api/validacoes-fotos.js` já existentes — nenhum endpoint novo.

**Tech Stack:** Node.js serverless functions (Vercel, sem framework), Neon Postgres (`@neondatabase/serverless`), HTML/JS inline (`index.html`), testes via `node tests/<arquivo>.test.js` (asserts sobre texto de arquivo, sem DOM real).

## Global Constraints

- Sem build: `index.html` é standalone, JS inline. Editar diretamente.
- Testes são scripts Node simples (sem Jest/Mocha) que leem arquivos como texto e fazem `assert.ok(conteudo.includes(...))`. Rodar cada um com `node tests/<arquivo>.test.js`.
- `api/*.js`: cada handler cria sua própria tabela com `CREATE TABLE IF NOT EXISTS` no início — não há migrations separadas. Alterações de schema em coluna já existente exigem `ALTER TABLE` explícito dentro do próprio handler.
- Não duplicar lógica de negócio de bônus/metas dentro de `api/*.js` ou do HTML — mas esta mudança não mexe em `bonus.js`/`performance.js`.
- Mudanças cirúrgicas: não reformatar ou "melhorar" código adjacente não relacionado ao bug.

---

## Task 1: Corrigir schema e casts de visita_id em `api/validacoes-fotos.js`

**Files:**
- Modify: `api/validacoes-fotos.js:4-26` (função `garantirTabela`)
- Modify: `api/validacoes-fotos.js:114` (GET — cálculo de `ids`)
- Modify: `api/validacoes-fotos.js:163-193` (POST — insert)
- Test: `tests/validacao-fotos-visita-id.test.js` (novo)

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `garantirTabela(sql)` agora garante `visita_id TEXT`; o restante do arquivo passa a tratar `visita_id` sempre como string crua (sem `Number()`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/validacao-fotos-visita-id.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/validacoes-fotos.js', 'utf8');

assert.ok(api.includes('visita_id TEXT NOT NULL'), 'coluna visita_id deve ser TEXT para suportar UUID');
assert.ok(api.includes('ALTER COLUMN visita_id TYPE TEXT'), 'deve migrar coluna existente de INTEGER para TEXT');
assert.ok(!api.includes('Number(visita_id)'), 'nao deve mais converter visita_id para numero');
assert.ok(!/const ids = visitas\.map\(v => Number\(v\.id\)\)/.test(api), 'GET nao deve mais converter v.id para numero');

console.log('validacao-fotos-visita-id.test.js passou');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `AssertionError` na primeira asserção (`visita_id TEXT NOT NULL` ainda não existe).

- [ ] **Step 3: Editar `garantirTabela` para usar TEXT e migrar coluna existente**

Substituir o bloco (linhas 4-26) por:

```js
async function garantirTabela(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS validacoes_fotos (
      id SERIAL PRIMARY KEY,
      visita_id TEXT NOT NULL,
      promotor TEXT NOT NULL,
      cliente_nome TEXT DEFAULT '',
      foto_index INTEGER NOT NULL,
      imagem_hash TEXT DEFAULT '',
      status_ia TEXT NOT NULL DEFAULT 'pendente',
      score NUMERIC NOT NULL DEFAULT 0,
      motivo TEXT DEFAULT '',
      materiais_detectados JSONB NOT NULL DEFAULT '[]'::jsonb,
      status_manual TEXT DEFAULT '',
      revisado_por TEXT DEFAULT '',
      revisado_em TIMESTAMPTZ,
      possivel_reuso BOOLEAN NOT NULL DEFAULT FALSE,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(visita_id, foto_index)
    )
  `;
  try {
    await sql`ALTER TABLE validacoes_fotos ALTER COLUMN visita_id TYPE TEXT`;
  } catch (e) {
    // Coluna ja e TEXT ou tabela recem-criada — nao bloqueia o handler
  }
}
```

- [ ] **Step 4: Corrigir o cálculo de `ids` no GET (linha 114)**

Trocar:

```js
      const ids = visitas.map(v => Number(v.id)).filter(Number.isFinite);
```

por:

```js
      const ids = visitas.map(v => v.id).filter(Boolean);
```

- [ ] **Step 5: Corrigir o `INSERT` do POST (bloco `visita_id, ...` dentro de `req.method === 'POST'`)**

Trocar:

```js
        VALUES (
          ${Number(visita_id)}, ${visita.promotor}, ${cliente_nome}, ${Number(foto_index)}, ${imagem_hash},
          ${status}, ${Number(resultado.score || 0)}, ${resultado.motivo || ''},
          ${JSON.stringify(resultado.materiais_detectados || [])}::jsonb, ${possivelReuso}, NOW()
        )
```

por:

```js
        VALUES (
          ${String(visita_id)}, ${visita.promotor}, ${cliente_nome}, ${Number(foto_index)}, ${imagem_hash},
          ${status}, ${Number(resultado.score || 0)}, ${resultado.motivo || ''},
          ${JSON.stringify(resultado.materiais_detectados || [])}::jsonb, ${possivelReuso}, NOW()
        )
```

Também trocar, um pouco acima no mesmo bloco POST, a query de duplicadas:

```js
      const duplicadas = imagem_hash
        ? await sql`SELECT id FROM validacoes_fotos WHERE imagem_hash = ${imagem_hash} AND NOT (visita_id = ${visita_id} AND foto_index = ${Number(foto_index)}) LIMIT 1`
        : [];
```

por:

```js
      const duplicadas = imagem_hash
        ? await sql`SELECT id FROM validacoes_fotos WHERE imagem_hash = ${imagem_hash} AND NOT (visita_id = ${String(visita_id)} AND foto_index = ${Number(foto_index)}) LIMIT 1`
        : [];
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `validacao-fotos-visita-id.test.js passou`

- [ ] **Step 7: Rodar a suíte existente pra garantir que nada quebrou**

Run: `node tests/validacao-ia-galeria.test.js`
Expected: `validacao-ia-galeria.test.js passou`

- [ ] **Step 8: Commit**

```bash
git add api/validacoes-fotos.js tests/validacao-fotos-visita-id.test.js
git commit -m "fix: visita_id vira TEXT em validacoes_fotos para suportar UUID"
```

---

## Task 2: Corrigir cast de `v.id` em `api/listar.js`

**Files:**
- Modify: `api/listar.js:56`
- Test: `tests/validacao-fotos-visita-id.test.js` (estender)

**Interfaces:**
- Consumes: nenhuma (independente da Task 1, mas mesma causa raiz).
- Produces: `ids` em `listar.js` passam a ser strings cruas, compatíveis com `visita_id TEXT` da Task 1.

- [ ] **Step 1: Estender o teste**

Adicionar ao final de `tests/validacao-fotos-visita-id.test.js` (antes do `console.log`):

```js
const listar = fs.readFileSync('api/listar.js', 'utf8');
assert.ok(!/const ids = rows\.map\(v => Number\(v\.id\)\)/.test(listar), 'listar.js nao deve mais converter v.id para numero');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `AssertionError: listar.js nao deve mais converter v.id para numero`

- [ ] **Step 3: Corrigir `api/listar.js:56`**

Trocar:

```js
    const ids = rows.map(v => Number(v.id)).filter(Boolean);
```

por:

```js
    const ids = rows.map(v => v.id).filter(Boolean);
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `validacao-fotos-visita-id.test.js passou`

- [ ] **Step 5: Commit**

```bash
git add api/listar.js tests/validacao-fotos-visita-id.test.js
git commit -m "fix: listar.js nao converte mais visita_id (UUID) para numero"
```

---

## Task 3: Corrigir `onclick` sem aspas no frontend (`index.html`)

**Files:**
- Modify: `index.html:2616` (`analisarFotoGaleria` dentro de `renderGaleria`)
- Modify: `index.html:2497` (`abrirFotoGaleriaIA` dentro de `renderGaleriaIA`)
- Modify: `index.html:2512` (`analisarValidacaoPendente` dentro de `renderGaleriaIA`)
- Test: `tests/validacao-fotos-visita-id.test.js` (estender)

**Interfaces:**
- Consumes: nenhuma diretamente, mas depende de Task 1/2 pra fazer sentido em produção (schema TEXT).
- Produces: `analisarFotoGaleria`, `analisarValidacaoPendente`, `abrirFotoGaleriaIA` continuam recebendo `visitaId` — internamente já usam `String(v.visita_id) === String(visitaId)`, nenhuma mudança de assinatura necessária.

- [ ] **Step 1: Estender o teste**

Adicionar ao final de `tests/validacao-fotos-visita-id.test.js` (antes do `console.log`):

```js
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes("analisarFotoGaleria('" + "$" + "{item.visita_id}', " + "$" + "{item.foto_index})"), 'onclick de analisarFotoGaleria deve envolver visita_id em aspas');
assert.ok(html.includes("analisarValidacaoPendente('" + "$" + "{item.visita_id}', " + "$" + "{item.foto_index})"), 'onclick de analisarValidacaoPendente deve envolver visita_id em aspas');
assert.ok(html.includes("abrirFotoGaleriaIA('" + "$" + "{item.visita_id}', " + "$" + "{item.foto_index})"), 'onclick de abrirFotoGaleriaIA deve envolver visita_id em aspas');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `AssertionError` na asserção de `analisarFotoGaleria`.

- [ ] **Step 3: Corrigir `index.html:2616`**

Trocar:

```html
            <button class="btn-detalhes" type="button" onclick="analisarFotoGaleria(${item.visita_id}, ${item.foto_index})">Analisar IA</button>
```

por:

```html
            <button class="btn-detalhes" type="button" onclick="analisarFotoGaleria('${item.visita_id}', ${item.foto_index})">Analisar IA</button>
```

- [ ] **Step 4: Corrigir `index.html:2497`**

Trocar:

```html
        <button class="rel-foto-btn" type="button" onclick="abrirFotoGaleriaIA(${item.visita_id}, ${item.foto_index})" style="width:100%;border-radius:0;">
```

por:

```html
        <button class="rel-foto-btn" type="button" onclick="abrirFotoGaleriaIA('${item.visita_id}', ${item.foto_index})" style="width:100%;border-radius:0;">
```

- [ ] **Step 5: Corrigir `index.html:2512`**

Trocar:

```html
            <button class="btn-detalhes" type="button" onclick="analisarValidacaoPendente(${item.visita_id}, ${item.foto_index})">Analisar IA</button>
```

por:

```html
            <button class="btn-detalhes" type="button" onclick="analisarValidacaoPendente('${item.visita_id}', ${item.foto_index})">Analisar IA</button>
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `validacao-fotos-visita-id.test.js passou`

- [ ] **Step 7: Rodar a suíte existente pra garantir que nada quebrou**

Run: `node tests/validacao-ia-galeria.test.js`
Expected: `validacao-ia-galeria.test.js passou`

- [ ] **Step 8: Commit**

```bash
git add index.html tests/validacao-fotos-visita-id.test.js
git commit -m "fix: onclick da Galeria envolve visita_id em aspas para suportar UUID"
```

---

## Task 4: Botão "Confirmar tabela" (aprovação manual sem IA)

**Files:**
- Modify: `index.html:2616-2617` (bloco `acoes` dentro de `renderGaleria`, adicionar botão junto de "Analisar IA")
- Modify: `index.html:2511-2513` (bloco de botões dentro de `renderGaleriaIA`, adicionar botão junto de "Analisar IA")
- Modify: `index.html` (adicionar nova função `confirmarTabelaManual`, próxima a `analisarFotoGaleria`/`analisarValidacaoPendente`)
- Test: `tests/validacao-fotos-visita-id.test.js` (estender)

**Interfaces:**
- Consumes: `apiFetch`, `headers()`, `API`, `toast()`, `carregarGaleria()`, `renderGaleriaIA()` — todas já existentes em `index.html`.
- Produces: `async function confirmarTabelaManual(visitaId, fotoIndex, clienteNome)` — chamada pelos novos botões de ambas as telas.

- [ ] **Step 1: Estender o teste**

Adicionar ao final de `tests/validacao-fotos-visita-id.test.js` (antes do `console.log`):

```js
assert.ok(html.includes('async function confirmarTabelaManual'), 'deve existir funcao de confirmacao manual sem IA');
assert.ok(html.includes("confirmarTabelaManual('${item.visita_id}', ${item.foto_index}"), 'botao de confirmacao manual deve estar na Galeria e na Galeria IA');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `AssertionError: deve existir funcao de confirmacao manual sem IA`

- [ ] **Step 3: Adicionar a função `confirmarTabelaManual`**

Inserir logo após o fim da função `analisarFotoGaleria` (depois do `}` que fecha essa função, antes de `async function revisarFotoGaleria`):

```js
async function confirmarTabelaManual(visitaId, fotoIndex, clienteNome) {
  try {
    toast('Confirmando tabela...');
    const res = await apiFetch(`${API}/api/validacoes-fotos`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visita_id: visitaId,
        foto_index: fotoIndex,
        cliente_nome: clienteNome || '',
        resultado: {}
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro ao registrar validacao');

    const resPut = await apiFetch(`${API}/api/validacoes-fotos`, {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.validacao.id, status_manual: 'aprovado' })
    });
    const dataPut = await resPut.json();
    if (!resPut.ok) throw new Error(dataPut.erro || 'Erro ao confirmar tabela');

    toast('Tabela confirmada manualmente');
    await carregarGaleria();
    validacoesIA = [];
    await renderGaleriaIA();
  } catch(e) {
    toast('Nao foi possivel confirmar: ' + e.message);
  }
}
```

- [ ] **Step 4: Adicionar o botão em `renderGaleria` (linha 2615-2617)**

Trocar:

```js
        : `<div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn-detalhes" type="button" onclick="analisarFotoGaleria('${item.visita_id}', ${item.foto_index})">Analisar IA</button>
          </div>`)
```

por:

```js
        : `<div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn-detalhes" type="button" onclick="analisarFotoGaleria('${item.visita_id}', ${item.foto_index})">Analisar IA</button>
            <button class="btn-detalhes" type="button" onclick="confirmarTabelaManual('${item.visita_id}', ${item.foto_index}, '${(item.cliente_nome || '').replace(/'/g, "\\'")}')">Confirmar tabela</button>
          </div>`)
```

- [ ] **Step 5: Adicionar o botão em `renderGaleriaIA` (linha 2511-2513)**

Trocar:

```js
          </div>` : `<div style="display:flex;gap:6px;margin-top:10px;">
            <button class="btn-detalhes" type="button" onclick="analisarValidacaoPendente('${item.visita_id}', ${item.foto_index})">Analisar IA</button>
          </div>`}
```

por:

```js
          </div>` : `<div style="display:flex;gap:6px;margin-top:10px;">
            <button class="btn-detalhes" type="button" onclick="analisarValidacaoPendente('${item.visita_id}', ${item.foto_index})">Analisar IA</button>
            <button class="btn-detalhes" type="button" onclick="confirmarTabelaManual('${item.visita_id}', ${item.foto_index}, '${(item.cliente_nome || '').replace(/'/g, "\\'")}')">Confirmar tabela</button>
          </div>`}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `node tests/validacao-fotos-visita-id.test.js`
Expected: `validacao-fotos-visita-id.test.js passou`

- [ ] **Step 7: Rodar a suíte existente pra garantir que nada quebrou**

Run: `node tests/validacao-ia-galeria.test.js`
Expected: `validacao-ia-galeria.test.js passou`

- [ ] **Step 8: Commit**

```bash
git add index.html tests/validacao-fotos-visita-id.test.js
git commit -m "feat: botao de confirmacao manual de tabela na Galeria sem depender da IA"
```

---

## Task 5: Verificação manual end-to-end

**Files:** nenhum arquivo novo — checklist de verificação manual (não há servidor local com Vercel Functions/Neon configurado neste ambiente).

- [ ] **Step 1: Rodar toda a suíte de testes Node**

Run (bash):
```bash
for f in tests/*.test.js; do node "$f" || exit 1; done
```
Expected: todas as linhas terminam em "passou", sem `AssertionError`.

- [ ] **Step 2: Revisar visualmente o diff final**

Run: `git diff main --stat` (ou `git log --oneline -5`)
Expected: mudanças concentradas em `api/validacoes-fotos.js`, `api/listar.js`, `index.html`, `tests/validacao-fotos-visita-id.test.js`.

- [ ] **Step 3: Checklist de verificação em produção (após deploy)**

Documentar no PR/commit final que o usuário deve, após o deploy:
1. Abrir a aba **Galeria** como gestor, localizar uma foto sem análise, clicar em **"Analisar IA"** — confirmar que não aparece `SyntaxError` no console e que a foto recebe status.
2. Na mesma foto (ou outra pendente), clicar em **"Confirmar tabela"** — confirmar que ela passa a aparecer com os botões "Aprovar"/"Reprovar" e status "aprovado".
3. Repetir os dois passos na aba **Galeria IA**.
4. Conferir que a meta do promotor dessa visita é incrementada (via `bonus.js`/`performance.js`, que já lê `status_manual || status_ia`).

- [ ] **Step 4: Commit (se houver ajustes de checklist/documentação)**

Só necessário se o Step 3 revelar algo a documentar; caso contrário, esta task não gera commit adicional.
