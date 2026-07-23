const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('data-gestor-page="clientes"'), 'gestor deve ter aba Clientes no menu');
assert.ok(html.includes('id="gClientes"'), 'deve existir pagina de clientes do gestor');
assert.ok(html.includes('id="gClientesBusca"'), 'deve existir campo de busca de clientes');
assert.ok(html.includes('id="gClientesResultados"'), 'deve existir container de resultados da busca');
assert.ok(html.includes('function renderBuscaClientesGestor'), 'deve existir renderizacao da busca de clientes');
assert.ok(/aba === 'clientes'/.test(html), 'mudarAbaG deve tratar a aba clientes');

console.log('clientes-busca-gestor.test.js passou');
