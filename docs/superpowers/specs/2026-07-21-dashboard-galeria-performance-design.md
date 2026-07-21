# Dashboard e galeria com carregamento rápido

**Data:** 2026-07-21

## Objetivo

Reduzir o tempo de carregamento do painel gestor e da galeria, simplificar a Visão geral para os indicadores essenciais e tornar o uso da IA previsível em custo e independente do salvamento das visitas.

## Diagnóstico atual

O dashboard baixa visitas completas por `/api/listar`, anexa validações de fotos, busca clientes em uma segunda chamada sequencial e renderiza muitos blocos que deixarão de existir. Esse fluxo transfere e processa mais dados que o necessário para os indicadores.

A galeria consulta até 300 visitas com a coluna completa de fotos e monta até 80 itens no mesmo JSON. Como as imagens ficam embutidas nos registros, a resposta é pesada antes mesmo de o usuário abrir uma foto.

A análise automática atual roda somente quando `dados.presenca.tabelaVisivel` está marcado. As fotos são analisadas em sequência durante o salvamento e, se o registro da validação falhar, o erro é ignorado e a foto reaparece como pendente. A análise manual também exige duas chamadas sequenciais do navegador: uma para o Gemini e outra para persistir o resultado.

## Escopo funcional

### Período e filtros

- O dashboard abre no mês atual.
- Todos os filtros abrem em `Todos`.
- O usuário pode adicionar outros meses; todos os meses selecionados são somados em um único resultado.
- O período selecionado permanece visível no topo.
- Os filtros seguem interação semelhante ao Excel: busca, seleção múltipla, `Selecionar tudo`, `Limpar` e aplicação explícita.
- Dimensões disponíveis: promotor, coordenador, UF, cidade e produto.
- Os mesmos filtros controlam cards, mapa, lista de estados e ranking de promotores.

### Visão geral

A Visão geral contém somente:

1. Número de visitas no período.
2. Número de pedidos no período.
3. Pacotes vendidos de Gudang Red (`GR`).
4. Pacotes vendidos de Gudang Menta (`GM`).
5. Pacotes vendidos de Cretec Menta (`CM`).
6. Pacotes vendidos de Cretec Cereja (`CC`).
7. Mapa do Brasil com visitas, pedidos e pacotes por estado.
8. Ranking de promotores.

Os blocos antigos da Visão geral são removidos dessa tela. Áreas detalhadas existentes permanecem disponíveis em suas próprias abas. A interface usa ícones SVG consistentes; emojis não são usados no novo dashboard.

A lista de estados pode ser ordenada por mais visitas, mais pedidos, mais pacotes ou UF de A a Z. O ranking pode ser ordenado por visitas, pedidos, total de pacotes ou pacotes de um produto selecionado.

## Arquitetura de dados

### API agregada do dashboard

Uma rota específica recebe os filtros e retorna somente dados agregados:

- totais de visitas e pedidos;
- pacotes por SKU;
- agregados por UF;
- agregados por promotor;
- opções permitidas para os filtros.

As agregações são feitas no Postgres. O frontend não precisa baixar todas as visitas para montar o dashboard. As regras atuais de autenticação e escopo continuam obrigatórias: gestor vê o escopo permitido, coordenador somente seus promotores e promotor não recebe acesso ao dashboard de gestão.

Filtros multisseleção são enviados como listas normalizadas. A API valida valores, aplica o escopo da sessão antes dos filtros solicitados e usa parâmetros SQL, sem interpolação de texto arbitrário.

Índices devem apoiar as consultas por `criado_em` e `promotor`. Índices adicionais só serão adicionados após comparação do plano de consulta e do tempo real.

### Carregamento no frontend

- Dashboard, visitas, clientes, rotas e galeria são carregados sob demanda por aba.
- Chamadas independentes não ficam artificialmente em sequência.
- O dashboard mantém a última resposta durante uma atualização e mostra um indicador discreto de carregamento.
- Um `AbortController` ou identificador de requisição impede respostas antigas de sobrescrever filtros mais recentes.
- Respostas do dashboard usam cache curto em memória por combinação de filtros.
- Alterações que modificam dados invalidam o cache relacionado.

## Galeria paginada

A galeria retorna 24 registros por página. A resposta inicial contém metadados e uma miniatura leve ou URL de miniatura, não todas as imagens originais embutidas.

O botão `Carregar mais` busca a próxima página. A imagem completa é carregada somente ao abrir o item ou quando uma ação de análise exigir o original. Os filtros de promotor, data e status são aplicados no servidor e reiniciam a paginação.

A paginação usa cursor estável baseado em data e identificador, evitando duplicações ou saltos se novos registros entrarem entre páginas.

## Análise manual por IA

A análise fica manual inicialmente e disponível apenas a perfis autorizados no painel. O salvamento de visitas e fotos não chama nem aguarda o Gemini.

Um único endpoint recebe `visita_id` e `foto_index`, confirma a permissão, localiza a imagem no servidor, evita duplicidade, chama o Gemini e persiste o resultado. O navegador não precisa reenviar a imagem completa nem realizar uma segunda chamada de gravação.

O modelo Gemini é fixado por configuração explícita; o alias `latest` não é usado. Cada resultado registra:

- modelo;
- tokens de entrada;
- tokens de saída;
- custo estimado;
- horário;
- status e mensagem de erro, quando aplicável.

Uma foto com resultado existente não é analisada novamente pela ação normal. `Reanalisar` é uma ação separada e explícita. A interface apresenta os estados `Pendente`, `Analisando`, `Aprovada`, `Revisão manual`, `Reprovada` e `Erro`.

Falhas, indisponibilidade ou ausência de saldo do Gemini afetam somente a validação. A visita e a foto permanecem salvas. Os dados reais de uso permitirão definir posteriormente um limite mensal sem estimativas cegas.

## Tratamento de erros

- Dashboard e galeria possuem estados de carregamento, vazio, erro e tentativa novamente.
- Erros de um bloco não apagam dados válidos já exibidos.
- Erros de autenticação seguem o fluxo atual de sessão expirada.
- Falha na IA retorna mensagem legível e mantém a foto disponível para nova tentativa.
- Requisições repetidas da mesma análise são idempotentes e não geram cobrança duplicada por clique duplo.

## Metas de desempenho

Em conexão e banco em condições normais:

- dashboard inicial em até 2 segundos;
- atualização dos filtros em até 1 segundo;
- primeira página da galeria em até 2 segundos;
- interação permanece responsiva durante análise manual.

Antes e depois da implementação serão medidos tempo de resposta, tamanho transferido e quantidade de chamadas das rotas envolvidas. As metas serão avaliadas com os mesmos filtros e volume de dados.

## Testes e verificação

- Agregação de visitas, pedidos e pacotes por SKU.
- Soma de múltiplos meses.
- Filtros multisseleção e combinação das dimensões.
- Escopo de gestor e coordenador.
- Ordenação dos estados e ranking.
- Paginação por cursor sem repetição.
- Galeria sem imagens originais na resposta inicial.
- Análise em uma chamada, persistência do uso e prevenção de duplicidade.
- Falha do Gemini sem impacto sobre visita ou foto.
- Preservação dos testes existentes de dashboard, mapa, filtros, fotos e permissões.
- Comparação objetiva das métricas de desempenho antes e depois.

## Fora de escopo

- Análise automática de todas as fotos.
- Tabelas permanentes de agregação ou infraestrutura de filas.
- Limite financeiro mensal antes de existir medição real de consumo.
- Alteração das regras comerciais de visitas, pedidos ou pacotes.
