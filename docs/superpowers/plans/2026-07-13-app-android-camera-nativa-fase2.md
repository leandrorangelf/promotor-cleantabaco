# App Android do Promotor — Fase 2 (Câmera Nativa com EXIF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Trocar a captura de foto por câmera pelo plugin nativo `@capacitor/camera` quando o app roda dentro do Capacitor (Android), mantendo o comportamento atual (input de arquivo do navegador) inalterado quando roda como site normal.

**Architecture:** `index.html` (raiz) ganha uma checagem `Capacitor.isNativePlatform()` no botão "Tirar foto": se nativo, usa uma ponte JS (`camera-bridge.js`, gerada por bundle a partir de `@capacitor/camera`) carregada sob demanda; senão, mantém o `<input type="file" capture="environment">` de hoje. A lógica de redimensionar/carimbar/checar EXIF (hoje dentro de `processarFotos`) é extraída para uma função reaproveitável `processarImagemCapturada`, usada tanto pelo fluxo web quanto pelo nativo — sem duplicar regra de negócio.

**Tech Stack:** `@capacitor/camera` (plugin nativo), `esbuild` (bundler mínimo, só dentro de `app/`, para gerar o único arquivo `camera-bridge.js` que o `index.html` sabe carregar — sem isso o plugin não roda em uma página HTML sem build).

## Global Constraints

- Comportamento no navegador (site em produção) não pode mudar: quando `Capacitor` não existe no `window`, o app cai no fluxo atual (`fotoCameraInput`).
- Não duplicar a lógica de redimensionamento/carimbo/EXIF — extrair para uma função única usada pelos dois caminhos.
- Os testes existentes em `tests/exif-timestamp.test.js` e `tests/validacao-ia-galeria.test.js` fazem `assert.ok(html.includes(...))` contra `index.html` — os trechos exatos que eles procuram (`function lerExifDataOriginal(buffer)`, `carimbarDataHora(ctx, w, h)`, `origem === 'camera') carimbarDataHora`, `function criarFotoComMetadados`) precisam continuar existindo literalmente no arquivo após o refactor.
- `app/android/build/`, `app/android/.gradle/`, `app/android/app/build/`, `app/node_modules/` continuam fora do Git (já cobertos pelo `.gitignore` da Fase 1).
- Fluxo de atualização já estabelecido (ver Status da Fase 1): depois de mudar `index.html`/`manual.html`, copiar para `app/www/` e reaplicar a troca de `const API` para `https://promotor-cleantabaco.vercel.app`.
- Ao final da sessão, atualizar este arquivo marcando os checkboxes concluídos e commitar.

---

### Task 1: Extrair `processarImagemCapturada` de `processarFotos` (sem mudar comportamento)

**Files:**
- Modify: `index.html:2421-2446` (função `processarFotos`, ver linhas atuais abaixo)
- Test: `tests/exif-timestamp.test.js`, `tests/validacao-ia-galeria.test.js` (já existem — só rodar para confirmar que continuam passando)

**Interfaces:**
- Produces: `async function processarImagemCapturada(dataUrl, origem, exifDataExterna = null)` — usada pela Task 2 (fluxo nativo) e pelo `processarFotos` já existente (fluxo web). Assinatura: `dataUrl` (string, data URL da imagem), `origem` (`'camera'` ou `'galeria'`), `exifDataExterna` (`Date` ou `null`, data original já extraída do EXIF quando a origem é galeria).

Código atual de referência (não copiar, só para localizar o trecho a modificar):
```js
function processarFotos(event) {
  const origem = event.target.id === 'fotoCameraInput' ? 'camera' : 'galeria';
  Array.from(event.target.files).forEach(file => {
    const leituraExif = origem === 'galeria' ? file.arrayBuffer().then(lerExifDataOriginal).catch(() => null) : Promise.resolve(null);
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const max = 800;
        let w = img.width, h = img.height;
        if (w > max || h > max) { if (w > h) { h = h*max/w; w = max; } else { w = w*max/h; h = max; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        if (origem === 'camera') carimbarDataHora(ctx, w, h);
        const exifData = await leituraExif;
        fotos.push(await criarFotoComMetadados(canvas.toDataURL('image/jpeg', 0.7), origem, exifData));
        renderFotos();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}
```

- [x] **Step 1: Substituir a função por uma versão que extrai a lógica compartilhada**

Em `index.html`, substituir o bloco de `function processarFotos(event) {` até o `}` de fechamento (linhas 2421-2446) por:

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

