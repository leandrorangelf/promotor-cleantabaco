# Mapa, rota ajustada e galeria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar as prévias da Galeria, organizar a aba Mapa no desktop e exibir a Jornada GPS ajustada às ruas sem perder os pontos originais.

**Architecture:** Corrigir primeiro as duas regressões locais de frontend. Em seguida, criar um módulo servidor puro para segmentação, classificação, janelamento e normalização de map matching; `api/jornadas.js` usa esse módulo, cacheia o resultado por jornada e sempre devolve segmentos brutos em caso de falha. O Leaflet consome apenas o contrato estável `segmentos`, sem conhecer o provedor.

**Tech Stack:** HTML/CSS/JavaScript sem framework, Leaflet 1.9.4, Vercel Functions, Neon PostgreSQL, Mapbox Map Matching API v5, testes Node `assert`.

## Global Constraints

- Os pontos GPS brutos são a evidência original e nunca podem ser substituídos ou apagados.
- Intervalos superiores a 15 minutos formam segmentos separados.
- O frontend nunca recebe `MAPBOX_ACCESS_TOKEN`.
- Falha, ausência de configuração ou correspondência parcial sempre preserva uma trilha `raw` visível.
- A API pública do projeto expõe `origem: "matched" | "raw"` e `ajuste.status: "completo" | "parcial" | "indisponivel" | "sem_dados"`; nenhum objeto Mapbox vaza pelo contrato.
- Alterações de frontend devem ser idênticas em `index.html` e `app/www/index.html`.
- Nenhuma dependência npm nova é necessária; usar `fetch` nativo do runtime Vercel.
- Não usar endpoint comunitário de OSRM como dependência de produção.

---

## File map

- `api/_map-match.mjs`: funções puras de validação, separação temporal, classificação, janelamento, chamada Mapbox e normalização/fallback.
- `api/jornadas.js`: autorização e consulta atuais, cache PostgreSQL por jornada, orquestração do ajuste e contrato da resposta.
- `index.html`: estrutura/CSS desktop do Mapa, correção da Galeria e renderização Leaflet dos segmentos.
- `app/www/index.html`: cópia equivalente para o aplicativo Android.
- `tests/galeria-preview.test.js`: regressão do atributo `data-galeria-url`.
- `tests/mapa-layout.test.js`: contrato estrutural do filtro e cartões da aba Mapa.
- `tests/map-match.test.mjs`: comportamento puro de segmentação, perfis, janelas e fallback.
- `tests/jornada-api.test.js`: contrato e cache da API de jornadas.
- `tests/jornada-mapa.test.js`: estilos `matched`/`raw` e mensagens do mapa.

---

### Task 1: Restaurar as prévias autenticadas da Galeria

**Files:**
- Create: `tests/galeria-preview.test.js`
- Modify: `index.html:3568-3580`
- Modify: `app/www/index.html:3568-3580`

**Interfaces:**
- Consumes: `<img data-galeria-url="/api/foto?...">` criado por `renderGaleria()`.
- Produces: `carregarImagemGaleria(img): Promise<void>` usando `img.dataset.galeriaUrl` e `apiFetch` autenticado.

- [ ] **Step 1: Write the failing regression test**

```js
const assert = require('assert');
const fs = require('fs');

for (const arquivo of ['index.html', 'app/www/index.html']) {
  const html = fs.readFileSync(arquivo, 'utf8');
  assert.ok(html.includes('data-galeria-url='), `${arquivo}: deve declarar a URL lazy`);
  assert.ok(html.includes('img.dataset.galeriaUrl'), `${arquivo}: deve ler data-galeria-url pelo nome DOM correto`);
  assert.ok(!html.includes('`${API}${img.dataset.url}`'), `${arquivo}: não deve ler dataset.url inexistente`);
  assert.match(html, /apiFetch\(`\$\{API\}\$\{img\.dataset\.galeriaUrl\}`,[\s\S]{0,80}headers:\s*headers\(\)/,
    `${arquivo}: miniatura deve manter autenticação`);
}

console.log('galeria-preview.test.js passou');
```

