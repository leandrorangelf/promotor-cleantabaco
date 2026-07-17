# GPS contínuo da jornada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar automaticamente a localização do promotor em segundo plano, de segunda a sexta das 08:00 às 18:00 em `America/Sao_Paulo`, com fila offline e trilha visível para o gestor.

**Architecture:** Um serviço Android nativo em primeiro plano (`ForegroundService`) coleta pontos via Fused Location Provider e recebe comandos de uma ponte Capacitor. `AlarmManager` agenda início/fim e `BOOT_COMPLETED` restaura a programação. A API Vercel persiste jornadas e pontos com idempotência; a WebView apenas apresenta estado e controles.

**Tech Stack:** Android Java, Capacitor 8, Google Play Services Location, Neon PostgreSQL, HTML/JavaScript existente, testes Node por inspeção de contratos.

## Global Constraints

- O rastreamento contínuo existe somente no app Android; o site mantém apenas o GPS pontual de visitas.
- A coleta funciona somente de segunda a sexta, 08:00–18:00, no fuso `America/Sao_Paulo`.
- O serviço foreground deve declarar tipo `location`, notificação persistente e permissões de localização em segundo plano.
- Pontos devem conter `pontoId`, latitude, longitude, precisão, altitude, velocidade, direção e `capturadoEm`.
- O envio ocorre em lotes de no máximo 50 pontos; a fila offline retém no máximo 24 horas.
- `POST /api/jornada-pontos` deve ser idempotente por `(jornada_id, ponto_id)`.
- Não alterar o comportamento do GPS web em `obterPosicaoAtual`.
- Não incluir artefatos `app/android/build`, `app/android/.gradle`, `app/android/app/build` ou `app/node_modules` no Git.
- Cada tarefa termina com teste próprio; não declarar conclusão sem `node --check`, testes Node e `assembleDebug` quando aplicável.

---

### Task 1: Especificar e testar o contrato de jornada na API

**Files:**
- Create: `api/jornada-iniciar.js`
- Create: `api/jornada-pontos.js`
- Create: `api/jornada-encerrar.js`
- Create: `api/jornadas.js`
- Create: `tests/jornada-api.test.js`

**Interfaces:**
- Consumes: `autenticar(req)` de `api/_auth.js` e `DATABASE_URL`.
- Produces: os quatro endpoints descritos na spec, com respostas JSON estáveis para o app e o gestor.

- [ ] **Step 1: Escrever o teste de contrato que falha**

Criar `tests/jornada-api.test.js` para ler os quatro handlers e exigir método, autenticação, criação das tabelas, validação de jornada e idempotência:

```js
const assert = require('assert');
const fs = require('fs');

for (const arquivo of ['jornada-iniciar.js', 'jornada-pontos.js', 'jornada-encerrar.js', 'jornadas.js']) {
  const codigo = fs.readFileSync(`api/${arquivo}`, 'utf8');
  assert.ok(codigo.includes('autenticar(req)'), `${arquivo} deve autenticar o request`);
  assert.ok(codigo.includes('CREATE TABLE IF NOT EXISTS'), `${arquivo} deve garantir as tabelas`);
}

const pontos = fs.readFileSync('api/jornada-pontos.js', 'utf8');
assert.ok(pontos.includes('ponto_id'), 'pontos devem ter chave idempotente');
assert.ok(pontos.includes('ON CONFLICT'), 'lote de pontos deve ser idempotente');
assert.ok(pontos.includes('jornada_id'), 'pontos devem pertencer a uma jornada');

const iniciar = fs.readFileSync('api/jornada-iniciar.js', 'utf8');
assert.ok(iniciar.includes('America/Sao_Paulo'), 'início deve usar o fuso da operação');
console.log('jornada-api.test.js passou');
```

- [ ] **Step 2: Rodar o teste para confirmar que falha pelo motivo correto**

Executar `node tests\jornada-api.test.js`. Esperado: falha porque os handlers ainda não existem.

- [ ] **Step 3: Implementar `jornada-iniciar.js`**

