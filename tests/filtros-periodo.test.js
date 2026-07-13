const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function definirPeriodoMesAtual()'), 'deve existir uma rotina para o periodo mensal padrao');
assert.ok(/definirPeriodoMesAtual\(\);[\s\S]{0,500}carregarGestor\(\)/.test(html), 'o login gestor deve iniciar carregando o mes atual');
assert.ok(/function limparFiltrosGestor\(\)\s*\{[\s\S]*?definirPeriodoMesAtual\(\);/.test(html), 'limpar filtros deve voltar ao mes atual');
assert.ok(/function definirPeriodoMesAtual\(\)[\s\S]*?getFullYear\(\)[\s\S]*?getMonth\(\)[\s\S]*?getDate\(\)/.test(html), 'o periodo deve usar a data local atual');
assert.ok(/function resetarFiltrosMapa\(\)[\s\S]*?mapaFiltroDe[\s\S]*?mapaFiltroAte/.test(html), 'o Mapa deve manter seu reset proprio');

console.log('filtros-periodo.test.js passou');