- [ ] **Step 2: Run the test and confirm the current bug**

Run: `node tests\galeria-preview.test.js`

Expected: FAIL em `deve ler data-galeria-url pelo nome DOM correto`.

- [ ] **Step 3: Apply the minimal matching change in both frontends**

Substituir somente a leitura da URL dentro de `carregarImagemGaleria`:

```js
const res = await apiFetch(`${API}${img.dataset.galeriaUrl}`, { headers: headers() });
```

Manter o restante da função, inclusive `img.dataset.carregando`, armazenamento em `item.foto`, `fotoSrc(data.foto)` e o estado de erro.

- [ ] **Step 4: Run focused gallery tests**

Run: `node tests\galeria-preview.test.js`

Expected: `galeria-preview.test.js passou`.

Run: `node tests\validacao-ia-galeria.test.js`

Expected: `validacao-ia-galeria.test.js passou`.

Run: `node tests\galeria-paginacao.test.js`

Expected: `galeria-paginacao.test.js passou`.

- [ ] **Step 5: Commit the isolated regression fix**

```powershell
git add index.html app/www/index.html tests/galeria-preview.test.js
git commit -m "fix: load authenticated gallery previews"
```

---

### Task 2: Organizar filtros e cartões da aba Mapa

**Files:**
- Create: `tests/mapa-layout.test.js`
- Modify: `index.html:650-700,1672-1702`
- Modify: `app/www/index.html:650-700,1672-1702`

**Interfaces:**
- Consumes: os mesmos IDs usados por `carregarMapa`, `carregarKmRota`, `aplicarFiltrosMapa` e `limparFiltrosMapa`.
- Produces: `.mapa-filtros-grid`, `.mapa-filtros-acoes`, `.mapa-status-area`, `#mapaKmCard`, `#mapaKmTrechosCard`; nenhum ID funcional existente é renomeado.

- [ ] **Step 1: Write the failing structural test**

```js
const assert = require('assert');
const fs = require('fs');

for (const arquivo of ['index.html', 'app/www/index.html']) {
  const html = fs.readFileSync(arquivo, 'utf8');
  assert.ok(html.includes('class="mapa-filtros-grid"'), `${arquivo}: deve ter uma grade única`);
  assert.ok(html.includes('class="mapa-filtros-acoes"'), `${arquivo}: ações devem ter faixa própria`);
  assert.ok(html.includes('class="mapa-checkbox-group"'), `${arquivo}: checkbox deve ter alinhamento próprio`);
  assert.ok(html.includes('id="mapaKmTrechosCard"'), `${arquivo}: trechos devem ter cartão próprio`);
  assert.ok(!/<label>&nbsp;<\/label>[\s\S]{0,180}mapaIncluirProspeccao/.test(html), `${arquivo}: não deve alinhar checkbox com rótulo vazio`);
  assert.match(html, /\.mapa-filtros-grid\s*\{[^}]*grid-template-columns:\s*minmax\(220px,\s*2fr\)\s*repeat\(2,\s*minmax\(150px,\s*1fr\)\)\s*minmax\(220px,\s*1\.3fr\)/,
    `${arquivo}: desktop deve ter quatro colunas explícitas`);
}

console.log('mapa-layout.test.js passou');
```

- [ ] **Step 2: Run the layout test and verify failure**

Run: `node tests\mapa-layout.test.js`

Expected: FAIL em `deve ter uma grade única`.

- [ ] **Step 3: Add scoped CSS in both frontends**

```css
.mapa-filtros-grid { display:grid; grid-template-columns:minmax(220px,2fr) repeat(2,minmax(150px,1fr)) minmax(220px,1.3fr); gap:12px; align-items:end; }
.mapa-checkbox-group { min-height:44px; display:flex; align-items:center; }
.mapa-checkbox-group label { display:flex; align-items:center; gap:8px; margin:0; font-weight:600; }
.mapa-checkbox-group input { width:auto; margin:0; }
.mapa-filtros-acoes { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:8px; margin-top:12px; }
.mapa-status-area { min-height:24px; margin:10px 0; }
.mapa-km-trechos-card { margin-top:12px; }
@media (max-width: 1050px) { .mapa-filtros-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width: 620px) { .mapa-filtros-grid { grid-template-columns:1fr; } .mapa-filtros-acoes > button { flex:1 1 160px; } }
```

