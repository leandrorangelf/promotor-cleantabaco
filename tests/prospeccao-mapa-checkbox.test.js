const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('id="mapaIncluirProspeccao"'), 'mapa deve ter checkbox para incluir/excluir prospeccao do km');
assert.ok(/mapaIncluirProspeccao['"]\)\?\.checked/.test(html), 'carregarKmRota deve ler o estado do checkbox');
assert.ok(/incluirProspeccao=\$\{incluirProspeccao\}/.test(html), 'carregarKmRota deve repassar o parametro na URL da API');
assert.ok(html.includes(`onclick="aplicarFiltrosMapa()"`), 'aplicarFiltrosMapa continua sendo o gatilho existente de recarregar o mapa');

console.log('prospeccao-mapa-checkbox.test.js passou');
