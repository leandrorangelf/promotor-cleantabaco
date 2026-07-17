# Área de Pedidos — Especificação

**Data:** 2026-07-17  
**Status:** Aprovada em conversa; aguardando revisão do documento

## Objetivo

Criar uma área própria de **Pedidos**, somente para consulta, disponível no app do promotor e no painel usado por coordenadores e gestão. A área deve facilitar localização, acompanhamento e exportação dos pedidos sem duplicar a origem dos dados nem permitir alterações.

## Perfis e escopo de dados

- **Promotor:** visualiza somente pedidos originados por suas próprias visitas.
- **Coordenador:** visualiza somente pedidos dos promotores vinculados ao seu usuário.
- **Gestão/diretoria:** visualiza todos os pedidos disponíveis no sistema.

A regra de acesso deve continuar sendo aplicada pela carga de visitas autorizada pelo backend. A nova tela não deve ampliar o conjunto de dados no navegador nem substituir a autorização do servidor por filtro visual.

## Navegação

- Adicionar uma aba **Pedidos** ao menu do promotor.
- Adicionar uma aba **Pedidos** ao menu compartilhado de coordenador/gestão.
- Manter a área atual de **Visitas** funcionando, inclusive seus filtros e detalhes.
- A tela de Pedidos será uma visão operacional derivada das visitas com pedido registrado; não haverá uma nova tabela ou endpoint de pedidos nesta primeira versão.

## Filtros

A tela deve oferecer os seguintes filtros, combináveis e com ação de limpar:

- período inicial e final;
- status do pedido: todos, em negociação, confirmado e entregue;
- promotor;
- coordenador responsável, quando o perfil puder visualizar essa dimensão;
- cliente/PDV;
- cidade/UF;
- busca livre por cliente, cidade, promotor ou produto.

Os filtros devem ser aplicados apenas aos dados já autorizados e devem atualizar resumo, tabela e exportação de forma consistente.

## Resumo e listagem

Exibir no topo:

- quantidade de pedidos;
- pedidos confirmados;
- pedidos entregues;
- total de pacotes;
- valor total informado.

A tabela deve mostrar, no mínimo:

- data da visita;
- cliente/PDV;
- cidade/UF;
- promotor;
- status;
- produtos e quantidades;
- valor total do pedido;
- ação para abrir os detalhes da visita/pedido em modo somente leitura.

Quando não houver resultado, exibir estado vazio orientando a remover ou ajustar os filtros. Dados antigos com `pedidoQty` devem continuar compatíveis com o formato atual `pedidoPac`.

## Exportação

Permitir exportação CSV apenas dos pedidos que correspondem aos filtros atuais. O arquivo deve manter as colunas operacionais já usadas na exportação de pedidos completos e incluir a identificação do coordenador quando essa informação estiver disponível sem alterar a origem dos dados.

## Permissões e segurança

- Não incluir controles de edição de status, quantidades, preços ou dados do pedido.
- Não carregar pedidos fora do escopo retornado para o perfil autenticado.
- Coordenador deve herdar a associação já existente entre promotor e `coordenador_usuario`.
- Gestão deve continuar vendo o conjunto global já disponível no painel.

## Compatibilidade

- A fonte web é `index.html` na raiz.
- Após a alteração, sincronizar `app/www/index.html` pelo script `app/sync-web.ps1` para manter o APK alinhado.
- Não alterar a estrutura do banco nesta primeira versão.
- Preservar os IDs e funções usados pelos testes e pelas áreas atuais de visitas.

## Testes e critérios de aceite

Devem existir testes automatizados verificando:

1. a aba Pedidos existe nos menus de promotor e gestor/coordenador;
2. os filtros principais e o estado somente leitura estão presentes;
3. o conjunto usado pela tela respeita a lista de visitas já autorizada;
4. a exportação usa os filtros atuais;
5. a compatibilidade entre `pedidoPac` e `pedidoQty` permanece;
6. a cópia `app/www/index.html` permanece sincronizada com a fonte após o fluxo indicado.

Critério final: cada perfil encontra uma aba Pedidos organizada, consegue filtrar e consultar os pedidos permitidos, e não encontra controles para alterá-los.