function processarFotos(event) {
  const origem = event.target.id === 'fotoCameraInput' ? 'camera' : 'galeria';
  Array.from(event.target.files).forEach(file => {
    const leituraExif = origem === 'galeria' ? file.arrayBuffer().then(lerExifDataOriginal).catch(() => null) : Promise.resolve(null);
    const reader = new FileReader();
    reader.onload = async e => {
      const exifData = await leituraExif;
      await processarImagemCapturada(e.target.result, origem, exifData);
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}
```

- [x] **Step 2: Rodar os testes existentes para confirmar que nada quebrou**

```bash
for f in tests/*.test.js; do node "$f"; done
```
Expected: todos os arquivos rodam sem lançar erro (o runner atual só imprime saída em caso de falha do `assert.ok`; sem saída de erro = passou).

- [ ] **Step 3: Testar manualmente no navegador (site local ou já publicado)** — pendente, requer humano

Abrir o app do promotor no navegador, ir em "Nova visita" → seção Fotos, clicar "Tirar foto" (câmera do notebook/celular via navegador) e "Escolher da galeria". Confirmar que as fotos aparecem no grid como antes (carimbo de data/hora nas de câmera, aviso "Foto antiga?" quando aplicável nas de galeria).

- [x] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor: extrai processarImagemCapturada de processarFotos"
```

---

### Task 2: Adicionar o botão nativo (`Capacitor.isNativePlatform()`) e a ponte `camera-bridge.js`

**Files:**
- Modify: `index.html:1112` (botão "Tirar foto")
- Modify: `index.html` (adicionar funções `acionarCaptura`, `tirarFotoNativa`, `garantirCameraBridgeCarregada` logo após `processarImagemCapturada`)
- Create: `app/src/camera-bridge.js`
- Modify: `app/package.json` (scripts + devDependency `esbuild` + dependency `@capacitor/camera`)

**Interfaces:**
- Consumes: `processarImagemCapturada(dataUrl, origem, exifDataExterna)` da Task 1.
- Produces: `window.NativeCameraBridge = { getPhoto, CameraResultType, CameraSource }` (definido em `app/www/camera-bridge.js` após o build da Task 3), consumido por `tirarFotoNativa()`.

- [x] **Step 1: Trocar o botão "Tirar foto" para chamar `acionarCaptura()`**

Em `index.html:1112`, trocar:
```html
<button type="button" class="camera-btn primary" onclick="document.getElementById('fotoCameraInput').click()">Tirar foto</button>
```
por:
```html
<button type="button" class="camera-btn primary" onclick="acionarCaptura()">Tirar foto</button>
```

- [x] **Step 2: Adicionar as funções de captura nativa logo após `processarImagemCapturada`**

```js
let cameraBridgePromise = null;
function garantirCameraBridgeCarregada() {
  if (window.NativeCameraBridge) return Promise.resolve();
  if (cameraBridgePromise) return cameraBridgePromise;
  cameraBridgePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'camera-bridge.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('camera-bridge.js indisponivel'));
    document.head.appendChild(script);
  });
  return cameraBridgePromise;
}

function exifDataOriginalCamera(exif) {
  const bruta = exif && (exif.DateTimeOriginal || exif.DateTime);
  if (!bruta) return null;
  const iso = String(bruta).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const data = new Date(iso);
  return isNaN(data.getTime()) ? null : data;
}

async function tirarFotoNativa() {
  await garantirCameraBridgeCarregada();
  const { getPhoto, CameraResultType, CameraSource } = window.NativeCameraBridge;
  const foto = await getPhoto({
    quality: 80,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    saveToGallery: false
  });
  await processarImagemCapturada(foto.dataUrl, 'camera', exifDataOriginalCamera(foto.exif));
}

function acionarCaptura() {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    tirarFotoNativa().catch(e => toast('Erro ao acessar camera: ' + e.message));
  } else {
    document.getElementById('fotoCameraInput').click();
  }
}
```

- [x] **Step 3: Criar o código-fonte da ponte (fora de `www/`, vira input do bundle)**

Criar `app/src/camera-bridge.js`:
```js
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

window.NativeCameraBridge = {
  getPhoto: (opts) => Camera.getPhoto(opts),
  CameraResultType,
  CameraSource
};
```

- [x] **Step 4: Instalar `@capacitor/camera` e `esbuild`, adicionar script de build**

```powershell
cd app
npm install @capacitor/camera
npm install -D esbuild
```

Editar `app/package.json`, adicionando em `"scripts"`:
```json
"build:camera-bridge": "esbuild src/camera-bridge.js --bundle --format=iife --outfile=www/camera-bridge.js"
```

- [x] **Step 5: Commit**

```bash
git add index.html app/package.json app/package-lock.json app/src/camera-bridge.js
git commit -m "feat: adiciona captura nativa de foto via Capacitor.isNativePlatform()"
```

---

### Task 3: Gerar o bundle, sincronizar com o Android e testar no emulador

**Files:**
- Create: `app/www/camera-bridge.js` (gerado pelo `esbuild`, não editar manualmente)
- Modify: `app/www/index.html` (cópia atualizada da raiz + reaplicar `const API`)

**Interfaces:**
- Consumes: script `build:camera-bridge` da Task 2, `index.html` atualizado da Task 2.

- [x] **Step 1: Gerar o bundle da ponte**

```powershell
cd app
npm run build:camera-bridge
```
Expected: cria/atualiza `app/www/camera-bridge.js`.

- [x] **Step 2: Atualizar a cópia do front dentro do app**

```powershell
cd ..
Copy-Item index.html app\www\index.html -Force
```
Depois, em `app/www/index.html`, repetir a troca já feita na Fase 1:
```js
const API = '';
```
por:
```js
const API = 'https://promotor-cleantabaco.vercel.app';
```

- [x] **Step 3: Sincronizar com o projeto Android**

```powershell
cd app
npx cap sync android
```
Expected: saída terminando em `Sync finished`, sem erros, e `@capacitor/camera` listado entre os plugins encontrados.

- [ ] **Step 4: Rodar no Android Studio e testar a câmera nativa** — pendente, requer humano

Abrir o Android Studio (`npx cap open android` se não estiver aberto), rodar no emulador/celular (Run ▶). No app: login → Nova visita → seção Fotos → "Tirar foto".

Expected: abre a câmera nativa do Android (não mais um seletor de app genérico do navegador), tira a foto, volta pro app com a foto já processada aparecendo no grid com o carimbo de data/hora. Testar também "Escolher da galeria" (continua no fluxo antigo, sem mudança) para confirmar que nada quebrou.

Se o emulador não tiver câmera configurada, no AVD Manager > editar o dispositivo virtual > Camera > front/back = "Emulated" antes de testar.

- [x] **Step 5: Commit**

```bash
cd ..
git add app/www/index.html app/www/camera-bridge.js
git commit -m "feat: sincroniza camera nativa com o projeto Android"
```

---

### Task 4: Atualizar o plano com o status da Fase 2

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-app-android-camera-nativa-fase2.md` (este arquivo)

**Interfaces:** N/A.

- [x] **Step 1: Marcar todos os checkboxes concluídos neste arquivo**

- [x] **Step 2: Adicionar uma seção "Status" ao final do arquivo**

```markdown
## Status (atualizar a cada sessão)

- Fase 2 concluída em: <data>
- Câmera nativa (`@capacitor/camera`) funcionando no app Android; fluxo web (navegador) sem mudanças, confirmado pelos testes existentes e teste manual.
- Próxima fase: Fase 3 da spec (`docs/superpowers/specs/2026-07-13-app-android-promotor-design.md`) — GPS em background durante a rota do dia.
```

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-13-app-android-camera-nativa-fase2.md
git commit -m "docs: marca fase 2 do app Android (camera nativa) como concluida"
```

## Status (atualizar a cada sessão)

- Código da Fase 2 implementado e commitado em 2026-07-13 (Tasks 1-3, cada uma revisada por subagente, todas aprovadas sem findings Critical/Important). Testes automatizados (`tests/*.test.js`) passando, exceto uma falha pré-existente e não relacionada em `salvamento-rascunho.test.js`.
- **Pendente antes de considerar a Fase 2 realmente concluída:** teste manual real no Android Studio/emulador (Task 1 Step 3 e Task 3 Step 4) — nenhuma sessão de subagente teve acesso a navegador/emulador para validar visualmente. Alguém precisa: abrir o app no navegador e confirmar que "Tirar foto"/"Escolher da galeria" continuam idênticos a antes; depois rodar no Android Studio e confirmar que "Tirar foto" agora abre a câmera nativa do Android (não mais o seletor genérico do navegador) e que a foto capturada aparece no grid com o carimbo de data/hora.
- Próxima fase (depois da validação manual acima): Fase 3 da spec (`docs/superpowers/specs/2026-07-13-app-android-promotor-design.md`) — GPS em background durante a rota do dia.
