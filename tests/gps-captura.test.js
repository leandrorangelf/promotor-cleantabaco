const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('function obterPosicaoAtual'), 'deve existir helper obterPosicaoAtual para permitir retry');
assert.ok(html.includes('GPS demorou para responder'), 'timeout deve virar mensagem clara para o promotor/gestor');
assert.ok(/timeout:\s*25000/.test(html), 'primeira tentativa deve aguardar 25 segundos');
assert.ok(/timeout:\s*15000/.test(html), 'retry deve aguardar 15 segundos');
assert.ok(/err\?\.\s*code\s*===\s*3/.test(html) || /primeira\.codigo\s*!==\s*3/.test(html), 'deve tratar timeout code 3');

console.log('gps-captura.test.js passou');
