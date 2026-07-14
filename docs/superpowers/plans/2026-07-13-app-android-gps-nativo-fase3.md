# App Android do Promotor — Fase 3 (GPS Nativo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Trocar a captura de GPS feita ao salvar uma visita pelo plugin nativo `@capacitor/geolocation` quando o app roda dentro do Capacitor (Android), mantendo o comportamento atual (`navigator.geolocation`) inalterado quando roda como site normal no navegador.

**Architecture:** Mesmo padrão já usado e aprovado na Fase 2 (câmera nativa): `obterPosicaoAtual(opcoes, tentativa)` em `index.html` ganha uma checagem `Capacitor.isNativePlatform()` — se nativo, delega pra uma ponte JS (`geo-bridge.js`, gerada por bundle a partir de `@capacitor/geolocation`) carregada sob demanda; senão, mantém `navigator.geolocation.getCurrentPosition` de hoje. A lógica de retry entre tentativas (`capturarLocalizacaoAtual`) e de traduzir erro em mensagem (`montarErroLocalizacao`) não muda — só a fonte da posição.

**Tech Stack:** `@capacitor/geolocation` (plugin nativo oficial), `esbuild` (já usado na Fase 2 para gerar `camera-bridge.js`; mesmo processo pra `geo-bridge.js`).

## Global Constraints

- **Escopo reduzido, decidido com o usuário nesta sessão:** SEM rastreio contínuo em segundo plano durante o dia todo, SEM endpoint novo na API, SEM mudança em `api/rota-km.js`. Só a captura pontual de GPS que já existe (ao salvar uma visita) passa a usar o plugin nativo quando disponível.
- Comportamento no navegador (site em produção) não pode mudar: quando `window.Capacitor` não existe ou `isNativePlatform()` é falsy, o app cai no fluxo atual (`navigator.geolocation.getCurrentPosition`).
- Não duplicar a lógica de retry (`capturarLocalizacaoAtual`) nem a de tradução de erro (`montarErroLocalizacao`) — ambas continuam sendo usadas pelos dois caminhos (web e nativo).
- O teste `tests/gps-captura.test.js` faz `assert.ok(html.includes('function obterPosicaoAtual'))` — essa assinatura de função precisa continuar existindo literalmente em `index.html`.
- `app/android/build/`, `app/android/.gradle/`, `app/android/app/build/`, `app/node_modules/` continuam fora do Git.
- Fluxo de atualização já estabelecido (Fases 1 e 2): depois de mudar `index.html`, copiar para `app/www/index.html` e reaplicar a troca de `const API` para `https://promotor-cleantabaco.vercel.app`.
- Ao final da sessão, atualizar este arquivo marcando os checkboxes concluídos e commitar.

---

### Task 1: Adicionar o caminho nativo em `obterPosicaoAtual` e a ponte `geo-bridge.js`

**Files:**
- Modify: `index.html:1653-1673` (função `obterPosicaoAtual`, ver código atual de referência abaixo)
- Create: `app/src/geo-bridge.js`
- Modify: `app/package.json` (script `build:geo-bridge` + dependency `@capacitor/geolocation`)
- Test: `tests/gps-captura.test.js` (já existe — só rodar para confirmar que continua passando)

**Interfaces:**
- Produces: `window.NativeGeoBridge = { getCurrentPosition }` (definido em `app/www/geo-bridge.js` após o build da Task 2), consumido por `obterPosicaoNativa()`.

Código atual de referência (não copiar, só para localizar o trecho a modificar):
```js
function obterPosicaoAtual(opcoes, tentativa) {
  const capturadoEm = new Date().toISOString();
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        ok: true,
        tentado: true,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        precisao: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        velocidade: pos.coords.speed,
        direcao: pos.coords.heading,
        tentativa,
        capturadoEm: new Date(pos.timestamp || Date.now()).toISOString()
      }),
      err => resolve(montarErroLocalizacao(err, capturadoEm, tentativa)),
      opcoes
    );
  });
}
```

- [x] **Step 1: Substituir `obterPosicaoAtual` por uma versão que decide entre web e nativo**

Em `index.html`, substituir o bloco de `function obterPosicaoAtual(opcoes, tentativa) {` até o `}` de fechamento (linhas 1653-1673) por:

