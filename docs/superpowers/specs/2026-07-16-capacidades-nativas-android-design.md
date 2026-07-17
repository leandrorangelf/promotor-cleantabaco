# Capacidades nativas do app Android — Design

## Objetivo

Dar ao app Android do promotor capacidades que a versão web não oferece de forma confiável: navegação mobile, autenticação persistente com biometria, captura nativa de fotos com timestamp e rastreamento contínuo de jornada.

## Decisões

- `index.html` na raiz continua sendo a fonte da interface web; o conteúdo será sincronizado para `app/www` antes do build Android.
- O menu mobile será um drawer hamburguer; desktop mantém a navegação atual.
- O token de sessão continuará expirando conforme o backend atual. A senha nunca será armazenada.
- A biometria desbloqueia um token armazenado no Android Keystore; digital/rosto não são enviados ao servidor.
- O lembrete de início será permitido somente de segunda a sexta, entre 08:00 e 18:00, usando detecção de atividade de baixo consumo.
- O rastreamento completo começa somente após a ação explícita “Iniciar expediente”.
- O rastreamento usa serviço foreground de localização, notificação persistente, fila local offline e envio periódico ao backend.
- A câmera nativa grava timestamp visível na imagem e os metadados de captura no registro enviado; o servidor também registra o horário de recebimento.

## Fluxo de jornada

1. O app registra transições de atividade sem manter GPS contínuo ativo.
2. Ao detectar deslocamento dentro da janela, envia uma notificação com a ação “Iniciar expediente”.
3. Ao aceitar, o app inicia o serviço foreground de localização e cria uma jornada no backend.
4. O serviço coleta pontos com latitude, longitude, precisão, velocidade e timestamp.
5. Sem rede, os pontos ficam em fila local; quando a rede volta, são enviados em lote.
6. “Encerrar expediente” para o serviço e fecha a jornada. O gestor visualiza a trilha separada dos pontos de visita.

## Segurança e permissões

- Solicitar notificações, localização precisa, localização em segundo plano, atividade física e câmera com explicação contextual.
- Mostrar estado visível do rastreamento e permitir parada manual.
- Não iniciar localização contínua sem interação do promotor.
- O Android pode interromper o rastreamento se o usuário revogar permissões ou forçar o encerramento do app; o app deve registrar esse estado quando voltar a abrir.

## Verificação

- Testes de texto para menu, persistência, timestamp e contratos de API.
- Build `assembleDebug` após sincronização dos assets.
- Teste manual em aparelho Android: notificação de movimento, início/encerramento, tela apagada, perda de rede, foto com timestamp e restauração por biometria.