Criar a tabela `jornadas` com `id`, `promotor`, `data_local`, `status`, `dispositivo_id`, `iniciado_em`, `encerrado_em`, `motivo_encerramento` e timestamps. Aceitar somente `POST`, autenticar o token, derivar o promotor de `sessao.nome`, normalizar a data no fuso `America/Sao_Paulo` e usar `UNIQUE (promotor, data_local)` para retornar a jornada existente em chamadas repetidas.

- [ ] **Step 4: Implementar `jornada-pontos.js`**

Criar `jornada_pontos` com `jornada_id`, `promotor`, `ponto_id`, campos numéricos, `capturado_em` e `recebido_em`, com `UNIQUE (jornada_id, ponto_id)`. Validar lote array com no máximo 50 itens, coordenadas finitas, precisão não negativa e jornada aberta do mesmo promotor. Inserir com `ON CONFLICT DO NOTHING` e retornar contagens `aceitos`, `duplicados` e `rejeitados`.

- [ ] **Step 5: Implementar `jornada-encerrar.js` e `jornadas.js`**

Encerrar de forma idempotente, aceitar `motivo`, e permitir consulta somente a gestor/coordenador/diretoria. Para coordenador, filtrar promotores sob sua coordenação como fazem os handlers existentes. A consulta deve retornar jornadas e pontos agrupados por jornada, com filtros de período e promotor.

- [ ] **Step 6: Rodar testes e sintaxe**

Executar `node tests\jornada-api.test.js`, `node --check api\jornada-iniciar.js`, `node --check api\jornada-pontos.js`, `node --check api\jornada-encerrar.js` e `node --check api\jornadas.js`. Esperado: tudo passa.

- [ ] **Step 7: Commit**

```powershell
git add api/jornada-iniciar.js api/jornada-pontos.js api/jornada-encerrar.js api/jornadas.js tests/jornada-api.test.js
git commit -m "feat: adiciona API de jornadas e pontos de GPS"
```

### Task 2: Criar o serviço Android foreground e a fila offline

**Files:**
- Modify: `app/android/app/build.gradle`
- Modify: `app/android/app/src/main/AndroidManifest.xml`
- Create: `app/android/app/src/main/java/com/cleantabaco/promotor/JornadaForegroundService.java`
- Create: `app/android/app/src/main/java/com/cleantabaco/promotor/JornadaStorage.java`
- Create: `app/android/app/src/main/java/com/cleantabaco/promotor/JornadaApiClient.java`
- Create: `app/android/app/src/test/java/com/cleantabaco/promotor/JornadaStorageTest.java`
- Create: `tests/jornada-android.test.js`

**Interfaces:**
- Consumes: token, `jornadaId` e comandos enviados pela ponte.
- Produces: serviço que coleta a cada 60 segundos ou 50 metros, persiste pontos pendentes e envia lotes de 50.

- [ ] **Step 1: Escrever teste textual de permissões e serviço**

