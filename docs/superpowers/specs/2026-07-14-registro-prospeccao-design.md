# Registro de Prospecção — Design Spec

## Contexto e problema

O promotor só registra uma visita quando fecha uma venda (o formulário completo de visita — presença de produto, comercial, mercado — é trabalhoso pra preencher sem motivo). Isso significa que não existe nenhum registro (nem de PDV, nem de GPS, nem de horário) para os locais visitados sem venda. Consequência prática: o gestor não consegue diferenciar "promotor não visitou ninguém" de "promotor visitou vários locais que não compraram" — caso identificado com o promotor Cristiano (17km calculados no dia, mas só 2 PDVs registrados).

O sistema já suporta captura pontual de GPS (`capturarLocalizacaoAtual()`) e foto com timestamp/EXIF (`criarFotoComMetadados()`) no momento de salvar uma visita — mas só dentro do fluxo de 5 passos da visita completa. Rastreio contínuo em segundo plano foi decidido explicitamente fora de escopo na Fase 3 do app Android (`docs/superpowers/plans/2026-07-13-app-android-gps-nativo-fase3.md`), por questões de bateria, permissão de "localização o tempo todo" e privacidade — essa decisão continua valendo aqui.

## Solução: registro de "prospecção"

Um registro rápido — nome do local + foto + GPS + timestamp — para o promotor comprovar que esteve num local, mesmo sem venda. Sem o formulário completo.

## Modelo de dados

Sem tabela nova, sem migration. Reaproveita a tabela `visitas` já existente:

```js
dados = {
  tipo: 'prospeccao',
  pdv: { nomeFantasia },
  localizacao: { ok: true, latitude, longitude, ... } // mesmo formato já usado hoje
}
```

Ausência de `presenca`, `comercial`, `mercado` (campos que só existem em visita normal) é o que diferencia uma prospecção de uma visita completa — não precisa de um campo booleano redundante além de `tipo`.

`api/salvar.js` **não muda**: já faz `insert` do `dados` como JSON e já faz upsert automático de cliente por `nomeFantasia` (linhas 24-49) — uma prospecção salva vira contato na carteira do promotor pelo mesmo caminho que já existe hoje.

## Frontend (`index.html`, app do promotor)

**Entrada:** botão novo "📍 Prospecção" na tela Painel, separado do fluxo "＋ Nova" (visita completa).

**Modal leve** (não o wizard de 5 seções), com:
- Campo texto: nome do local
- Botão de foto — reaproveita `tirarFotoNativa()` / `processarFotos()` e `criarFotoComMetadados()` (já grava `capturadaEm`, hash e detecção de EXIF divergente)
- GPS capturado automaticamente ao salvar — reaproveita `capturarLocalizacaoAtual()`, a mesma função que `salvarVisita()` já chama antes de enviar

**Nova função `salvarProspeccao()`**, irmã de `salvarVisita()` (index.html:3141), mas monta um `dados` mínimo (só `tipo`, `pdv.nomeFantasia`, `localizacao`) e chama `POST ${API}/api/salvar` sem alterações no endpoint.

**Validação por IA:** nenhuma mudança necessária em `registrarValidacoesVisita()` (index.html:3102) — ela já só dispara a fila de IA quando `dados.presenca?.tabelaVisivel` é `true`; como prospecção nunca define `presenca`, a validação já é pulada pelo código existente.

**Histórico (`renderHistorico()`, index.html:3427):** checagem `d.tipo === 'prospeccao'` → mostra badge "🔍 Prospecção" no lugar dos badges de produto/pedido (que ficariam vazios).

## Cálculo de km (`api/rota-km.js`)

Comportamento atual já inclui qualquer visita com `localizacao.ok`, independente de `dados.tipo` — prospecção entra na rota automaticamente, sem mudança de filtro.

Adicionar parâmetro de query opcional `incluirProspeccao` (default `true`, ou seja, comportamento de hoje não muda por padrão). Se vier `incluirProspeccao=false`, o handler filtra fora as visitas com `dados.tipo === 'prospeccao'` antes de montar a rota do Google Directions.

**Gestor (`index.html`, aba Mapa):** checkbox "Incluir prospecção no km" ao lado dos filtros existentes de mapa (`mapaFiltroPromotor`/`mapaFiltroDe`/`mapaFiltroAte`), repassado como esse parâmetro em `carregarKmRota()`. Sem esse checkbox o parâmetro da API ficaria sem uso.

## Fora de escopo

- Rastreio contínuo de GPS em segundo plano (decisão já tomada na Fase 3 do app Android — não reabrir aqui).
- Fila de revisão manual/IA para foto de prospecção.
- Campos adicionais (endereço, CNPJ, tipo de estabelecimento) no registro de prospecção — só nome, foto e GPS.
- Mudança em `app/www/index.html` fora do fluxo já estabelecido (copiar depois de validar no site, reaplicar troca do `const API`).