```js
let geoBridgePromise = null;
function garantirGeoBridgeCarregada() {
  if (window.NativeGeoBridge) return Promise.resolve();
  if (geoBridgePromise) return geoBridgePromise;
  geoBridgePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'geo-bridge.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('geo-bridge.js indisponivel'));
    document.head.appendChild(script);
  });
  return geoBridgePromise;
}

async function obterPosicaoNativa(opcoes, tentativa) {
  const capturadoEm = new Date().toISOString();
  try {
    await garantirGeoBridgeCarregada();
    const pos = await window.NativeGeoBridge.getCurrentPosition({
      enableHighAccuracy: opcoes.enableHighAccuracy,
      timeout: opcoes.timeout,
      maximumAge: opcoes.maximumAge
    });
    return {
      ok: true,
      tentado: true,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      precisao: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      velocidade: pos.coords.speed,
      direcao: pos.coords.heading,
      tentativa,
      capturadoEm: new Date(pos.timestamp || Date.now()).toISOString()
    };
  } catch (err) {
    const mensagem = err?.message || '';
    const codigo = /denied|permiss/i.test(mensagem) ? 1 : /timeout/i.test(mensagem) ? 3 : 2;
    return montarErroLocalizacao({ message: mensagem, code: codigo }, capturadoEm, tentativa);
  }
}

function obterPosicaoAtual(opcoes, tentativa) {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    return obterPosicaoNativa(opcoes, tentativa);
  }
  const capturadoEm = new Date().toISOString();
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        ok: true,
        tentado: true,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        precisao: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        velocidade: pos.coords.speed,
        direcao: pos.coords.heading,
        tentativa,
        capturadoEm: new Date(pos.timestamp || Date.now()).toISOString()
      }),
      err => resolve(montarErroLocalizacao(err, capturadoEm, tentativa)),
      opcoes
    );
  });
}
```

- [x] **Step 2: Criar o código-fonte da ponte**

Criar `app/src/geo-bridge.js`:
```js
import { Geolocation } from '@capacitor/geolocation';

window.NativeGeoBridge = {
  getCurrentPosition: (opts) => Geolocation.getCurrentPosition(opts)
};
```

- [x] **Step 3: Instalar `@capacitor/geolocation` e adicionar o script de build**

```powershell
cd app
npm install @capacitor/geolocation
```

Editar `app/package.json`, adicionando em `"scripts"` (ao lado de `build:camera-bridge`, já existente da Fase 2):
```json
"build:geo-bridge": "esbuild src/geo-bridge.js --bundle --format=iife --outfile=www/geo-bridge.js"
```

- [x] **Step 4: Rodar os testes existentes para confirmar que nada quebrou**

```bash
for f in tests/*.test.js; do node "$f"; done
```
Expected: mesmo resultado de antes desta mudança (incluindo a falha pré-existente e não relacionada em `tests/salvamento-rascunho.test.js`); `tests/gps-captura.test.js` continua passando.

- [x] **Step 5: Commit**

```bash
git add index.html app/package.json app/package-lock.json app/src/geo-bridge.js
git commit -m "feat: adiciona captura nativa de GPS via Capacitor.isNativePlatform()"
```

---

### Task 2: Gerar o bundle, sincronizar com o Android e testar

**Files:**
- Create: `app/www/geo-bridge.js` (gerado pelo `esbuild`, não editar manualmente)
- Modify: `app/www/index.html` (cópia atualizada da raiz + reaplicar `const API`)

**Interfaces:**
- Consumes: script `build:geo-bridge` e `index.html` atualizado da Task 1.

- [x] **Step 1: Gerar o bundle da ponte**

```powershell
cd app
npm run build:geo-bridge
```
Expected: cria/atualiza `app/www/geo-bridge.js`.

- [x] **Step 2: Atualizar a cópia do front dentro do app**

```powershell
cd ..
Copy-Item index.html app\www\index.html -Force
```
Depois, em `app/www/index.html`, repetir a troca já feita nas fases anteriores:
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
Expected: saída terminando em `Sync finished`, sem erros, e `@capacitor/geolocation` listado entre os plugins encontrados.

- [x] **Step 4: Conferir que a permissão de localização foi adicionada ao Android**

