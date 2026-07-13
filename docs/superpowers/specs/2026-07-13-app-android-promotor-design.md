# App Android do Promotor (Capacitor) — Design

## Contexto

O app do promotor hoje é o `index.html` (JS vanilla, sem build), consumindo `api/*.js` na Vercel. O objetivo é ter uma versão instalável (ícone, loja de apps) no Android, sem reescrever a lógica já validada (câmera, GPS, EXIF, autenticação).

## Motivação

Percepção/profissionalismo para os promotores — parecer um app "de verdade", não uma aba de navegador. Aproveitando a migração, adicionar três recursos nativos hoje limitados no navegador: notificações push, funcionamento offline e GPS em background durante a rota do dia.

## Escopo desta fase

- Apenas o **app do promotor** (não inclui `gestor.html`).
- Apenas **Android** (iOS fica para uma fase futura — exige Mac para compilar).
- Windows desktop do promotor: fora de escopo, fase futura separada.

## Abordagem: Capacitor

Empacotar o front atual (`index.html` + scripts) dentro de um projeto Capacitor, trocando apenas as APIs de acesso a hardware por plugins nativos equivalentes. Reaproveita ~90% do código existente. Alternativas descartadas: React Native e Flutter exigiriam reescrever toda a UI do zero (semanas extras), sem ganho que justifique o custo para este projeto.

## Estrutura de pastas

Projeto Capacitor isolado dentro do mesmo repositório, sem tocar nos arquivos existentes:

```
promotor-cleantabaco/
├── index.html, gestor.html, api/, bonus.js, performance.js, tests/   ← inalterados
└── app/                          ← pasta nova
    ├── www/                       cópia/build do front que vira o app
    ├── android/                   gerado por `npx cap add android`
    ├── capacitor.config.json
    └── package.json
```

- `app/android/build/` e `app/android/.gradle/` (artefatos de build) entram no `.gitignore` — não versionar.
- O restante de `app/` (código-fonte, config) é commitado normalmente.
- Nada em `app/` é servido pela Vercel; o site em produção não é afetado.

## Migração incremental

1. **Fase 1** — criar o projeto Capacitor em `app/`, copiando o front atual para `app/www/` sem nenhuma mudança de comportamento. Meta: o app abre e funciona igual ao site (câmera/GPS via API web mesmo, dentro da webview).
2. **Fase 2** — trocar câmera por `@capacitor/camera` (nativo, com EXIF).
3. **Fase 3** — GPS em background (plugin de background geolocation) para manter o rastreio da rota com o app minimizado.
4. **Fase 4** — push notifications (`@capacitor/push-notifications` + Firebase Cloud Messaging), incluindo endpoint novo em `api/` para registrar token do device e disparar push.
5. **Fase 5** — fila offline: guardar visitas/fotos localmente quando sem rede (`@capacitor/preferences` ou SQLite) e sincronizar quando a rede voltar (listener `Network` do Capacitor).

Em cada fase, o JS usa `Capacitor.isNativePlatform()` para decidir entre API web (quando rodando no navegador) e plugin nativo (quando rodando no app), mantendo o site funcionando sem regressão.

## Backend

Nenhuma mudança nos endpoints existentes. Única adição prevista: endpoint para registrar token de push por device (fase 4).

## Continuidade entre sessões

O plano de implementação (próximo artefato, em `docs/superpowers/plans/`) é dividido em fases com checkboxes. Ao final de cada sessão de trabalho (Claude ou Codex), o plano deve ser atualizado marcando o que foi concluído e o que falta, e commitado — assim qualquer sessão futura sabe onde parou lendo apenas esse arquivo.

## Testes

Os testes atuais (`tests/*.test.js`) continuam validando `index.html`/`api/*.js` como texto, sem mudanças. Recursos nativos (câmera, GPS, push, offline) não são testáveis por assert de texto — precisam de verificação manual em device/emulador Android a cada fase.

## Fora de escopo (explicitamente adiado)

- iOS (exige Mac).
- App Windows do promotor.
- Qualquer mudança no `gestor.html`.
