# Mapa com trilha ajustada, filtros organizados e prévias da galeria

## Objetivo

Melhorar a experiência de supervisão em três pontos relacionados:

1. mostrar no mapa o caminho efetivamente registrado pela Jornada GPS, ajustado à malha de ruas e caminhos;
2. reorganizar filtros e cartões da aba Mapa no desktop;
3. restaurar as prévias das fotos na Galeria.

A trilha ajustada é uma representação derivada. Os pontos GPS brutos continuam sendo a evidência original e nunca são substituídos.

## Escopo

### Incluído

- Ajuste da trilha GPS contínua à malha viária por map matching.
- Segmentação do percurso em deslocamento motorizado e possível caminhada.
- Preservação de desvios, retornos, sequência e horários capturados.
- Fallback visual para a trilha GPS bruta quando o ajuste não estiver disponível.
- Nova organização desktop dos filtros, ações, resumo de quilômetros, mapa e lista de trechos.
- Correção do atributo usado pelo carregamento sob demanda das miniaturas da Galeria.
- Alterações espelhadas em `index.html` e `app/www/index.html`.
- Testes automatizados do contrato da API e das regressões do frontend.

### Não incluído

- Navegação curva a curva para o promotor.
- Planejamento de uma rota ideal entre clientes.
- Alteração retroativa dos pontos GPS originais.
- Garantia de reconstrução de intervalos sem pontos suficientes.
- Implantação de infraestrutura própria de mapas nesta primeira versão.

## Princípios de fidelidade

- A ordem temporal dos pontos é soberana.
- O sistema ajusta uma trilha observada; não recalcula a melhor rota entre início e fim.
- Intervalos superiores a 15 minutos continuam separados e não recebem uma ligação inventada.
- Pontos rejeitados ou segmentos sem correspondência permanecem disponíveis para fallback.
- A interface identifica a linha como `Rota ajustada às ruas` ou `Trilha GPS original`.
- “Caminho exato” significa a aproximação mais fiel permitida pela frequência e precisão do GPS e pela cobertura da malha viária; não significa precisão de faixa ou calçada.

## Arquitetura da rota

### Dados de entrada

A fonte é a Jornada GPS já persistida, incluindo, quando disponíveis:

- latitude e longitude;
- horário de captura;
- precisão informada pelo dispositivo;
- sequência da jornada e do promotor.

Os pontos são validados e ordenados no servidor. Coordenadas inválidas são descartadas da derivação, sem serem apagadas do registro original.

### Segmentação

O servidor divide a trilha primeiro por descontinuidade temporal. Dentro de cada trecho contínuo, usa velocidade estimada entre pontos, duração e distância para identificar blocos prováveis de deslocamento motorizado ou caminhada.

A classificação deve ser conservadora: oscilações isoladas não trocam o perfil. Pequenos blocos lentos podem usar o perfil de caminhada; os demais usam o perfil de direção, adequado a carro e moto. Os limites serão constantes nomeadas e cobertas por testes, para permitir calibração posterior com dados reais.

### Serviço de map matching

A primeira implementação usa uma API hospedada de map matching com perfis de direção e caminhada. A integração fica encapsulada no servidor, sem expor credenciais no frontend. O provedor é configurável por variável de ambiente para permitir substituição futura.

Cada requisição envia os pontos na ordem original, timestamps e raios derivados da precisão do GPS quando suportados. Trechos maiores que o limite do provedor são divididos em janelas com sobreposição; a resposta é recomposta sem duplicar a região de união.

O servidor não deve usar um endpoint público comunitário como dependência de produção sem garantia de serviço.

### Contrato da API

A rota de jornada passa a devolver, além dos dados atuais, uma coleção de segmentos com formato estável:

```json
{
  "segmentos": [
    {
      "perfil": "driving",
      "origem": "matched",
      "pontos": [[-23.0, -46.0]],
      "inicio_em": "2026-07-22T12:00:00.000Z",
      "fim_em": "2026-07-22T12:15:00.000Z"
    }
  ],
  "ajuste": {
    "status": "completo",
    "provedor": "configurado"
  }
}
```

`origem` pode ser `matched` ou `raw`. `status` pode ser `completo`, `parcial`, `indisponivel` ou `sem_dados`. O frontend depende desse contrato, não do formato específico do provedor.

### Cache e custo

