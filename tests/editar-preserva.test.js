const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/editar.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.ok(api.includes('select id, promotor, dados, fotos'), 'edicao deve carregar o registro atual completo');
assert.ok(api.includes('mesclarDadosVisita'), 'edicao deve mesclar dados atuais com alteracoes');
assert.ok(api.includes('fotosAtualizadas = fotos === undefined ? fotosAtuais : fotos'), 'fotos devem ser preservadas quando nao forem enviadas');
assert.ok(html.includes("onclick=\"editarVisita('${v.id}', visitasPromotor)\""), 'historico deve exibir acao de editar');
assert.ok(html.includes('async function editarVisita'), 'frontend deve carregar a visita antes de editar');

console.log('editar-preserva.test.js passou');
