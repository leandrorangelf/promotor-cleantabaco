# Correção dos filtros, sequência no mapa e fotos da galeria

## Objetivo

Corrigir o dashboard para que todos os indicadores acompanhem os filtros selecionados, tornar a consulta de visitas diária por padrão, exibir a sequência cronológica das visitas no mapa e restaurar a visualização das fotos antigas na galeria sem abandonar paginação e carregamento progressivo.

## Dashboard

- O período padrão continua sendo o mês atual.
- Ao clicar em **Aplicar filtros**, a tela deve fazer uma nova consulta, sem reutilizar uma resposta em cache.
- Período, promotor, coordenador, UF, cidade e produto devem afetar conjuntamente cards, mapa do Brasil, estados e ranking.
- O filtro de coordenador deve restringir as visitas aos promotores vinculados ao coordenador selecionado.
- Os cards GR, GM, CM e CC representam soma de pacotes de pedidos confirmados ou entregues.
- Os títulos serão explícitos: **Pacotes — Gudang Red**, **Pacotes — Gudang Menta**, **Pacotes — Cretec Menta** e **Pacotes — Cretec Cereja**.

## Visitas

- Ao abrir o sistema ou iniciar uma nova sessão, os campos **De** e **Até** da aba Visitas recebem a data local atual.
- O usuário pode alterar ou limpar as datas depois.
- A mudança não afeta o período mensal padrão do dashboard.

## Mapa de visitas

- A linha de sequência aparece somente quando exatamente um promotor estiver selecionado no filtro próprio da aba Mapa.
- As visitas com GPS são ordenadas por `criado_em` e numeradas nessa mesma ordem.
- Cada dia forma uma linha independente, evitando ligar o fim de um dia ao início de outro.
- Quando nenhum promotor estiver selecionado, o mapa mostra os pontos sem linhas entre pessoas diferentes.
- A linha contínua de visitas e a linha tracejada da jornada permanecem visualmente distintas.

## Galeria

- A listagem continua paginada em lotes de 24 e as imagens continuam sendo solicitadas apenas quando se aproximam da área visível.
- Fotos novas usam a miniatura persistida.
- Fotos antigas sem miniatura retornam a imagem original no carregamento lazy, em vez de exibir permanentemente um placeholder.
- A abertura da foto continua buscando a versão completa.
- Falhas reais devem mostrar estado de indisponibilidade, sem confundir ausência de miniatura com ausência de foto.

## Diretoria

- Remover os botões de navegação e a página da aba **Diretoria**.
- Manter o tipo de usuário `diretoria` e encaminhá-lo para o dashboard principal.
- Remover chamadas de renderização exclusivas da página eliminada, sem afetar autenticação ou permissões.

## Validação

- Testes de API cobrem o filtro de coordenador e a composição com os demais filtros.
- Testes de frontend cobrem atualização forçada, data de hoje, rótulos de pacotes e remoção da aba Diretoria.
- Testes do mapa cobrem o seletor correto, uma linha por dia e ausência de linha com todos os promotores.
- Testes da galeria cobrem o fallback de foto antiga e preservam paginação/lazy loading.
- A suíte completa deve passar antes de commit, merge ou deploy.
