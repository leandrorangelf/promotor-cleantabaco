# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Projeto: Promotor Cleantabaco

Sistema de gestão de promotores de PDV (pontos de venda). Duas frentes: app do promotor (`index.html`) e painel do gestor (`gestor.html`). Backend são funções serverless da Vercel em `api/*.js`, sem framework.

### Rodar / testar

- Sem build. `index.html` e `gestor.html` são standalone (JS inline).
- Deploy é via Vercel (não há `vercel.json`; usa `.vercel/repo.json`).
- Testes: scripts Node simples (sem Jest/Mocha), cada um roda com `node tests/<arquivo>.test.js`. Não usam DOM real nem chamadas HTTP reais — a maioria lê `index.html`/`gestor.html`/`api/*.js` como texto e faz `assert.ok(html.includes(...))`. Para rodar tudo: `for f in tests/*.test.js; do node "$f"; done` (não há script `npm test`).
- Ao adicionar/alterar uma feature no front, o teste correspondente provavelmente falha se você renomear um `id`, atributo `data-*` ou nome de função usado nesses `assert.ok`.

### Arquitetura

- `api/*.js`: um handler por arquivo (padrão Vercel: `export default async function handler(req, res)`), cada um cria sua própria tabela com `CREATE TABLE IF NOT EXISTS` no início do handler (não há migrations separadas).
- `api/_auth.js`: autenticação própria via HMAC (não é JWT de biblioteca). Token = `payloadB64.assinaturaHMAC`, expira em 24h. `autenticar(req)` lê o header `Authorization: Bearer <token>`.
- `bonus.js` e `performance.js` (raiz): lógica de negócio compartilhada entre frontend (carregados como `<script>` no HTML, expõem função no `window`) e backend (via `require`/`import`, padrão UMD). Regras de bonificação/metas vivem aqui — não duplicar essa lógica dentro de `api/*.js` ou dentro do HTML.
- Banco: Neon Postgres serverless (`@neondatabase/serverless`), acessado com `neon(process.env.DATABASE_URL)` e template literals SQL tag.

### Variáveis de ambiente

- `DATABASE_URL` — obrigatória (Neon Postgres). Também é usada como fallback de `AUTH_SECRET` se este não estiver setado.
- `AUTH_SECRET` — opcional, chave do HMAC dos tokens de sessão.
- `GEMINI_API_KEY` — usada por `api/avaliar-foto.js` (validação de foto por IA).
- `IA_VALIDACAO_REAL` — feature flag para ligar a validação real por IA (`api/avaliar-foto.js`).
- `GOOGLE_DIRECTIONS_API_KEY` — usada por `api/rota-km.js` (cálculo de km real de rua da rota diária do promotor). Sem ela, a rota retorna `km: null`.

### Planejamento

- `docs/superpowers/specs/` e `docs/superpowers/plans/` guardam specs e planos de features (gerados pela skill superpowers). Antes de planejar uma feature nova, olhar se já existe doc relacionado ali.
