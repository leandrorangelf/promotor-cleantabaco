const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function lerExifDataOriginal(buffer)'), 'deve existir parser de EXIF');
assert.ok(html.includes('0x9003'), 'deve ler a tag DateTimeOriginal (0x9003) do EXIF');
assert.ok(html.includes('0x8769'), 'deve seguir o ponteiro para o Exif SubIFD (0x8769)');
assert.ok(html.includes('carimbarDataHora(ctx, w, h)'), 'fotos de camera devem receber carimbo visivel de data/hora');
assert.ok(html.includes("origem === 'camera') carimbarDataHora"), 'carimbo so deve ser aplicado em fotos de origem camera');
assert.ok(html.includes('exifDivergente'), 'foto deve carregar a flag exifDivergente quando a data EXIF diverge do envio');
assert.ok(html.includes('foto-aviso'), 'grid de fotos deve exibir aviso visual quando exifDivergente for verdadeiro');

console.log('exif-timestamp.test.js passou');