- [ ] **Step 4: Replace only the Mapa structure in both frontends**

Usar este esqueleto, preservando opções, textos e handlers existentes:

```html
<div class="filtros mapa-filtros">
  <div class="mapa-filtros-grid">
    <div class="filtro-group"><label>Promotor</label><select id="mapaFiltroPromotor"><option value="">Todos</option></select></div>
    <div class="filtro-group"><label>De</label><input type="date" id="mapaFiltroDe"></div>
    <div class="filtro-group"><label>Até</label><input type="date" id="mapaFiltroAte"></div>
    <div class="mapa-checkbox-group"><label><input type="checkbox" id="mapaIncluirProspeccao" checked onchange="aplicarFiltrosMapa()"> Incluir prospecção no km</label></div>
  </div>
  <div class="mapa-filtros-acoes">
    <button class="btn-filtrar" type="button" onclick="aplicarFiltrosMapa()">Aplicar no mapa</button>
    <button class="btn-limpar-filtros" type="button" onclick="limparFiltrosMapa()">Limpar</button>
  </div>
</div>
<div class="mapa-status-area">
  <div id="mapaStatus" class="mapa-status"></div>
  <div id="jornadaMapaStatus" class="mapa-status"></div>
</div>
<div id="mapaKmCard" class="card" style="display:none;margin-bottom:12px;">
  <div class="card-title">Km da rota do dia</div>
  <div id="mapaKmValor" style="font-size:28px;font-weight:800;color:var(--purple);">—</div>
</div>
<div id="mapaLeafletEl" class="mapa-box"></div>
<div id="mapaVazio" class="empty" style="display:none;">Nenhuma visita com GPS no período/promotor selecionado.</div>
<div id="mapaKmTrechosCard" class="card mapa-km-trechos-card" style="display:none;">
  <div class="card-title">Km entre pontos da rota</div>
  <div id="mapaKmTrechos"></div>
</div>
```

Atualizar `carregarKmRota` para exibir/ocultar `mapaKmTrechosCard`; inserir somente as `.rel-row` em `mapaKmTrechos`, sem criar outro `.card` dentro dele.

- [ ] **Step 5: Run layout and existing map tests**

Run: `node tests\mapa-layout.test.js`

Expected: `mapa-layout.test.js passou`.

Run: `node tests\mapa-timeline.test.js`

Expected: `mapa-timeline.test.js passou`.

Run: `node tests\prospeccao-mapa-checkbox.test.js`

Expected: `prospeccao-mapa-checkbox.test.js passou`.

- [ ] **Step 6: Rendered desktop check before commit**

Abrir a aplicação com o Browser plugin, autenticar com uma sessão de teste disponível e executar o fluxo: `Mapa -> selecionar promotor -> definir De/Até -> Aplicar no mapa`. Verificar em 1440×900 e 1024×768: quatro controles alinhados (ou duas colunas em 1024), botões sem sobreposição, card de km separado e mapa em largura total. Registrar erros/warnings relevantes do console.

- [ ] **Step 7: Commit the layout change**

```powershell
git add index.html app/www/index.html tests/mapa-layout.test.js
git commit -m "fix: organize desktop map controls"
```

---

### Task 3: Criar o núcleo puro de segmentação e map matching

**Files:**
- Create: `api/_map-match.mjs`
- Create: `tests/map-match.test.mjs`

