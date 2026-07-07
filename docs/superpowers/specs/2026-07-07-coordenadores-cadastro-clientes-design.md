# Coordenadores E Historico Cadastral Design

## Objetivo

Adicionar um nivel de acesso `coordenador`, permitindo que um coordenador veja apenas os promotores sob sua responsabilidade, e criar base para atualizacao cadastral de clientes sem alterar visitas antigas.

## Escopo Aprovado

- Um coordenador pode ser responsavel por varios promotores.
- Cada promotor pertence a no maximo um coordenador responsavel.
- Gestor e diretoria continuam vendo todos os dados.
- Promotor continua vendo apenas os proprios dados.
- Coordenador ve apenas visitas, fotos, mapa, clientes e indicadores dos promotores vinculados a ele.
- A aba Promotores passa a cadastrar usuarios do tipo `coordenador`.
- Ao cadastrar/editar um promotor, o gestor pode escolher o coordenador responsavel.

## Modelo De Permissao

Perfis:

- `promotor`: cria visitas/revisitas e ve apenas seus dados.
- `coordenador`: ve dados dos promotores com `coordenador_usuario` igual ao seu usuario.
- `gestor`: ve todos os dados e configura usuarios.
- `diretoria`: ve todos os dados.

O backend deve aplicar as regras de permissao. A interface pode esconder opcoes, mas isso nao substitui a validacao da API.

## Dados

Tabela `promotores`:

- Adicionar coluna `coordenador_usuario TEXT`.
- Permitir `tipo = 'coordenador'`.
- Para usuarios que nao sao promotores, `coordenador_usuario` deve ficar vazio.

Tabela `clientes`:

- Manter `codigo` e melhorar o formato futuro para codigo unico de cliente.
- O codigo de cliente nao deve depender do nome do PDV.
- Mudancas cadastrais futuras devem ser registradas em historico, sem alterar visitas antigas.

## Atualizacao Cadastral Com Historico

O promotor podera solicitar/registrar atualizacao de cadastro do PDV em fluxo separado da edicao de visita antiga.

Campos permitidos:

- Nome fantasia.
- Nome do comprador/responsavel.
- Telefone.
- Endereco.
- Distribuidor.
- Observacao cadastral.
- Motivo da atualizacao: troca de comprador, mudanca de dono, mudanca de nome fantasia, correcao de cadastro, novo telefone ou outro.

Regra de historico:

- Visitas antigas permanecem intactas.
- A carteira mostra o cadastro atual do cliente.
- Cada alteracao cadastral registra valor anterior, valor novo, usuario, promotor, data e motivo.

## UI

Na aba Promotores:

- Incluir perfil `Coordenador`.
- Incluir campo `Coordenador responsavel`.
- O campo deve ser usado apenas quando o perfil selecionado for `Promotor`.
- A lista deve mostrar o coordenador vinculado a cada promotor.

Na experiencia do coordenador:

- Ao logar, entra no painel gestor com dados limitados ao seu guarda-chuva.
- Filtros de promotor mostram apenas promotores vinculados.
- Visitas, fotos, mapa, carteira e indicadores respeitam a mesma restricao.

## Fora Do Escopo Do Primeiro Incremento

- Muitos coordenadores para o mesmo promotor.
- Aprovacao formal de mudancas cadastrais.
- Transferencia automatica de cliente entre promotores.
- Treinamento de IA para materiais de marketing.

## Testes

Adicionar testes de texto/estrutura para garantir:

- `promotores` possui `coordenador_usuario`.
- `tipo` aceita `coordenador`.
- Login inclui `coordenador_usuario` no token/usuario retornado quando aplicavel.
- APIs `listar`, `foto` e `clientes` restringem coordenador aos promotores vinculados.
- UI da aba Promotores exibe perfil coordenador e campo de responsavel.
