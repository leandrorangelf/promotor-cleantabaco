# Validacao IA Fotos Design

## Objetivo

Adicionar ao sistema uma area experimental para validar, com IA, se uma foto contem material de marketing da Clean Tabaco ou El Poncio, como tabela de precos, wobler, display, cartaz, adesivo ou expositor.

## Escopo Aprovado

O primeiro incremento sera seguro e isolado. Ele cria uma area de teste no painel gestor/admin e uma rota separada para avaliacao de foto. O fluxo oficial de visitas nao sera alterado nesta etapa.

## Fora Do Escopo Inicial

- Nao alterar `api/salvar.js`.
- Nao alterar o schema do banco.
- Nao salvar resultado de IA nas visitas.
- Nao bloquear envio de visitas.
- Nao afetar bonus, historico, relatorios ou dashboard de performance.

## Modo Mock

A primeira versao deve funcionar sem chave de IA. Quando `IA_VALIDACAO_REAL` nao estiver igual a `true`, a rota `api/avaliar-foto.js` retornara uma resposta mockada em JSON. Isso permite testar tela, upload, chamada de API, exibicao do resultado e tratamento de erro sem custo e sem depender do Google.

## Modo Gemini

Quando `IA_VALIDACAO_REAL=true` e `GEMINI_API_KEY` estiver configurada, a rota chamara o Google Gemini para analisar a foto enviada. A chave deve existir somente no backend/serverless, nunca no HTML.

## Criterios De Avaliacao

No modo de teste, a foto pode ser tirada em uma sala ou escritorio. A IA deve aprovar quando identificar tabela de precos, wobler ou outro material da Clean Tabaco/El Poncio com confianca suficiente.

Resposta esperada:

```json
{
  "aprovado": true,
  "score": 82,
  "modo": "mock",
  "materiais_detectados": ["tabela_precos"],
  "pdv_detectado": false,
  "qualidade_foto": "boa",
  "motivo": "Simulacao: estrutura pronta para receber analise real da IA."
}
```

Para uso real em campo, uma versao futura podera exigir material reconhecido, ambiente de PDV e qualidade minima da foto.

## UI

Adicionar uma area experimental no gestor/admin chamada `Validacao IA`. Ela deve permitir selecionar uma imagem, enviar para analise e exibir aprovado/revisao/reprovado, score, materiais detectados, modo de execucao e motivo.

## Testes

Adicionar testes simples em Node para garantir que:

- A rota `api/avaliar-foto.js` existe.
- A rota tem modo mock seguro.
- A tela possui a area `Validacao IA`.
- A tela chama `/api/avaliar-foto` sem expor `GEMINI_API_KEY`.