```powershell
Get-Content android\app\src\main\AndroidManifest.xml | Select-String "LOCATION"
```
Expected: `ACCESS_COARSE_LOCATION` e/ou `ACCESS_FINE_LOCATION` aparecem.

**Correção pós-teste manual (2026-07-14):** ao testar no emulador, a captura falhava com "permissão negada" sem nunca exibir o diálogo nativo. Causa: `@capacitor/geolocation` declara a permissão via anotação Kotlin no plugin, mas isso não é suficiente — o Android só solicita/concede a permissão em runtime se ela também estiver declarada em `<uses-permission>` no `AndroidManifest.xml` do próprio app (`cap sync` não adiciona isso automaticamente). Corrigido adicionando manualmente em `app/android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```
Esse arquivo é código-fonte versionado (não é artefato de build), então a edição manual é definitiva e não é sobrescrita por `cap sync`.

- [x] **Step 5: Rodar no Android Studio e testar a captura de GPS** — confirmado: pediu permissão nativa e capturou o GPS corretamente

Abrir o Android Studio (`npx cap open android` se não estiver aberto), rodar no emulador/celular (Run ▶). No app: login → Nova visita → preencher e salvar (o app mostra "Capturando GPS... aguarde").

Expected: o Android pede permissão de localização (se ainda não concedida) via diálogo nativo do sistema (não mais o prompt do navegador); depois de conceder, a visita salva com GPS igual a antes. Testar também negar a permissão uma vez, para confirmar que aparece a mensagem de erro adequada ("Permissao de GPS negada neste aparelho") em vez de travar.

Se o emulador não tiver localização configurada, no Android Studio usar o painel "Extended Controls" (⋮) → Location → definir uma coordenada antes de testar.

- [x] **Step 6: Testar manualmente no navegador (site local ou já publicado)** — confirmado: captura de GPS continua igual a antes

Abrir o app do promotor no navegador, salvar uma visita normalmente. Confirmar que a captura de GPS continua idêntica a antes (usa `navigator.geolocation`, sem diferença perceptível).

- [x] **Step 7: Commit**

```bash
cd ..
git add app/www/index.html app/www/geo-bridge.js
git commit -m "feat: sincroniza GPS nativo com o projeto Android"
```

---

### Task 3: Atualizar o plano com o status da Fase 3

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-app-android-gps-nativo-fase3.md` (este arquivo)

**Interfaces:** N/A.

- [x] **Step 1: Marcar todos os checkboxes concluídos neste arquivo**

- [x] **Step 2: Adicionar uma seção "Status" ao final do arquivo**

```markdown
## Status (atualizar a cada sessão)

- Fase 3 concluída em: 2026-07-14. Código implementado, revisado por subagente (2 tasks aprovadas sem findings Critical/Important) e validado manualmente: no Android Studio/emulador, salvar visita agora pede a permissão nativa de localização e captura o GPS corretamente; no navegador, a captura continua idêntica a antes.
- Bug encontrado e corrigido durante o teste manual (não pego pela revisão de código, só apareceu rodando de verdade no device): `@capacitor/geolocation` declara a permissão via anotação Kotlin no plugin, mas isso não bastava — o Android só concede a permissão em runtime se ela também estiver em `<uses-permission>` no `AndroidManifest.xml` do app. Sem isso, a captura falhava com "permissão negada" sem nunca exibir o diálogo. Corrigido adicionando `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` manualmente em `app/android/app/src/main/AndroidManifest.xml` (arquivo versionado, não é sobrescrito por `cap sync`).
- Escopo reduzido nesta fase (decidido com o usuário): sem rastreio contínuo em background durante o dia — só a captura pontual passou a ser nativa. Rastreio contínuo, se desejado no futuro, exigiria endpoint novo na API e um plugin de background location, avaliar como fase separada.
- Próxima fase: Fase 4 da spec (`docs/superpowers/specs/2026-07-13-app-android-promotor-design.md`) — push notifications (`@capacitor/push-notifications` + Firebase Cloud Messaging), incluindo endpoint novo em `api/` para registrar token do device.
```

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-13-app-android-gps-nativo-fase3.md
git commit -m "docs: marca fase 3 do app Android (gps nativo) como concluida"
```
