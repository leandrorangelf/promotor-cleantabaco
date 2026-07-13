# App Android do Promotor — Fase 1 (Bootstrap Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o projeto Capacitor em `app/`, empacotando o `index.html` atual como app Android instalável, sem alterar o comportamento existente (câmera/GPS continuam via API web dentro da webview nesta fase).

**Architecture:** Projeto Capacitor isolado em `app/`, com `app/www/` contendo uma cópia do front do promotor e `app/android/` como o projeto Android gerado pelo Capacitor CLI. Nenhum arquivo fora de `app/` é modificado.

**Tech Stack:** Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`), Node.js (já instalado, v24.18.0), Android Studio + JDK (a instalar).

## Global Constraints

- Não modificar `index.html`, `gestor.html`, `api/*.js`, `bonus.js`, `performance.js`, `tests/*` — tudo isso fica fora de `app/`.
- Escopo desta fase: só Android. Sem iOS, sem Windows, sem gestor.html (ver spec `docs/superpowers/specs/2026-07-13-app-android-promotor-design.md`).
- Artefatos de build do Android (`app/android/build/`, `app/android/.gradle/`, `app/android/app/build/`) não entram no Git.
- Nenhuma mudança em `api/*.js` nesta fase (só ocorre na Fase 4, push notifications).
- Ao final da sessão, atualizar este arquivo marcando os checkboxes concluídos e commitar — é o que dá continuidade entre sessões (inclusive para o Codex).

---

### Task 1: Pré-requisitos de ambiente (Android Studio + JDK)

**Files:** nenhum arquivo de código — só verificação de ambiente.

**Interfaces:** N/A (task de setup).

- [ ] **Step 1: Verificar se o Android Studio já está instalado**

Rodar no PowerShell:
```powershell
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
```
Expected: `True` se já instalado, `False` caso contrário.

- [ ] **Step 2: Instalar Android Studio, se necessário**

Se o passo anterior deu `False`: baixar e instalar o Android Studio em https://developer.android.com/studio (inclui JDK embutido e Android SDK). Durante a instalação, aceitar a criação do SDK padrão (API mais recente).

- [ ] **Step 3: Confirmar variável de ambiente ANDROID_HOME**

Rodar:
```powershell
$env:ANDROID_HOME
```
Expected: caminho tipo `C:\Users\<user>\AppData\Local\Android\Sdk`. Se vazio, configurar em "Editar variáveis de ambiente do sistema" apontando para a pasta do SDK (a mesma do Step 1).

- [ ] **Step 4: Confirmar que existe pelo menos um emulador Android configurado**

Abrir Android Studio → Device Manager → criar um dispositivo virtual (ex.: Pixel 6, API 34), se ainda não existir nenhum.

---

### Task 2: Scaffold do projeto Capacitor em `app/`

**Files:**
- Create: `app/package.json`
- Create: `app/capacitor.config.json`
- Create: `app/www/index.html` (cópia do `index.html` da raiz, sem alterações)
- Modify: `.gitignore` (raiz do repo)

**Interfaces:**
- Produces: pasta `app/` com projeto Node inicializado e Capacitor configurado, consumida pela Task 3 (que adiciona a plataforma Android).

- [ ] **Step 1: Criar a pasta e inicializar o projeto Node**

```powershell
mkdir app
cd app
npm init -y
```
Expected: `app/package.json` criado.

- [ ] **Step 2: Instalar Capacitor core e CLI**

```powershell
npm install @capacitor/core
npm install -D @capacitor/cli
```
Expected: `app/node_modules/@capacitor` existe; `app/package.json` lista as duas dependências.

- [ ] **Step 3: Inicializar a config do Capacitor**

```powershell
npx cap init "Promotor Cleantabaco" "com.cleantabaco.promotor" --web-dir www
```
Expected: cria `app/capacitor.config.json` com `appId: "com.cleantabaco.promotor"`, `appName: "Promotor Cleantabaco"`, `webDir: "www"`.

- [ ] **Step 4: Copiar o front atual para `app/www/`**

```powershell
mkdir www
Copy-Item ..\index.html www\index.html
```
(Se `index.html` referenciar outros arquivos JS/CSS locais, copiar também — verificar `<script src=` e `<link href=` no arquivo antes de copiar.)

Expected: `app/www/index.html` existe e é idêntico ao `index.html` da raiz.

- [ ] **Step 5: Ignorar artefatos de build do Android no Git**

Editar `.gitignore` na raiz do repo, adicionando ao final:
```
# Capacitor Android build artifacts
app/android/build/
app/android/app/build/
app/android/.gradle/
app/node_modules/
```

- [ ] **Step 6: Commit do scaffold**

```powershell
cd ..
git add app/package.json app/package-lock.json app/capacitor.config.json app/www/index.html .gitignore
git commit -m "feat: bootstrap projeto Capacitor do app Android do promotor"
```
Expected: commit criado, sem incluir `app/node_modules/`.

---

### Task 3: Adicionar a plataforma Android e rodar no emulador

**Files:**
- Create: `app/android/` (gerado pelo Capacitor CLI, não editado manualmente)

**Interfaces:**
- Consumes: `app/capacitor.config.json` e `app/www/index.html` da Task 2.
- Produces: app instalável no emulador Android, ponto de partida para as fases seguintes (câmera nativa, GPS background, push, offline).

- [ ] **Step 1: Instalar o pacote da plataforma Android**

```powershell
cd app
npm install @capacitor/android
```
Expected: `@capacitor/android` listado em `app/package.json`.

- [ ] **Step 2: Adicionar a plataforma**

```powershell
npx cap add android
```
Expected: pasta `app/android/` criada com projeto Gradle completo.

- [ ] **Step 3: Sincronizar o web assets com o projeto Android**

```powershell
npx cap sync android
```
Expected: saída terminando em `Sync finished`, sem erros.

- [ ] **Step 4: Abrir no Android Studio e rodar no emulador**

```powershell
npx cap open android
```
No Android Studio: selecionar o dispositivo virtual criado na Task 1 e clicar em Run (▶).

Expected: o app abre no emulador mostrando a mesma tela de login/UI do `index.html` atual. Testar manualmente: login funciona, navegação entre telas funciona (mesmo comportamento do site hoje).

- [ ] **Step 5: Commit do projeto Android gerado**

```powershell
cd ..
git add app/android --force-exclude app/android/build app/android/.gradle
```
(Se o comando acima não existir na sua versão de Git, adicionar manualmente evitando as pastas de build já cobertas pelo `.gitignore`:)
```powershell
git add app/android
git status
```
Confirmar no `git status` que `app/android/build/`, `app/android/.gradle/` e `app/android/app/build/` **não aparecem** como staged (o `.gitignore` da Task 2 deve bloqueá-los).

```powershell
git commit -m "feat: adiciona plataforma Android ao projeto Capacitor"
```

---

### Task 4: Atualizar o plano com o status da Fase 1

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-app-android-promotor-fase1.md` (este arquivo)

**Interfaces:** N/A.

- [ ] **Step 1: Marcar todos os checkboxes concluídos neste arquivo**

Editar este arquivo marcando `- [x]` em cada step efetivamente executado e testado.

- [ ] **Step 2: Adicionar uma seção "Status" ao final do arquivo**

Adicionar ao final deste arquivo:
```markdown
## Status (atualizar a cada sessão)

- Fase 1 concluída em: <data>
- App roda no emulador Android com o front atual, sem mudanças de comportamento.
- Próxima fase: Fase 2 da spec (`@capacitor/camera` com EXIF nativo) — ver `docs/superpowers/specs/2026-07-13-app-android-promotor-design.md`.
```

- [ ] **Step 3: Commit da atualização de status**

```powershell
git add docs/superpowers/plans/2026-07-13-app-android-promotor-fase1.md
git commit -m "docs: marca fase 1 do app Android como concluida"
```