O resultado derivado deve ser armazenado em cache por identidade do promotor, período e assinatura dos pontos. A mesma trilha não deve gerar chamadas repetidas ao provedor. Novos pontos invalidam apenas o período afetado.

### Falhas

- Token ou configuração ausente: devolver segmentos brutos e status `indisponivel`.
- Timeout ou erro do provedor: devolver segmentos brutos e registrar erro sem bloquear o mapa.
- Correspondência parcial: combinar segmentos ajustados e brutos, com status `parcial`.
- Poucos pontos: mostrar pontos/linha bruta e explicar que não há dados suficientes para ajuste.

## Apresentação do mapa

- A trilha ajustada usa linha roxa contínua.
- Um segmento bruto de fallback usa linha roxa tracejada.
- Marcadores de visitas permanecem em camada independente.
- O status informa quantidade de pontos, tipo de linha exibida e eventuais trechos sem ajuste.
- A seleção de período e promotor continua determinando tanto a trilha quanto os quilômetros.
- O mapa usa a geometria ajustada somente para visualização e distância derivada; os pontos originais permanecem consultáveis.

## Layout desktop da aba Mapa

O problema atual decorre de duas linhas de filtros com composições diferentes. A nova estrutura usa um único cartão de filtros:

- primeira faixa em grade: Promotor, De, Até e opção Incluir prospecção;
- segunda faixa: botões `Aplicar no mapa` e `Limpar`, alinhados à direita;
- abaixo do filtro: mensagens de status em uma área reservada;
- resumo de quilômetros em cartão próprio, sem compartilhar grade com filtros;
- mapa em largura total;
- lista de quilômetros por trecho abaixo do mapa, em cartão próprio.

No desktop, os três campos têm alturas e alinhamento de rótulo consistentes. O checkbox não usa um rótulo vazio para simular espaçamento. Em larguras menores, a grade reduz colunas progressivamente sem sobreposição.

## Prévias da Galeria

### Causa confirmada

O HTML gera `data-galeria-url`, que no DOM corresponde a `dataset.galeriaUrl`. A função de carregamento tenta acessar `dataset.url`; por isso monta uma requisição inválida, captura o erro e mantém a imagem sem `src`.

### Correção

- Ler `img.dataset.galeriaUrl` no carregador sob demanda.
- Manter a chamada autenticada por `apiFetch` para `/api/foto`.
- Em sucesso, preencher `src` e guardar a foto no item local.
- Em falha, mostrar estado de imagem indisponível sem loop de novas requisições.
- Aplicar o mesmo comportamento no frontend web e no pacote Android.

## Segurança e privacidade

- O token do provedor de mapas fica somente no servidor.
- A API de fotos continua exigindo a sessão e as permissões já existentes.
- URLs protegidas de fotos não são convertidas em links públicos.
- Logs de map matching não devem registrar tokens nem a trilha integral.

## Estratégia de testes

### Rota

- Segmentação por intervalo temporal.
- Classificação conservadora entre direção e caminhada.
- Divisão e recomposição quando houver limite de pontos por chamada.
- Preservação da ordem e dos timestamps.
- Cache para uma trilha idêntica.
- Fallback total e parcial em falhas do provedor.
- Contrato da API independente do fornecedor.

### Mapa

- Presença da nova estrutura sem rótulo vazio no checkbox.
- Renderização distinta de segmentos `matched` e `raw`.
- Filtros continuam sendo enviados ao carregamento da jornada e do cálculo de quilômetros.
- Verificação renderizada em viewport desktop e uma largura menor, incluindo ausência de sobreposição.

### Galeria

- Teste de regressão exige correspondência entre `data-galeria-url` e `dataset.galeriaUrl`.
- Teste cobre as duas cópias do frontend.
- Testes existentes de paginação, autenticação e modal continuam passando.

## Critérios de aceite

- Uma jornada com GPS suficiente aparece acompanhando as ruas, preservando desvios e retornos observados.
- Trechos sem correspondência não desaparecem e são mostrados como trilha bruta.
- Nenhuma lacuna temporal longa é ligada como se tivesse sido percorrida.
- No desktop, filtros, checkbox e ações não se sobrepõem nem ficam desalinhados.
- O cartão de quilômetros e a lista de trechos não ficam misturados com o cartão de filtros.
- As miniaturas da Galeria aparecem sem exigir a abertura do modal.
- Web e Android mantêm o mesmo comportamento.
- Falha do serviço de ajuste não impede o uso do mapa.

