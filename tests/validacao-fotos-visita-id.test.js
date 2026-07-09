const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/validacoes-fotos.js', 'utf8');

assert.ok(api.includes('visita_id TEXT NOT NULL'), 'coluna visita_id deve ser TEXT para suportar UUID');
assert.ok(api.includes('ALTER COLUMN visita_id TYPE TEXT'), 'deve migrar coluna existente de INTEGER para TEXT');
assert.ok(!api.includes('Number(visita_id)'), 'nao deve mais converter visita_id para numero');
assert.ok(!/const ids = visitas\.map\(v => Number\(v\.id\)\)/.test(api), 'GET nao deve mais converter v.id para numero');

const listar = fs.readFileSync('api/listar.js', 'utf8');
assert.ok(!/const ids = rows\.map\(v => Number\(v\.id\)\)/.test(listar), 'listar.js nao deve mais converter v.id para numero');

const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes("analisarFotoGaleria('" + "$" + "{item.visita_id}', " + "$" + "{item.foto_index})"), 'onclick de analisarFotoGaleria deve envolver visita_id em aspas');
assert.ok(html.includes("analisarValidacaoPendente('" + "$" + "{item.visita_id}', " + "$" + "{item.foto_index})"), 'onclick de analisarValidacaoPendente deve envolver visita_id em aspas');
assert.ok(html.includes("abrirFotoGaleriaIA('" + "$" + "{item.visita_id}', " + "$" + "{item.foto_index})"), 'onclick de abrirFotoGaleriaIA deve envolver visita_id em aspas');

console.log('validacao-fotos-visita-id.test.js passou');
