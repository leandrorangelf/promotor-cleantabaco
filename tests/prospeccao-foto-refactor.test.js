const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('async function prepararFotoProcessada(dataUrl, origem, exifDataExterna = null)'), 'deve existir helper prepararFotoProcessada reaproveitavel');
assert.ok(/async function prepararFotoProcessada\(dataUrl, origem, exifDataExterna = null\) \{[\s\S]*?return criarFotoComMetadados/.test(html), 'prepararFotoProcessada deve retornar o resultado de criarFotoComMetadados, sem push');
assert.ok(/async function processarImagemCapturada\(dataUrl, origem, exifDataExterna = null\) \{\s*fotos\.push\(await prepararFotoProcessada\(dataUrl, origem, exifDataExterna\)\);\s*renderFotos\(\);\s*\}/.test(html), 'processarImagemCapturada deve delegar para prepararFotoProcessada e manter o push em fotos');

console.log('prospeccao-foto-refactor.test.js passou');