Exigir no manifesto `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, o service com `foregroundServiceType="location"` e as classes do serviço/storage.

- [ ] **Step 2: Rodar o teste para confirmar falha**

Executar `node tests\jornada-android.test.js`. Esperado: falha porque os elementos ainda não existem.

- [ ] **Step 3: Adicionar dependência e permissões**

Adicionar `implementation "com.google.android.gms:play-services-location:21.3.0"`, declarar o serviço exportado como `false`, receiver de boot e permissões no `AndroidManifest.xml`. Manter as permissões pontuais já existentes.

- [ ] **Step 4: Implementar `JornadaStorage`**

Usar SQLite local com tabela `fila_pontos`, chave primária `(jornada_id, ponto_id)`, payload JSON, timestamp e tentativas. Implementar `enfileirar`, `listarLote(limit=50)`, `removerConfirmados`, `contarPendentes` e `removerMaisAntigosQue(24h)`.

- [ ] **Step 5: Implementar `JornadaApiClient`**

Usar `HttpURLConnection` ou cliente já disponível, enviar `Authorization: Bearer`, `Content-Type: application/json`, timeout de 15 segundos e interpretar `aceitos`/`duplicados` como confirmação para remoção da fila. Erros de rede não devem derrubar o serviço.

- [ ] **Step 6: Implementar `JornadaForegroundService`**

Criar canal de notificação, chamar `startForeground`, obter `FusedLocationProviderClient`, solicitar updates com intervalo de 60s, menor intervalo de 30s e deslocamento mínimo de 50m, converter cada `Location` para o contrato, enfileirar, tentar flush em lotes e parar com `stopSelf()` no comando de encerramento. Se a permissão for revogada, registrar estado `permissao_ausente` e manter a notificação explicativa.

- [ ] **Step 7: Implementar testes locais de fila**

Testar inserção, deduplicação, limite 50, remoção confirmada e expiração de 24h em `JornadaStorageTest.java`.

- [ ] **Step 8: Rodar testes e build**

Executar `node tests\jornada-android.test.js` e `cd app\android; .\gradlew.bat testDebugUnitTest`. Esperado: testes verdes.

- [ ] **Step 9: Commit**

```powershell
git add app/android/app/build.gradle app/android/app/src/main app/android/app/src/test tests/jornada-android.test.js
git commit -m "feat: adiciona servico foreground e fila offline de GPS"
```

### Task 3: Agendar automaticamente 08h–18h e restaurar após reboot

**Files:**
- Create: `app/android/app/src/main/java/com/cleantabaco/promotor/JornadaScheduler.java`
- Create: `app/android/app/src/main/java/com/cleantabaco/promotor/JornadaBootReceiver.java`
- Modify: `app/android/app/src/main/AndroidManifest.xml`
- Create: `app/android/app/src/test/java/com/cleantabaco/promotor/JornadaSchedulerTest.java`
- Create: `tests/jornada-agendamento.test.js`

**Interfaces:**
- Consumes: `JornadaForegroundService` e o fuso `America/Sao_Paulo`.
- Produces: alarmes de início e fim, sem coleta fora da janela.

- [ ] **Step 1: Escrever teste de janela**

O teste deverá exigir `08`, `18`, `America/Sao_Paulo`, `MONDAY`–`FRIDAY`, `BOOT_COMPLETED` e chamadas de cancelamento do serviço.

- [ ] **Step 2: Rodar teste em vermelho**

Executar `node tests\jornada-agendamento.test.js`. Esperado: falha pela ausência do scheduler/receiver.

- [ ] **Step 3: Implementar cálculo de próxima ocorrência**

Usar `java.time.ZonedDateTime` com `ZoneId.of("America/Sao_Paulo")`; ignorar sábado/domingo; calcular próxima ocorrência de 08:00 e 18:00 e usar `AlarmManager.setAndAllowWhileIdle`. Se o Android exigir permissão de alarme exato, usar o fallback inexacto sem bloquear o fluxo.

- [ ] **Step 4: Implementar receiver**

No alarme de início, iniciar jornada e serviço apenas em dia útil; no alarme de fim, enviar fila, encerrar jornada e parar serviço. No `BOOT_COMPLETED`, apenas reagendar e, se o horário atual estiver dentro da janela, restaurar o serviço.

- [ ] **Step 5: Testar e compilar**

Executar `node tests\jornada-agendamento.test.js` e `cd app\android; .\gradlew.bat testDebugUnitTest assembleDebug`.

- [ ] **Step 6: Commit**

```powershell
git add app/android/app/src/main app/android/app/src/test tests/jornada-agendamento.test.js
git commit -m "feat: agenda jornada GPS automaticamente em dias uteis"
```

### Task 4: Expor comandos e estado pela ponte Capacitor

**Files:**
- Modify: `app/android/app/src/main/java/com/cleantabaco/promotor/MainActivity.java`
- Create: `app/android/app/src/main/java/com/cleantabaco/promotor/JornadaPlugin.java`
- Create: `app/src/jornada-bridge.js`
- Modify: `app/package.json`
- Create: `tests/jornada-bridge.test.js`

**Interfaces:**
- Consumes: scheduler, service e armazenamento local.
- Produces: `window.NativeJornadaBridge` com `estado`, `iniciar`, `parar`, `sincronizar` e `agendar`.

- [ ] **Step 1: Escrever teste de contrato da ponte**

Exigir no bridge os cinco métodos, no `package.json` o script `build:jornada-bridge`, e no plugin os métodos Capacitor `getStatus`, `start`, `stop`, `flush` e `schedule`.

- [ ] **Step 2: Rodar em vermelho**

Executar `node tests\jornada-bridge.test.js`. Esperado: falha porque o bridge e plugin ainda não existem.

- [ ] **Step 3: Implementar plugin e registrar no `MainActivity`**

Criar plugin Capacitor com chamadas para o service, registrar com `registerPlugin`, validar permissões antes de iniciar e retornar estado serializável: `status`, `jornadaId`, `ultimoPontoEm`, `ultimaSincronizacaoEm`, `pendentes` e `motivo`.

- [ ] **Step 4: Implementar e gerar `jornada-bridge.js`**

Criar `app/src/jornada-bridge.js` importando o plugin e expondo o objeto global. Adicionar script `build:jornada-bridge` com esbuild e rodar `npm run build:jornada-bridge`.

- [ ] **Step 5: Rodar testes e sync**

Executar `node tests\jornada-bridge.test.js`, `npm run build:jornada-bridge` em `app` e `npx cap sync android`. Esperado: plugin listado e bundle gerado em `app/www/jornada-bridge.js`.

- [ ] **Step 6: Commit**

```powershell
git add app/android/app/src/main/java app/src/jornada-bridge.js app/www/jornada-bridge.js app/package.json app/package-lock.json tests/jornada-bridge.test.js
git commit -m "feat: expõe controle da jornada GPS pela ponte Capacitor"
```

### Task 5: Integrar o estado automático na interface do promotor

**Files:**
- Modify: `index.html`
- Modify: `app/www/index.html`
- Create: `tests/jornada-ui.test.js`

**Interfaces:**
- Consumes: `window.NativeJornadaBridge` e `authToken`/`usuarioAtual` existentes.
- Produces: cartão de status no painel, comandos manuais e mensagens de permissão/sincronização.

- [ ] **Step 1: Escrever teste de UI em vermelho**

Exigir ids `jornadaStatus`, `jornadaUltimoPonto`, `jornadaPendentes`, função `inicializarJornada`, função `atualizarStatusJornada`, chamada ao login e fallback explícito para navegador.

- [ ] **Step 2: Rodar teste em vermelho**

Executar `node tests\jornada-ui.test.js`. Esperado: falha pela ausência do cartão e funções.

- [ ] **Step 3: Adicionar cartão e funções**

Adicionar o cartão ao painel do promotor com estados “Ativo”, “Fora do horário”, “Permissão ausente”, “Sem rede” e “Parado manualmente”. No login, carregar estado e agendamento; atualizar o cartão após cada mudança e em um polling leve de 60 segundos enquanto a tela estiver aberta.

- [ ] **Step 4: Adicionar controle manual seguro**

Exibir “Parar rastreamento” somente quando ativo, exigir confirmação e mostrar “Iniciar agora” apenas como override do horário, mantendo auditoria do motivo. O logout deve chamar `parar` somente se houver jornada ativa manualmente iniciada; o alarme segue controlando o ciclo normal.

- [ ] **Step 5: Manter fallback web**

Quando `Capacitor.isNativePlatform()` for falso, esconder os controles nativos e não executar bridge; `obterPosicaoAtual` permanece exatamente no fluxo atual.

- [ ] **Step 6: Sincronizar e testar**

Executar `node tests\jornada-ui.test.js`, `node tests\gps-captura.test.js`, `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1`, `cd app; npx cap copy android`.

- [ ] **Step 7: Commit**

```powershell
git add index.html app/www/index.html tests/jornada-ui.test.js
git commit -m "feat: mostra estado da jornada GPS no painel do promotor"
```

### Task 6: Adicionar trilha ao mapa do gestor

**Files:**
- Modify: `index.html`
- Modify: `app/www/index.html`
- Create: `tests/jornada-mapa.test.js`

**Interfaces:**
- Consumes: `GET /api/jornadas`.
- Produces: filtro de período/promotor, linha Leaflet por jornada, lacunas visíveis e legenda separando trilha de visitas.

- [ ] **Step 1: Escrever teste em vermelho**

Exigir `carregarJornadasMapa`, `jornadaPolyline`, filtros de data/promotor, chamada a `/api/jornadas` e mensagem para dados ausentes.

- [ ] **Step 2: Rodar teste em vermelho**

Executar `node tests\jornada-mapa.test.js`. Esperado: falha pela ausência da camada.

- [ ] **Step 3: Implementar consulta e renderização**

Reutilizar o mapa Leaflet já carregado, remover a polyline anterior, agrupar pontos por jornada e desenhar segmentos apenas entre pontos consecutivos válidos. Não interpolar lacunas; mostrar tooltip com promotor, horário, precisão e quantidade de pontos pendentes quando aplicável.

- [ ] **Step 4: Implementar filtros e permissões**

Aplicar os mesmos filtros de promotor/coordenador existentes, não renderizar jornadas fora da autorização retornada pela API e mostrar estado vazio quando não houver pontos.

- [ ] **Step 5: Testar e sincronizar**

Executar `node tests\jornada-mapa.test.js`, `node tests\mapa-timeline.test.js`, `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1` e `cd app; npx cap copy android`.

- [ ] **Step 6: Commit**

```powershell
git add index.html app/www/index.html tests/jornada-mapa.test.js
git commit -m "feat: exibe trilha continua da jornada no mapa do gestor"
```

### Task 7: Verificação integrada em Android e documentação

**Files:**
- Modify: `docs/superpowers/specs/2026-07-17-gps-continuo-jornada-design.md`
- Modify: `CLAUDE.md`
- Create: `tests/jornada-integracao.test.js`

**Interfaces:**
- Consumes: todas as tarefas anteriores.
- Produces: APK debug validado, checklist de operação e documentação de sincronização.

- [ ] **Step 1: Escrever teste integrado de sincronização**

Exigir que `app/www/index.html` contenha o cartão da jornada, que `app/www/jornada-bridge.js` exista e que o Manifesto contenha as permissões de background/foreground location.

- [ ] **Step 2: Rodar todos os testes web**

Executar `Get-ChildItem tests -Filter '*.test.js' | ForEach-Object { node $_.FullName }`. Registrar falhas pré-existentes separadamente, sem mascará-las.

- [ ] **Step 3: Sincronizar e compilar**

Executar `powershell -ExecutionPolicy Bypass -File app\sync-web.ps1`, `cd app; npm run build:jornada-bridge; npx cap sync android`, e em `app\android` `./gradlew.bat clean assembleDebug`.

- [ ] **Step 4: Executar checklist manual**

Validar em aparelho/emulador: permissão precisa e background, notificação, tela apagada, app fechado, início às 08h, pontos a cada intervalo, perda/retorno de rede, duplicação de lote, encerramento às 18h, reboot e mapa do gestor. Confirmar que o navegador continua usando somente GPS pontual.

- [ ] **Step 5: Atualizar documentação**

Adicionar ao `CLAUDE.md` o fluxo `sync:web`, `npm run build:jornada-bridge`, `npx cap sync android`, permissões necessárias e localização do APK. Atualizar a spec com data, testes executados e limitações observadas.

- [ ] **Step 6: Commit final**

```powershell
git add CLAUDE.md docs/superpowers/specs/2026-07-17-gps-continuo-jornada-design.md tests/jornada-integracao.test.js
git commit -m "docs: registra verificacao do GPS continuo da jornada"
```

## Self-review do plano

- Cobertura: API, persistência offline, serviço foreground, agendamento, reboot, ponte Capacitor, UI do promotor, mapa do gestor e verificação Android estão separados em tarefas testáveis.
- Placeholders: não há `TBD`, `TODO` ou passos sem comando/critério de saída.
- Consistência: `jornadaId`, `pontoId`, `NativeJornadaBridge` e os quatro endpoints mantêm os mesmos nomes em todas as tarefas.
- Escopo: o navegador não recebe rastreamento contínuo; o mapa usa pontos reais e preserva lacunas.
