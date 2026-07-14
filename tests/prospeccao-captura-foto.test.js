const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('let fotoProspeccao = null;'), 'deve existir estado global fotoProspeccao');
assert.ok(html.includes('async function processarFotoProspeccao(dataUrl, origem, exifDataExterna = null)'), 'deve existir processarFotoProspeccao');
assert.ok(/fotoProspeccao = await prepararFotoProcessada/.test(html), 'processarFotoProspeccao deve reaproveitar prepararFotoProcessada');
assert.ok(html.includes('function renderFotoProspeccao()'), 'deve existir renderFotoProspeccao');
assert.ok(html.includes('function removerFotoProspeccao()'), 'deve existir removerFotoProspeccao');
assert.ok(html.includes('function acionarCapturaProspeccao()'), 'deve existir acionarCapturaProspeccao');
assert.ok(html.includes('async function tirarFotoProspeccaoNativa()'), 'deve existir tirarFotoProspeccaoNativa para o caminho nativo');
assert.ok(html.includes('function processarFotoProspeccaoInput(event)'), 'deve existir handler do input de arquivo da prospeccao');
assert.ok(html.includes("document.getElementById('fotoProspeccaoInput').click()"), 'acionarCapturaProspeccao deve cair no input de arquivo fora do app nativo');

console.log('prospeccao-captura-foto.test.js passou');
