# Fix validação de fotos: visita_id UUID quebrado + aprovação manual sem IA

## Contexto

A Galeria (aba "Galeria" e aba "Galeria IA") tem botões "Analisar IA" que não
funcionam. Além disso, não existe forma de o gestor confirmar manualmente que
uma foto tem tabela de preços válida sem antes rodar a análise por IA.

## Causa raiz do botão "Analisar IA" quebrado

`visitas.id` em produção é UUID (ex: `06339d55-838e-4df3-bb89-0d71099aad17`),
não inteiro. Mas o código assume inteiro em vários pontos:

1. **Frontend** (`index.html`): os `onclick` de `analisarFotoGaleria`,
   `analisarValidacaoPendente` e `abrirFotoGaleriaIA` interpolam
   `${item.visita_id}` sem aspas. Com um UUID isso vira JS inválido
   (`analisarFotoGaleria(06339d55-838e-..., 2)`), lançando
   `SyntaxError: Invalid or unexpected token` no clique — a função nunca
   chega a rodar.
2. **Backend** (`api/validacoes-fotos.js`, `api/listar.js`): a coluna
   `validacoes_fotos.visita_id` é `INTEGER` e o código faz `Number(visita_id)`
   / `Number(v.id)`. Para um UUID isso vira `NaN`. Um patch anterior (commit
   `7307f2c`) já filtra ids não numéricos pra evitar erro 500, mas isso
   descarta silenciosamente essas visitas — elas nunca aparecem vinculadas às
   validações e nunca conseguiriam gravar uma análise (IA ou manual).

## Design

### 1. Corrigir o schema e o backend (`api/validacoes-fotos.js`)

- `CREATE TABLE IF NOT EXISTS validacoes_fotos`: coluna `visita_id` passa de
  `INTEGER NOT NULL` para `TEXT NOT NULL`.
- Adicionar, dentro de `garantirTabela`, uma migração idempotente:
  `ALTER TABLE validacoes_fotos ALTER COLUMN visita_id TYPE TEXT` envolvida em
  try/catch (não quebra se a tabela ainda não existir ou já estiver em TEXT).
- Remover todo uso de `Number(visita_id)` / `Number(v.id)` relacionado a
  `visita_id` — usar o valor cru (string) em: filtro de ids para
  `visita_id = ANY(${ids})`, e no `INSERT` de `POST`.
- `foto_index` e `score` continuam usando `Number(...)` normalmente — não são
  afetados.

### 2. Corrigir `api/listar.js`

- `const ids = rows.map(v => Number(v.id)).filter(Boolean)` vira
  `const ids = rows.map(v => v.id).filter(Boolean)`.

### 3. Corrigir os `onclick` no frontend (`index.html`)

Nos 3 pontos que interpolam `visita_id` sem aspas, passar a interpolar como
string:

```html
onclick="analisarFotoGaleria('${item.visita_id}', ${item.foto_index})"
onclick="analisarValidacaoPendente('${item.visita_id}', ${item.foto_index})"
onclick="abrirFotoGaleriaIA('${item.visita_id}', ${item.foto_index})"
```

As funções já comparam com `String(v.visita_id) === String(visitaId)`
internamente, então nenhuma outra mudança é necessária nelas.

### 4. Botão "Confirmar tabela" (aprovação manual sem IA)

Novo botão, ao lado de "Analisar IA", em qualquer foto ainda sem registro
(`item.id` falsy) — tanto na aba **Galeria** quanto na **Galeria IA**.

Nova função de frontend `confirmarTabelaManual(visitaId, fotoIndex)`, que
reaproveita os endpoints existentes sem exigir mudança de backend adicional:

1. `POST /api/validacoes-fotos` — cria o registro com `resultado: {}`
   (`status_ia` cai em `reprovado` por padrão, sem problema, pois será
   sobrescrito no passo 2).
2. `PUT /api/validacoes-fotos` com `{ id, status_manual: 'aprovado' }` no
   registro recém-criado — grava `revisado_por`/`revisado_em` e passa a
   contar como aprovado (a UI exibe `status_manual || status_ia`).
3. Recarrega a lista (`carregarGaleria()` / `renderGaleriaIA()`), a foto passa
   a mostrar os botões normais "Aprovar"/"Reprovar".

O fluxo existente de "Aprovar"/"Reprovar" para fotos já analisadas pela IA
(quando `item.id` existe) permanece intacto — o gestor já pode sobrescrever o
resultado da IA hoje, isso não muda.

### Fora de escopo

- Não altera a lógica de contagem de meta (`bonus.js`/`performance.js`) — ela
  já lê `status_manual || status_ia`, então passa a funcionar corretamente
  assim que os bugs acima forem corrigidos.
- Não adiciona endpoint novo — reaproveita `POST`/`PUT` de
  `api/validacoes-fotos.js`.

## Testes

- Atualizar/verificar `tests/validacao-ia-galeria.test.js` continua passando
  (verifica presença de strings-chave no HTML/API, não é afetado
  estruturalmente, mas adicionar checagem de `confirmarTabelaManual` e de que
  `visita_id TEXT` está no schema).