**Interfaces:**
- Consumes: `normalizarPontos(pontos)` com objetos `{ latitude, longitude, precisao, velocidade, capturado_em }`.
- Produces: `separarPorLacuna(pontos, lacunaMs = 900000)`, `classificarPerfil(pontos)`, `criarJanelas(pontos, tamanho = 100, sobreposicao = 5)`, `segmentosRaw(pontos)`, `ajustarTrilha(pontos, opcoes)`.
- `ajustarTrilha` retorna `{ segmentos, ajuste: { status, provedor } }`.

- [ ] **Step 1: Write behavior-first tests**

Criar `tests/map-match.test.mjs` com imports diretos do módulo e casos completos:

```js
import assert from 'node:assert/strict';
import { separarPorLacuna, classificarPerfil, criarJanelas, ajustarTrilha } from '../api/_map-match.mjs';

const ponto = (minuto, latitude, longitude, velocidade = null, precisao = 8) => ({
  latitude, longitude, velocidade, precisao,
  capturado_em: new Date(Date.UTC(2026, 6, 22, 12, minuto)).toISOString()
});

const continuo = [ponto(0,-23,-46,12), ponto(1,-23.001,-46.001,11), ponto(2,-23.002,-46.002,10)];
assert.equal(separarPorLacuna([...continuo, ponto(20,-23.01,-46.01,1)]).length, 2, 'lacuna maior que 15 min deve separar');
assert.equal(classificarPerfil(continuo), 'driving', 'velocidade sustentada deve usar direção');
assert.equal(classificarPerfil([ponto(0,-23,-46,1), ponto(1,-23.0002,-46.0002,1.2), ponto(2,-23.0004,-46.0004,0.8)]), 'walking', 'trecho lento sustentado deve usar caminhada');
assert.deepEqual(criarJanelas(Array.from({length:195}, (_,i) => ({i}))).map(x => x.length), [100,100,5], 'janelas devem sobrepor cinco pontos');

const semToken = await ajustarTrilha(continuo, { token: '', fetchImpl: async () => { throw new Error('não deveria chamar'); } });
assert.equal(semToken.ajuste.status, 'indisponivel');
assert.equal(semToken.segmentos[0].origem, 'raw');

const parcial = await ajustarTrilha([...continuo, ponto(20,-23.01,-46.01,1)], {
  token: 'teste',
  fetchImpl: async (_url) => ({ ok: false, status: 503, json: async () => ({}) })
});
assert.equal(parcial.segmentos.every(s => s.origem === 'raw'), true);
assert.equal(parcial.ajuste.status, 'indisponivel');

console.log('map-match.test.mjs passou');
```

- [ ] **Step 2: Run the tests and verify missing module failure**

Run: `node tests\map-match.test.mjs`

Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `api/_map-match.mjs`.

- [ ] **Step 3: Implement validation and temporal segmentation**

Em `api/_map-match.mjs`, definir e exportar:

```js
export const LACUNA_MS = 15 * 60 * 1000;
export const LIMITE_PONTOS = 100;
export const SOBREPOSICAO = 5;

export function normalizarPontos(pontos = []) {
  return pontos.filter(p => Number.isFinite(+p.latitude) && Number.isFinite(+p.longitude) && !Number.isNaN(Date.parse(p.capturado_em)))
    .map(p => ({ ...p, latitude:+p.latitude, longitude:+p.longitude, precisao:Number.isFinite(+p.precisao) ? Math.max(1,+p.precisao) : 25 }))
    .sort((a,b) => Date.parse(a.capturado_em) - Date.parse(b.capturado_em));
}

export function separarPorLacuna(pontos, lacunaMs = LACUNA_MS) {
  return normalizarPontos(pontos).reduce((grupos, p) => {
    const atual = grupos.at(-1);
    if (!atual || Date.parse(p.capturado_em) - Date.parse(atual.at(-1).capturado_em) > lacunaMs) grupos.push([p]);
    else atual.push(p);
    return grupos;
  }, []);
}
```

- [ ] **Step 4: Implement conservative profile classification and windows**

Usar `velocidade` em m/s quando presente; exigir pelo menos três amostras e mediana inferior a `2.2 m/s` para `walking`. Na ausência de velocidade suficiente, usar `driving`, evitando que jitter isolado altere o perfil. `criarJanelas` avança `tamanho - sobreposicao` e não emite uma janela final com menos de dois pontos.

