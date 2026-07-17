# GPS contínuo da jornada — Design

## Objetivo

Registrar automaticamente o deslocamento do promotor durante os dias úteis, das 08:00 às 18:00 no fuso `America/Sao_Paulo`, mesmo com a tela apagada ou o app em segundo plano, e disponibilizar a trilha para o gestor.

## Escopo

- O rastreamento contínuo será exclusivo do app Android Capacitor.
- O navegador continuará registrando somente o GPS pontual da visita.
- O serviço será iniciado automaticamente às 08:00 e encerrado automaticamente às 18:00, de segunda a sexta.
- O promotor poderá iniciar/parar manualmente e verá sempre o estado atual.
- Não haverá rastreamento fora da janela configurada.
- Pontos de visita e pontos da jornada serão armazenados separadamente.

## Arquitetura escolhida

Será criado um serviço Android nativo em primeiro plano (`ForegroundService`) responsável pelo `requestLocationUpdates`. O JavaScript apenas exibe o estado, solicita as permissões e troca comandos com a ponte nativa; um timer na WebView não será responsável pelo rastreamento.

O Android agendará alarmes para 08:00 e 18:00 usando `AlarmManager` e reagendará os alarmes após reinicialização do aparelho. Ao iniciar, o serviço exibirá uma notificação permanente, manterá o wakelock somente durante a coleta e solicitará pontos a cada 60 segundos ou quando houver deslocamento de pelo menos 50 metros. O serviço será interrompido ao atingir 18:00, no logout ou no comando manual de parada.

O serviço enviará lotes de até 50 pontos. Cada ponto terá `latitude`, `longitude`, `precisao`, `altitude`, `velocidade`, `direcao`, `capturadoEm` e uma chave idempotente `pontoId`. Sem rede, os lotes permanecerão em armazenamento local do Android; após reconexão, serão reenviados sem duplicar pontos.

## Fluxo de dados

1. O login do promotor registra a sessão no app e sincroniza o estado da jornada.
2. Às 08:00, o alarme inicia a jornada no backend e o serviço foreground começa a coletar.
3. O serviço mantém a fila local e envia lotes para `POST /api/jornada-pontos`.
4. O backend associa os pontos ao promotor autenticado e à jornada aberta, rejeitando pontos fora da janela ou de outra sessão.
5. Às 18:00, o serviço envia a fila restante, fecha a jornada com `POST /api/jornada-encerrar` e remove a notificação.
6. O gestor consulta jornadas e pontos por período/promotor e visualiza a linha no mapa, separada dos marcadores de visitas.

## Contratos de API

### `POST /api/jornada-iniciar`

Recebe `{ dispositivoId, iniciadoEm, origem }` e retorna `{ ok, jornadaId, status }`. A operação será idempotente por promotor e data local: se já houver uma jornada aberta para o dia, retorna a jornada existente.

### `POST /api/jornada-pontos`

Recebe `{ jornadaId, pontos: [{ pontoId, latitude, longitude, precisao, altitude, velocidade, direcao, capturadoEm }] }` e retorna `{ ok, aceitos, duplicados, rejeitados }`. O servidor validará tipos, limites geográficos, timestamp e propriedade da jornada.

### `POST /api/jornada-encerrar`

Recebe `{ jornadaId, encerradoEm, motivo }` e retorna `{ ok, status }`. Repetições não causarão erro.

### `GET /api/jornadas`

Disponível para gestor/coordenador/diretoria, com filtros `promotor`, `inicio`, `fim`. Retorna jornadas e pontos para o mapa; promotores não terão acesso a jornadas de outros usuários.

Cada handler criará suas tabelas com `CREATE TABLE IF NOT EXISTS`, seguindo o padrão atual do projeto. A tabela de pontos terá `UNIQUE (jornada_id, ponto_id)` e índices por jornada, promotor e horário.

## Permissões e falhas

- Solicitar localização precisa, localização em segundo plano e notificações com explicação antes do primeiro rastreamento.
- Se a permissão de segundo plano for negada, não iniciar o modo contínuo e mostrar instrução para habilitá-la nas configurações.
- Se o usuário revogar a permissão, o serviço marcará a jornada como interrompida e exibirá o motivo ao reabrir o app.
- Se o Android encerrar o processo, `BOOT_COMPLETED` e o próximo alarme tentarão restaurar o serviço dentro da janela.
- Se o backend estiver indisponível, a fila offline terá limite de 24 horas; pontos mais antigos serão descartados com um estado visível de sincronização.
- O token de autenticação não será gravado em texto nos pontos; a ponte usará o armazenamento seguro já existente no app.

## UI do promotor

O painel exibirá um cartão com “Rastreamento ativo”, último ponto capturado, última sincronização e quantidade na fila offline. Também mostrará o motivo quando estiver parado: fora do horário, permissão ausente, sem rede ou encerrado manualmente.

## Verificação

- Testes de texto para os contratos da API, janela de horário, idempotência, fila e permissões Android.
- Testes unitários nativos para início/parada nos horários, reinicialização e deduplicação.
- Build `assembleDebug` após `npx cap sync android`.
- Teste manual em aparelho/emulador: app fechado, tela apagada, início às 08h, parada às 18h, perda de rede, retorno de rede, revogação de permissão e reinicialização do aparelho.

## Decisões pendentes de validação no teste manual

- O Android pode limitar a frequência real do GPS conforme fabricante, modo de economia e qualidade do sinal; o app registrará a frequência efetiva, sem prometer um ponto exato por minuto.
- A linha do mapa deverá indicar lacunas quando não houver pontos, em vez de interpolar deslocamentos não registrados.

## Status de implementação

- Implementado em 2026-07-17 na branch `main`.
- API de jornadas, serviço foreground, fila SQLite offline, scheduler de dias úteis, restauração após boot, ponte Capacitor, cartão do promotor e trilha no mapa foram adicionados.
- Verificado com testes de contrato Node, `npx cap copy android` e `assembleDebug`.
- Ainda requer teste manual em aparelho/emulador para confirmar permissões de segundo plano, economia de bateria, tela apagada, perda de rede e o disparo real dos alarmes às 08h/18h.
