const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const api = fs.existsSync('api/validacoes-fotos.js') ? fs.readFileSync('api/validacoes-fotos.js', 'utf8') : '';
const listar = fs.readFileSync('api/listar.js', 'utf8');
const salvar = fs.readFileSync('api/salvar.js', 'utf8');

assert.ok(api.includes('CREATE TABLE IF NOT EXISTS validacoes_fotos'), 'deve criar tabela de validacoes de fotos');
assert.ok(api.includes('imagem_hash'), 'deve persistir hash da imagem');
assert.ok(api.includes('status_manual'), 'deve permitir aprovacao/reprovacao manual');
assert.ok(api.includes('foto_index'), 'deve identificar a foto da visita');
assert.ok(api.includes('revisado_por'), 'deve auditar quem revisou');
assert.ok(api.includes('possivel_reuso'), 'deve marcar possivel reuso de foto');
assert.ok(api.includes('GET') && api.includes('PUT') && api.includes('POST'), 'api deve listar, registrar e revisar validacoes');

assert.ok(html.includes('function fotoSrc'), 'frontend deve ser compativel com foto string ou objeto');
assert.ok(html.includes('function criarFotoComMetadados'), 'frontend deve criar metadados por foto');
assert.ok(html.includes('calcularHashFoto'), 'frontend deve calcular hash da foto');
assert.ok(html.includes('capturadaEm'), 'foto deve registrar timestamp de captura/processamento');
assert.ok(html.includes('enviadaEm'), 'foto deve registrar timestamp de envio');
assert.ok(html.includes('origem'), 'foto deve registrar origem camera/galeria');
assert.ok(html.includes('function renderGaleria'), 'gestor deve ter galeria unica de fotos/validacao IA');
assert.ok(html.includes('function revisarFotoGaleria'), 'gestor deve aprovar/reprovar manualmente');
assert.ok(html.includes('function analisarFotoGaleria'), 'gestor deve conseguir analisar fotos pendentes/legadas');
assert.ok(html.includes('/api/analisar-foto'), 'analise manual deve usar uma unica chamada no servidor');
assert.ok(html.includes('galeriaProximoCursor'), 'galeria deve manter cursor para paginacao incremental');
assert.ok(html.includes('galeriaCarregarMais'), 'galeria deve permitir carregar mais fotos');
assert.ok(html.includes('IntersectionObserver'), 'imagens da galeria devem carregar apenas quando proximas da tela');
assert.ok(html.includes('galFiltroStatus'), 'gestor deve poder filtrar por status na galeria');
assert.ok(html.includes('/api/validacoes-fotos'), 'frontend deve consumir api de validacoes');
assert.ok(html.includes('function atualizarValidacaoLocal'), 'frontend deve atualizar revisoes manuais sem recarregar todas as fotos');
assert.ok(!html.includes('await carregarGaleria();'), 'analisar/revisar foto nao deve mais recarregar a galeria inteira do servidor');
assert.ok(!html.includes('await registrarValidacoesVisita(visitaSalvaId'), 'salvar visita nao deve esperar analise de IA');
assert.ok(html.includes('function analisarFotoModal'), 'modal deve permitir analisar IA a foto atual');
assert.ok(html.includes('function avancarParaProximaFotoPendente'), 'fila deve avancar para a proxima foto pendente');
assert.ok(html.includes('function abrirFilaRevisao'), 'grade deve abrir o fluxo sequencial no modal');
assert.ok(html.includes('const fila = filaRevisaoAtual()'), 'fila deve ser recalculada localmente apos revisao');
assert.ok(html.includes('async function registrarRevisaoManual'), 'modal deve registrar aprovacao manual sem depender da IA');
assert.ok(html.includes('galeriaVisiveis[i]?.foto || lista[i]'), 'modal deve usar a foto do item atual ao navegar');

assert.ok(listar.includes('validacoes_fotos'), 'listar deve anexar validacoes de fotos nas visitas');
assert.ok(salvar.includes('RETURNING id'), 'salvar deve retornar id da visita para registrar validacoes');
assert.ok(api.includes('limiteFotos'), 'api deve limitar volume de fotos retornadas na galeria');

console.log('validacao-ia-galeria.test.js passou');