- [ ] **Step 5: Implement provider call and stable normalization**

Para cada janela, chamar:

```js
const coordenadas = janela.map(p => `${p.longitude},${p.latitude}`).join(';');
const timestamps = janela.map(p => Math.floor(Date.parse(p.capturado_em) / 1000)).join(';');
const radiuses = janela.map(p => Math.min(100, Math.max(5, Math.round(p.precisao)))).join(';');
const url = `https://api.mapbox.com/matching/v5/mapbox/${perfil}/${coordenadas}.json?geometries=geojson&overview=full&tidy=true&timestamps=${timestamps}&radiuses=${radiuses}&access_token=${encodeURIComponent(token)}`;
```

Converter `matchings[*].geometry.coordinates` de `[lng,lat]` para `[lat,lng]`. Se uma janela falhar ou não retornar geometria, emitir o trecho original como `raw`. Remover os pontos sobrepostos ao recompor geometrias adjacentes. O status é `completo` quando todos os segmentos são `matched`, `parcial` quando há ambos, `indisponivel` quando só há `raw`, e `sem_dados` quando não há ao menos dois pontos válidos.

- [ ] **Step 6: Run pure tests**

Run: `node tests\map-match.test.mjs`

Expected: `map-match.test.mjs passou` sem acesso à rede real.

Run: `node --check api\_map-match.mjs`

Expected: exit code 0.

- [ ] **Step 7: Commit the isolated module**

```powershell
git add api/_map-match.mjs tests/map-match.test.mjs
git commit -m "feat: add GPS map matching core"
```

---

### Task 4: Integrar map matching e cache à API de jornadas

**Files:**
- Modify: `api/jornadas.js:1-81`
- Modify: `tests/jornada-api.test.js`

**Interfaces:**
- Consumes: `ajustarTrilha(pontos, { token: process.env.MAPBOX_ACCESS_TOKEN, fetchImpl: fetch })`.
- Produces por jornada: `{ ...camposAtuais, pontos, segmentos, ajuste }`.
- Cache PostgreSQL: colunas `rota_assinatura TEXT`, `rota_ajustada JSONB`, `rota_ajustada_em TIMESTAMPTZ` na tabela `jornadas`.

- [ ] **Step 1: Extend the static API contract test**

Adicionar a `tests/jornada-api.test.js`:

```js
const jornadas = fs.readFileSync('api/jornadas.js', 'utf8');
assert.ok(jornadas.includes("from './_map-match.mjs'"), 'jornadas deve usar módulo isolado de map matching');
assert.ok(jornadas.includes('MAPBOX_ACCESS_TOKEN'), 'token deve ser lido somente no servidor');
assert.ok(jornadas.includes('rota_assinatura'), 'deve persistir assinatura do cache');
assert.ok(jornadas.includes('rota_ajustada JSONB'), 'deve persistir geometria derivada');
assert.ok(jornadas.includes('segmentos'), 'resposta deve expor segmentos estáveis');
assert.ok(jornadas.includes('ajuste'), 'resposta deve informar qualidade do ajuste');
```

- [ ] **Step 2: Run and verify failure**

Run: `node tests\jornada-api.test.js`

Expected: FAIL em `deve usar módulo isolado de map matching`.

- [ ] **Step 3: Add cache columns idempotently**

Após criar `jornadas`, executar:

```js
await sql`ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS rota_assinatura TEXT`;
await sql`ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS rota_ajustada JSONB`;
await sql`ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS rota_ajustada_em TIMESTAMPTZ`;
```

Incluir essas colunas no `SELECT` de jornadas.

- [ ] **Step 4: Add deterministic signature and orchestration**

Importar `createHash` de `node:crypto` e `ajustarTrilha`. Calcular SHA-256 de uma serialização que contenha, por ponto, `latitude`, `longitude`, `precisao`, `velocidade` e `capturado_em`. Para cada jornada:

1. sem dois pontos válidos: retornar `segmentos: []`, `ajuste.status: 'sem_dados'`;
2. assinatura igual e `rota_ajustada` válida: reutilizar o JSON;
3. assinatura diferente: chamar `ajustarTrilha` e persistir resultado;
4. erro de persistência do cache: ainda devolver o resultado calculado;
5. erro de matching: o próprio módulo retorna `raw`, sem transformar o GET em HTTP 500.

Não registrar token, coordenadas ou resposta integral em logs.

- [ ] **Step 5: Limit provider work to an explicit request**

Aceitar `ajustar=true` em `req.query`. Quando ausente, devolver cache válido se existir; se não existir, gerar apenas `segmentosRaw(pontos)` sem chamar o provedor. Isso impede que consultas administrativas amplas de até 500 jornadas disparem chamadas externas. O frontend enviará `ajustar=true` somente quando houver um promotor selecionado.

- [ ] **Step 6: Run API and syntax tests**

Run: `node tests\jornada-api.test.js`

Expected: `jornada-api.test.js passou`.

Run: `node tests\map-match.test.mjs`

Expected: `map-match.test.mjs passou`.

Run: `node --check api\jornadas.js`

Expected: exit code 0.

- [ ] **Step 7: Commit API integration**

```powershell
git add api/jornadas.js tests/jornada-api.test.js
git commit -m "feat: cache matched journey routes"
```

---

### Task 5: Renderizar segmentos ajustados e brutos no Leaflet

**Files:**
- Modify: `tests/jornada-mapa.test.js`
- Modify: `index.html:4970-5035`
- Modify: `app/www/index.html:4970-5035`

**Interfaces:**
- Consumes: `jornada.segmentos[]` com `{ perfil, origem, pontos, inicio_em, fim_em }` e `jornada.ajuste.status`.
- Produces: linha contínua para `matched`, tracejada para `raw`, status textual e fallback para `jornada.pontos` legado.

- [ ] **Step 1: Write the failing frontend contract test**

Adicionar a `tests/jornada-mapa.test.js`, testando os dois arquivos:

```js
for (const arquivo of ['index.html', 'app/www/index.html']) {
  const tela = fs.readFileSync(arquivo, 'utf8');
  assert.ok(tela.includes('ajustar=true'), `${arquivo}: deve pedir ajuste somente no fluxo do mapa`);
  assert.ok(tela.includes("segmento.origem === 'matched'"), `${arquivo}: deve distinguir geometria ajustada`);
  assert.ok(tela.includes("dashArray: ajustado ? undefined : '8 5'"), `${arquivo}: raw deve ser tracejado`);
  assert.ok(tela.includes('Rota ajustada às ruas'), `${arquivo}: deve explicar linha contínua`);
  assert.ok(tela.includes('Trilha GPS original'), `${arquivo}: deve explicar fallback`);
}
```

- [ ] **Step 2: Run and verify failure**

Run: `node tests\jornada-mapa.test.js`

Expected: FAIL em `deve pedir ajuste somente no fluxo do mapa`.

- [ ] **Step 3: Request matching only for a selected promoter**

Em `carregarJornadasMapa`, acrescentar `ajustar=true` somente quando `promotor` não estiver vazio:

```js
if (promotor) {
  url += `promotor=${encodeURIComponent(promotor)}&`;
  url += 'ajustar=true&';
}
```

- [ ] **Step 4: Replace raw-only drawing with contract-based drawing**

Para cada jornada, usar `jornada.segmentos` quando não vazio. Para resposta antiga, converter os `jornada.pontos` em segmentos separados por 15 minutos e marcá-los como `raw`. Desenhar:

```js
const ajustado = segmento.origem === 'matched';
const latlngs = segmento.pontos.map(([lat, lng]) => [+lat, +lng]);
L.polyline(latlngs, {
  color: '#7C3AED',
  weight: 4,
  opacity: ajustado ? 0.9 : 0.72,
  dashArray: ajustado ? undefined : '8 5'
}).addTo(jornadaPolyline);
```

Contabilizar segmentos ajustados e brutos. Exibir `Rota ajustada às ruas` quando todos forem ajustados, `Rota parcialmente ajustada · trechos tracejados usam a Trilha GPS original` quando mistos e `Trilha GPS original · ajuste indisponível` quando só houver `raw`.

- [ ] **Step 5: Run map and syntax tests**

Run: `node tests\jornada-mapa.test.js`

Expected: `jornada-mapa.test.js passou`.

Run: `node tests\mapa-timeline.test.js`

Expected: `mapa-timeline.test.js passou`.

Run: `node --check api\jornadas.js`

Expected: exit code 0.

- [ ] **Step 6: Commit frontend rendering**

```powershell
git add index.html app/www/index.html tests/jornada-mapa.test.js
git commit -m "feat: display matched journey paths"
```

---

### Task 6: Verificação integrada e configuração de produção

**Files:**
- Modify only if required by a discovered regression: files already named in Tasks 1-5.
- No token or `.env` file is committed.

**Interfaces:**
- Consumes: `MAPBOX_ACCESS_TOKEN` configurado no ambiente Vercel.
- Produces: evidência automatizada e renderizada de que Galeria, layout e rota funcionam juntos.

- [ ] **Step 1: Run the complete focused suite**

```powershell
node tests\galeria-preview.test.js
node tests\validacao-ia-galeria.test.js
node tests\galeria-paginacao.test.js
node tests\mapa-layout.test.js
node tests\mapa-timeline.test.js
node tests\prospeccao-mapa-checkbox.test.js
node tests\map-match.test.mjs
node tests\jornada-api.test.js
node tests\jornada-mapa.test.js
node tests\jornada-integracao.test.js
```

Expected: cada comando imprime `passou` e encerra com código 0.

- [ ] **Step 2: Run syntax and repository checks**

```powershell
node --check api\_map-match.mjs
node --check api\jornadas.js
git diff --check
git status --short
```

Expected: sintaxe e whitespace sem erros; `git status` mostra somente artefatos locais previamente existentes (`.superpowers/`, `graphify-out/`, `skill-observations/`) ou mudanças intencionais ainda não commitadas.

- [ ] **Step 3: Configure the server-only production token**

Configurar `MAPBOX_ACCESS_TOKEN` nos ambientes necessários da Vercel. Confirmar com a listagem de variáveis que o nome existe, sem imprimir o valor. Não prefixar com `NEXT_PUBLIC_`, `VITE_` ou equivalente.

- [ ] **Step 4: Validate the rendered flow**

Com o Browser plugin e uma sessão autorizada:

1. abrir Galeria e rolar até uma grade de fotos;
2. confirmar que miniaturas aparecem antes de abrir o modal e que não há 401/404 no console;
3. abrir Mapa em 1440×900 e 1024×768;
4. escolher um promotor e o dia de uma jornada conhecida;
5. aplicar filtros e confirmar linha contínua acompanhando ruas;
6. verificar texto `Rota ajustada às ruas` ou, em falha induzida de token, `Trilha GPS original` com linha tracejada;
7. verificar que nenhuma linha liga jornadas ou lacunas superiores a 15 minutos;
8. confirmar ausência de sobreposição entre filtros, botões, card de km e mapa.

- [ ] **Step 5: Review request**

Usar `superpowers:requesting-code-review` para revisar aderência à especificação, segurança do token, fallback, paridade web/Android e cobertura de testes. Corrigir somente achados dentro deste escopo e repetir Steps 1, 2 e 4.

- [ ] **Step 6: Final commit only if verification required a scoped fix**

```powershell
git add api/_map-match.mjs api/jornadas.js index.html app/www/index.html tests/galeria-preview.test.js tests/mapa-layout.test.js tests/map-match.test.mjs tests/jornada-api.test.js tests/jornada-mapa.test.js
git commit -m "fix: address matched route verification"
```

Se nenhuma correção for necessária, não criar commit vazio.
