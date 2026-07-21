const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('api/analisar-foto.js', 'utf8');
const validacoes = fs.readFileSync('api/validacoes-fotos.js', 'utf8');

assert.ok(src.includes("import { autenticar } from './_auth.js'"));
assert.ok(src.includes('reanalisar'));
assert.ok(src.includes("status_ia = 'analisando'"));
assert.ok(src.includes('ON CONFLICT'));
assert.ok(src.includes('modelo_ia'));
assert.ok(src.includes('input_tokens'));
assert.ok(src.includes('output_tokens'));
assert.ok(src.includes('custo_usd_estimado'));
assert.ok(src.includes('reutilizada: true'));
assert.ok(src.includes('avaliarFotoConfigurada'));
assert.ok(validacoes.includes('ADD COLUMN IF NOT EXISTS modelo_ia'));
assert.ok(validacoes.includes('ADD COLUMN IF NOT EXISTS input_tokens'));
console.log('validacao-ia-fluxo.test.js passou');
