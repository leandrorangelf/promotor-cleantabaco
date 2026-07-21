const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync('api/dashboard-resumo.js', 'utf8');

assert.ok(src.includes("import { autenticar } from './_auth.js'"));
assert.ok(src.includes("sessao.tipo === 'promotor'"));
assert.ok(src.includes("sessao.tipo === 'coordenador'"));
assert.ok(src.includes('coordenador_usuario'));
assert.ok((src.match(/EXISTS \(SELECT 1 FROM promotores p/g) || []).length >= 3,
  'coordenador deve filtrar totais, estados e ranking');
assert.strictEqual((src.match(/LEFT JOIN promotores p ON p\.nome = v\.promotor/g) || []).length, 1,
  'LEFT JOIN deve existir somente na consulta DISTINCT de opcoes');
assert.ok(src.includes('pedidoPac'));
assert.ok(src.includes('pedidoQty'));
assert.ok(src.includes('statusPedido'));
assert.ok(src.includes('Pedido confirmado'));
assert.ok(src.includes('Pedido entregue'));
assert.ok(src.includes('totais'));
assert.ok(src.includes('estados'));
assert.ok(src.includes('ranking'));
assert.ok(src.includes('opcoes'));
assert.ok(!src.includes('SELECT * FROM visitas'));

console.log('dashboard-resumo-api.test.js passou');
