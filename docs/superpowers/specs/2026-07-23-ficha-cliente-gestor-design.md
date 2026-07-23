# Ficha de Cliente (aba Clientes do gestor) — Especificação

**Data:** 2026-07-23
**Status:** Aprovada em conversa; aguardando revisão do documento

## Objetivo

Criar uma aba **Clientes** no painel do gestor onde é possível pesquisar um cliente/PDV e abrir sua ficha completa: dados cadastrais e indicadores, últimos pedidos e histórico de visitas, cada visita detalhável (horário, dados do PDV, pedido e fotos).

## Escopo

- Painel do gestor (`index.html`, área G — `mudarAbaG`). Não altera o app do promotor nem a aba "Carteira" existente.
- Não cria endpoint novo nem altera o banco. Reaproveita `GET /api/clientes` (busca) e os dados de visitas já carregados/autorizados para o gestor (`visitasGestor`, vindo de `/api/listar`).
- Não adiciona controles de edição — tela somente leitura, no mesmo espírito da aba Pedidos existente.

## Navegação

- Novo botão **Clientes** no menu do gestor (`data-gestor-page="clientes"`), entre "Visitas" e "Pedidos".
- A página tem dois estados exibidos na mesma aba:
  1. **Busca**: campo de texto (nome fantasia ou CNPJ) + lista de resultados.
  2. **Ficha**: detalhe do cliente selecionado, com botão "← Voltar à busca".

## Busca

- Reaproveita `GET /api/clientes?q=<termo>` (já filtra por `nome_fantasia ILIKE` ou `cnpj LIKE` e já respeita o escopo do usuário autenticado — coordenador só recebe clientes dos promotores vinculados a ele, gestão recebe todos).
- Busca dispara a partir de alguns caracteres digitados (mesmo padrão de debounce já usado em outras buscas do arquivo, se houver; senão, debounce simples de ~300ms).
- Resultado lista nome fantasia, cidade/UF e promotor responsável; cada item é clicável e abre a ficha.
- Sem resultado: estado vazio orientando a ajustar o termo de busca.

## Ficha do cliente (fichário com 3 sub-abas)

Ao abrir a ficha, as visitas do cliente são obtidas filtrando `visitasGestor` (já carregado/autorizado) por `promotor` + `nome_fantasia` (ou CNPJ quando disponível) do cliente selecionado — mesmo critério de casamento já usado em outras partes do sistema (ex.: migração de `clientes` a partir de `visitas`). Não há `cliente_id` em `visitas` nesta versão; não será adicionado.

### Sub-aba 1 — Resumo (aberta por padrão)

Dados cadastrais do cliente (`clientes.*`): código PDV, CNPJ, tipo, IE, endereço, cidade/UF, nome do comprador, telefone, distribuidor, promotor responsável.

Indicadores calculados a partir das visitas casadas com o cliente:
- Total de visitas
- Total de pedidos (visitas com `pedidoFeito === 'Sim'`)
- Valor total comprado (soma de `valorPedido(v)` nas visitas com pedido)
- Pacotes totais (soma de `pacotesPedido(v)`)
- Média de dias entre visitas
- Data da última visita
- Data do último pedido

### Sub-aba 2 — Pedidos

Lista das visitas do cliente com `pedidoFeito === 'Sim'`, mais recente primeiro. Cada linha mostra data/hora, status do pedido, produtos (via `textoProdutosPedido`) e valor (via `valorPedido`) — reaproveitando as mesmas funções já usadas na aba Pedidos do gestor.

Cada linha é clicável e abre o modal de detalhe de visita já existente (`abrirDetalheGestor(id)` → `renderModal` + `carregarFotosModal`), sem necessidade de um modal novo.

Sem pedidos: estado vazio.

### Sub-aba 3 — Visitas

Lista de todas as visitas do cliente (com ou sem pedido), mais recente primeiro, mostrando data/hora e promotor.

Cada linha é clicável e abre o mesmo modal de detalhe (`abrirDetalheGestor(id)`), que já exibe horário, dados do PDV registrados naquela visita, pedido (se houver) e fotos (via `carregarFotosModal`).

Sem visitas: estado vazio.

## Permissões e segurança

- A busca de clientes já é autorizada pelo backend (`/api/clientes`); a tela não amplia esse escopo.
- As visitas usadas para montar a ficha já são as autorizadas para o gestor logado (`visitasGestor`), carregadas do mesmo jeito que a aba Visitas atual — sem novo endpoint, sem novo filtro de permissão no cliente.
- Nenhum controle de edição é exposto na ficha.

## Compatibilidade

- Fonte web é `index.html` na raiz.
- Após a implementação, sincronizar `app/www/index.html` via `app/sync-web.ps1`.
- Não altera schema do banco.
- Reaproveita funções e IDs existentes (`valorPedido`, `pacotesPedido`, `textoProdutosPedido`, `abrirDetalheGestor`, `renderModal`, `carregarFotosModal`) sem duplicar lógica.

## Testes e critérios de aceite

Testes automatizados (padrão `node tests/<arquivo>.test.js`, leitura de `index.html` como texto) verificando:

1. a aba Clientes existe no menu do gestor (`data-gestor-page="clientes"`);
2. a tela de busca existe e chama `/api/clientes` com o termo digitado;
3. a ficha do cliente tem as 3 sub-abas (Resumo, Pedidos, Visitas);
4. os indicadores do Resumo (total de visitas, total de pedidos, valor total, pacotes, média entre visitas, última visita, último pedido) são calculados a partir das visitas do cliente;
5. as linhas de Pedidos e Visitas chamam o modal de detalhe existente ao clicar;
6. a cópia `app/www/index.html` permanece sincronizada com a fonte após o fluxo indicado.

Critério final: no painel do gestor, é possível pesquisar um cliente, abrir sua ficha, navegar pelas 3 sub-abas e clicar em qualquer pedido ou visita para ver o detalhe completo (horário, dados, pedido e fotos), tudo somente leitura.
