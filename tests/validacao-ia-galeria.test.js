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
assert.ok(html.includes('renderGaleriaIA'), 'gestor deve ter galeria de validacao IA');
assert.ok(html.includes('revisarValidacaoFoto'), 'gestor deve aprovar/reprovar manualmente');
assert.ok(html.includes('analisarValidacaoPendente'), 'gestor deve conseguir analisar fotos pendentes/legadas');
assert.ok(html.includes('Atualizar galeria'), 'gestor deve ter botao para recarregar a galeria');
assert.ok(html.includes('/api/validacoes-fotos'), 'frontend deve consumir api de validacoes');

assert.ok(listar.includes('validacoes_fotos'), 'listar deve anexar validacoes de fotos nas visitas');
assert.ok(salvar.includes('RETURNING id'), 'salvar deve retornar id da visita para registrar validacoes');
assert.ok(api.includes('limiteFotos'), 'api deve limitar volume de fotos retornadas na galeria');

console.log('validacao-ia-galeria.test.js passou');
