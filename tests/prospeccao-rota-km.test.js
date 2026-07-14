const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync('api/rota-km.js', 'utf8');

assert.ok(/let \{ promotor, de, ate, incluirProspeccao \} = req\.query;/.test(src), 'rota-km deve aceitar o parametro incluirProspeccao');
assert.ok(/tipo:\s*d\?\.tipo/.test(src), 'visitasComGps deve carregar o tipo de cada visita para poder filtrar');
assert.ok(/incluirProspeccao !== 'false' \|\| v\.tipo !== 'prospeccao'/.test(src), 'deve filtrar fora prospeccao apenas quando incluirProspeccao=false for explicito');

console.log('prospeccao-rota-km.test.js passou');
