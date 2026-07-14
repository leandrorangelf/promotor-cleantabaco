const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(/d\.tipo === 'prospeccao'/.test(html), 'renderHistorico deve verificar o tipo prospeccao');
assert.ok(html.includes('🔍 Prospecção'), 'deve existir badge visual identificando prospeccao no historico');

console.log('prospeccao-historico.test.js passou');
