# Redesenho do card de metas + meio pacote no pedido

Data: 2026-07-08

## Contexto

Duas melhorias pedidas para o app do promotor (`index.html`):

1. O card de metas na tela inicial (`pPainel`) está visualmente básico e precisa
   de mais destaque/hierarquia.
2. O formulário de pedido da visita só permite quantidades inteiras de pacote
   por SKU; é preciso permitir meio pacote (0,5).

## 1. Redesenho do card de metas

Sem mudança nos dados: continua vindo de `calcularPerformancePromotor`
(`performance.js`) e sendo montado em `renderPainelPromotor()`
(`index.html:3064`), com os mesmos 3 cards (PDVs abertos com venda/bônus,
% da base com tabela visível, cobertura ou base cadastrada).

Mudanças, todas em CSS + no template HTML gerado por `renderPainelPromotor`:

- **Badge de status** no topo do card: pill "Meta batida ✓" (verde) ou
  "Faltam N" (âmbar), substituindo o texto de status que hoje fica solto
  embaixo da barra.
- **Número principal maior**, com o alvo (`/ alvo`) menor e em cinza ao lado,
  mantendo o formato atual mas com mais peso visual.
- **Barra de progresso mais grossa** (de 6px para algo em torno de 10-12px),
  cantos arredondados, cor de acordo com o status (âmbar/verde).
- **Ícone por card**: 💰 para o card de bônus, 📊 para % de tabela visível,
  🏪 para base/cobertura — fixo por tipo de card, não vem do backend.
- Cards com meta batida ganham leve destaque adicional (borda/fundo um pouco
  mais vivos) nas classes `.kpi-card.green` / `.kpi-card.orange`
  (`index.html:596-601`).

Sem novo endpoint, sem migração de banco, sem novo teste de dados — só ajusta
classes CSS existentes e o template dentro de `renderPainelPromotor()`.

## 2. Meio pacote no pedido da visita

Hoje, em `bloquePedidos` (`index.html:919+`), cada SKU (GR, GM, CM, CC) tem
botões `−`/`+` que chamam `alterarQty(id, delta)` (`index.html:1898`) somando
ou subtraindo `1` inteiro, e a leitura da quantidade em `salvarVisita()` usa
`parseInt(...).textContent`.

Mudanças:

- `alterarQty` passa a somar/subtrair `0.5` por clique em vez de `1`.
- O valor exibido em `.qty-val` é formatado em pt-BR (`1,5` em vez de `1.5`)
  usando o separador decimal com vírgula.
- Todo ponto que lê essa quantidade troca `parseInt` por `parseFloat`:
  - `calcularTotalPedido()` (cálculo do subtotal/total do pedido e das
    caixas equivalentes, `index.html:1904+`)
  - `salvarVisita()` ao montar `dados.comercial.pedidoPac` (`index.html:2286+`)
  - Qualquer exportação (CSV/PDF) que releia `pedidoPac` a partir dos dados
    salvos (ex.: linhas de exportação de visitas, sugestões de pedido)
- O cálculo de "caixas equivalentes" (`Math.floor(pac / PACOTES[s])` + resto)
  continua igual — o resto passa a poder ser fracionário (ex.: `0,5`), o que
  já funciona naturalmente com ponto flutuante.
- Nenhuma mudança de schema no banco: `dados` é armazenado como JSON, então
  passar a gravar `1.5` em vez de `1` não exige migração.

### Fora de escopo

- Não há validação de estoque mínimo por meio pacote — segue o mesmo
  comportamento de hoje (sem limite superior, mínimo 0).
- Não muda a lógica de bonificação/metas (`bonus.js`), que já soma
  `pedidoPac` como número, então frações são somadas normalmente.

## Testes

- Testes existentes em `tests/*.test.js` continuam rodando via
  `node tests/<arquivo>.test.js`; nenhum teste novo de dados é necessário já
  que a lógica de meio pacote é aritmética simples sobre um valor já
  numérico. Se algum teste existente faz `assert` sobre o texto exibido em
  `.qty-val` como inteiro, precisa ser ajustado para aceitar formato
  decimal.
