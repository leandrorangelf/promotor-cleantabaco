# Fluxo de Fila para Revisao Manual de Fotos

## Objetivo

Reduzir os cliques necessarios para revisar fotos na Galeria. O gestor deve conseguir analisar, aprovar ou reprovar fotos em sequencia dentro do modal, sem voltar a grade a cada item.

## Comportamento

- A Galeria continua respeitando os filtros atuais.
- Um item pendente abre em modo revisao e passa a ser a foto atual da fila.
- O modal oferece `Analisar IA`, `Aprovar` e `Reprovar` conforme o status da foto.
- Depois de uma analise ou revisao concluida, o sistema atualiza o item localmente e avanca para a proxima foto pendente.
- Depois de aprovar ou reprovar, o item e removido imediatamente da fila visivel quando o filtro atual nao inclui aquele status; o contador e a grade sao atualizados sem aguardar novo GET.
- A fila usa a lista filtrada atual e mostra a posicao/progresso.
- Se nao houver mais fotos pendentes, o modal fecha e a Galeria mostra o estado vazio atualizado.
- Falhas de IA ou de revisao nao avancam a fila automaticamente; o gestor pode tentar novamente.

## Implementacao

- Reutilizar `galeriaVisiveis`, `filaRevisaoIndex`, `abrirFoto` e `atualizarValidacaoLocal`.
- Adicionar uma acao de analise IA no painel do modal para itens sem validacao ou com status pendente.
- Centralizar o avanco para o proximo item ainda pendente depois de uma operacao bem-sucedida.
- Manter a atualizacao local sem recarregar a Galeria do servidor.
- Recalcular `galeriaVisiveis` e o resumo imediatamente apos cada atualizacao local, evitando que a foto aprovada continue aparecendo como pendente.
- Preservar a aprovacao manual existente e a auditoria no endpoint `/api/validacoes-fotos`.

## Erros e limites

- Erros de rede, Gemini ou API permanecem visiveis no toast e mantem a foto atual aberta.
- A foto e seus dados nao sao alterados; somente a validacao e atualizada.
- A navegacao anterior/proxima continua disponivel para consulta manual.

## Testes

- Verificar que o frontend possui acao de analise IA no modal de revisao.
- Verificar que o avanco automatico e chamado somente apos analise/revisao bem-sucedida.
- Preservar os testes existentes de validacao, galeria e aprovacao manual.
