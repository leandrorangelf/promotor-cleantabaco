const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('async function salvarProspeccao()'), 'deve existir salvarProspeccao');
assert.ok(/tipo:\s*'prospeccao'/.test(html), 'dados enviados devem marcar tipo prospeccao');
assert.ok(/pdv:\s*\{\s*nomeFantasia:\s*nome\s*\}/.test(html), 'prospeccao deve enviar so nomeFantasia no pdv, sem os demais campos do formulario completo');
assert.ok(/localizacao\s*=\s*await capturarLocalizacaoAtual\(\)/.test(html), 'prospeccao deve capturar GPS na hora de salvar, igual a visita normal');
assert.ok(/prepararFotosParaEnvio\(\[fotoProspeccao\]\)/.test(html), 'prospeccao deve reaproveitar prepararFotosParaEnvio com a foto unica');
assert.ok(/await apiFetch\(`\$\{API\}\/api\/salvar`/.test(html), 'prospeccao deve usar o endpoint api/salvar ja existente, sem endpoint novo');

console.log('prospeccao-salvar.test.js passou');
