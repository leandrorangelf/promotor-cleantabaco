# Filtro de data independente na aba Mapa

## Objetivo

A aba Mapa deve abrir sempre filtrada pelo dia atual, sem compartilhar ou sobrescrever os filtros de data da Visão geral ou de outras abas.

## Desenho

- O Mapa terá estado próprio para seus dados (`visitasMapa`) e continuará usando seus próprios campos `mapaFiltroDe`, `mapaFiltroAte` e `mapaFiltroPromotor`.
- Ao entrar na aba Mapa, os dois campos de data serão redefinidos para o dia atual e uma consulta específica do Mapa será carregada.
- Aplicar filtros ou limpar filtros no Mapa não alterará os campos `gFiltroDe` e `gFiltroAte`, nem substituirá `visitasGestor`.
- A consulta do Mapa enviará apenas os filtros do Mapa à API; os filtros locais da Visão geral não participarão do resultado.

## Testes

O teste textual da aba Mapa deve verificar a existência do estado/carregamento próprio, o reset de data na entrada da aba e a remoção da sincronização bidirecional entre campos `gFiltro*` e `mapaFiltro*`.
