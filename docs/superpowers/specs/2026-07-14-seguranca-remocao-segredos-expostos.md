# Segurança: remoção de segredos expostos no código-fonte

## Contexto

Varredura manual identificou senhas em texto puro hardcoded no código-fonte, versionadas no Git desde a criação do projeto. O banco de dados (Neon Postgres) nunca armazena a senha em texto puro — só o hash SHA-256 (coluna `senha_hash`) — mas o código-fonte guarda as senhas originais em arrays `LEGADOS`, duplicados em dois arquivos.

## Escopo desta tarefa

### 1. Varredura completa por segredos expostos (todo o histórico do Git, não só o HEAD atual)

Verificar, além do que já foi checado manualmente (arquivo atual, sem achados fora do já listado abaixo):
- Rodar uma ferramenta de scan de segredos no histórico completo do Git (ex.: `gitleaks detect --source . --log-opts="--all"` ou `trufflehog git file://. --since-commit=<primeiro-commit>` — usar o que estiver disponível/instalável).
- Confirmar que `.env`, `.env.local`, `.env.production` etc. nunca foram commitados em nenhum commit do histórico (não só no HEAD).
- Procurar por qualquer string que pareça `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`, `GOOGLE_DIRECTIONS_API_KEY` com valor real (não `process.env.X`) em qualquer commit.
- Reportar tudo que encontrar, mesmo que pareça inofensivo.

### 2. Remover as senhas em texto puro do código-fonte (achado já confirmado)

Arquivos com o problema:
- `api/login.js` — array `LEGADOS` (linhas ~5-14), com `senha: 'Lx9#mK2p'` etc. em texto puro para 8 usuários (`leandro`, `diretoria`, `francisco`, `andre`, `cristiano`, `jarbas`, `kayan`, `wil`).
- `api/promotores.js` — mesmo array `LEGADOS` duplicado (linhas ~6-13).

Ambos os arquivos usam esse array só para popular a tabela `promotores` na primeira vez (`INSERT ... ON CONFLICT (usuario) DO NOTHING`), gravando `senha_hash: hashSenha(p.senha)` e `senha: ''` (a coluna `senha` em si já fica sempre vazia — só existe por compatibilidade legada, não é usada pra autenticar; ver `api/login.js`, a query de login usa `senha_hash = ${hashSenha(senha)} OR senha = ${senha}` — o `OR senha = ${senha}` é resíduo morto, já que `senha` nunca é gravado com valor).

**O que fazer:**
- Trocar os arrays `LEGADOS` para conter só `usuario`, `nome`, `tipo` e o **hash SHA-256 já pré-calculado** da senha (não a senha em si), usando o mesmo algoritmo de `hashSenha()` (`createHash('sha256').update(senha).digest('hex')`). Ou seja: pré-calcular os hashes uma vez, colar os hashes no array, apagar as senhas em texto puro do arquivo.
- Ajustar o `INSERT` para usar esse hash pré-calculado diretamente em `senha_hash`, sem chamar `hashSenha()` sobre uma senha em texto puro que não existe mais no arquivo.
- Manter esse array idêntico (mesmos hashes) nos dois arquivos (`login.js` e `promotores.js`) — são a mesma fonte de dados duplicada; se der pra unificar num único módulo compartilhado (padrão já usado no projeto para `bonus.js`/`performance.js`), fazer isso, mas não é obrigatório para esta tarefa — priorizar remover o segredo primeiro, refactor de duplicação é bônus.
- **Importante:** como o array só roda `INSERT ... ON CONFLICT DO NOTHING`, usuários que já existem no banco (produção já rodando) não são afetados por essa mudança — a troca só evita que, se alguém rodar isso do zero num banco novo, ainda funcione com o mesmo hash de antes. Confirmar esse raciocínio lendo `api/login.js` e `api/promotores.js` por completo antes de mexer.
- Depois da mudança, os usuários de produção continuam logando normalmente com as mesmas senhas de sempre (nada muda pro usuário final) — só o código-fonte deixa de expor a senha em texto puro.
- Rodar os testes existentes (`for f in tests/*.test.js; do node "$f"; done` a partir da raiz) para confirmar que nada quebrou. Não deve haver nenhum teste que dependa do texto literal das senhas (`grep -rn "Lx9#mK2p\|Dir@2026\|Fj4@nR7w" tests/` para confirmar antes de mexer).

### 3. Avaliação adicional (reportar, não corrigir nesta tarefa a menos que simples)

- `hashSenha()` usa SHA-256 puro, sem salt — mais rápido de quebrar por força bruta/rainbow table do que bcrypt/scrypt/argon2. Reportar como achado, mas NÃO trocar o algoritmo de hash nesta tarefa (trocar exigiria migrar hashes existentes no banco de produção, é uma mudança maior e arriscada — avaliar como tarefa separada se o usuário quiser).
- Resíduo morto: coluna `senha` na tabela `promotores` e o `OR senha = ${senha}` na query de login em `api/login.js` — nunca é populada com valor real (sempre `''`), então essa cláusula nunca compara nada de verdade. Reportar como código morto, mencionar que remover exigiria também dropar/ignorar a coluna `senha` na tabela (mudança de schema, fora do escopo — só reportar).

## O que NÃO fazer

- Não mexer em `bonus.js`, `performance.js`, `index.html`, `gestor.html` — fora do escopo.
- Não trocar o algoritmo de hash (SHA-256 → bcrypt/argon2) nesta tarefa.
- Não remover a coluna `senha` do schema do banco nesta tarefa.
- Não fazer `git filter-branch`/`BFG`/reescrever histórico do Git sem aprovação explícita do usuário — mesmo que o scan encontre segredos no histórico antigo, reportar e perguntar antes de reescrever histórico (reescrever histórico de um repo já pushado é uma operação destrutiva que exige força push e coordenação).

## Entregável

1. Relatório da varredura de segredos (o que foi encontrado, incluindo no histórico do Git).
2. Commit removendo as senhas em texto puro de `api/login.js` e `api/promotores.js`, substituindo por hashes pré-calculados.
3. Confirmação de que os testes existentes continuam passando.
4. Lista dos achados secundários (hash sem salt, coluna `senha` morta) para o usuário decidir se quer tratar depois.
