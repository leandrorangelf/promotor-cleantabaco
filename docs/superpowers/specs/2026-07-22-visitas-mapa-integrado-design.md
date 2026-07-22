# Design: mapa integrado à aba Visitas

## Objetivo

Unificar a operação de acompanhamento em uma única aba **Visitas**, colocando o mapa interativo junto da sequência de visitas e do detalhe completo de cada registro. A aba Mapas deixa de ser uma tela operacional duplicada; não haverá duas renderizações concorrentes da mesma informação.

## Experiência proposta

- Os filtros e o período continuam no topo da aba Visitas.
- Abaixo dos filtros, um layout de duas colunas apresenta o mapa em tamanho reduzido de um lado e a lista de visitas do outro.
- A lista é agrupada por promotor. Dentro de cada grupo, as visitas aparecem em ordem crescente de sequência; quando não existir sequência explícita, a ordenação usa data/hora registrada como fallback determinístico.
- Cada item da lista é um link/controle acessível. Ao ativá-lo, o mapa centraliza e destaca o marcador correspondente e abre o modal de detalhe já existente, sem trocar de aba.
- Ao selecionar um marcador, a visita correspondente fica destacada na lista e o mesmo modal é aberto.
- O modal reutiliza o fluxo atual de fotos, edição, ações e fechamento; não será criado um segundo modal de visita.
- Em telas estreitas, o mapa fica acima e a sequência abaixo, com rolagem própria apenas quando necessário.

## Arquitetura e ciclo de vida

1. A função que já produz `visitasGestor` será a única fonte para mapa, lista e modal.
2. Uma etapa de normalização deriva uma coleção de itens de mapa com identificador estável, promotor, sequência, data/hora, PDV, coordenadas e referência ao registro original.
3. O render da aba Visitas atualiza a lista e os marcadores a partir dessa coleção, sem buscar ou duplicar dados.
4. Antes de uma nova renderização, a camada/grupo de marcadores anterior é removida e os listeners de interação são registrados uma única vez. Nenhum marcador, listener ou timer pode acumular após trocar filtros ou período.
5. A troca para a aba Visitas inicia/atualiza o mapa somente quando o container está visível; a troca para outras abas pausa atualizações que não sejam necessárias.
6. Registros sem coordenadas permanecem na sequência, sinalizados como “sem localização”, e continuam abrindo o modal. O mapa não deve falhar por causa de um registro incompleto.

## Estados e desempenho

- Estado vazio: mensagem única para “nenhuma visita no período”, sem mapa vazio enganoso.
- Estado parcial: contador de visitas localizadas e não localizadas.
- Erro de mapa ou tiles: a lista e o modal continuam funcionais, com mensagem discreta no painel do mapa.
- Não haverá nova chamada de API por clique, nem polling. O clique usa o registro já carregado.
- A lista usa uma única renderização por atualização de filtros; eventos devem ser delegados ou ligados de forma idempotente.
- A implementação deve preservar a limpeza de mapas existente e evitar instanciar mais de um mapa para o mesmo elemento.

## Compatibilidade e acessibilidade

- Preservar filtros, paginação/limites, edição, exclusão e modal existentes.
- Itens da sequência devem ser focáveis via teclado, ter texto acessível e indicar visualmente o item selecionado.
- Fechamento do modal por botão, clique no overlay e tecla Escape continua disponível.
- Layout desktop e mobile devem evitar overflow horizontal e manter mapa/lista utilizáveis.

## Escopo de remoção

- Remover a seção textual/duplicada da aba Mapas que não apresenta detalhes interativos.
- Remover funções, elementos e listeners que só serviam à renderização duplicada, depois de confirmar que não são usados pelo dashboard ou por testes existentes.
- Não remover a tela/estrutura de dados de Visitas, o modal compartilhado, fotos, filtros ou APIs.

## Critérios de aceite

1. A aba Visitas mostra mapa e sequência agrupada por promotor no mesmo contexto.
2. A sequência é crescente e estável; registros sem sequência usam data/hora como fallback.
3. Clicar em um item abre o modal completo e destaca/centraliza seu marcador.
4. Clicar em um marcador abre o mesmo modal e destaca o item da lista.
5. Trocar filtros várias vezes não duplica marcadores, listeners, chamadas ou blocos HTML.
6. Visitas sem coordenadas continuam visíveis e acessíveis no modal.
7. A antiga tela/área textual de Mapas não fica órfã nem é renderizada em paralelo.
8. Desktop e mobile funcionam sem overflow horizontal e sem erros no console.

## Validação planejada

- Testes unitários para normalização, ordenação por promotor/sequência e fallback de data.
- Testes de UI para seleção lista→mapa→modal, marcador→lista→modal, filtros repetidos e registros sem coordenadas.
- Smoke test renderizado em desktop e viewport móvel, verificando ausência de erros de console, duplicação de marcadores e modal funcional.
