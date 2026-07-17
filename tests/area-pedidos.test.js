const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes("data-p-page=\"pedidos\""), 'promotor deve ter aba Pedidos');
assert.ok(html.includes("data-gestor-page=\"pedidos\""), 'gestor/coordenador deve ter aba Pedidos');
assert.ok(html.includes('id="pPedidos"'), 'deve existir pagina de pedidos do promotor');
assert.ok(html.includes('id="gPedidos"'), 'deve existir pagina de pedidos do gestor');
assert.ok(html.includes('id="pFiltroPedidoBusca"'), 'pedidos devem ter busca livre');
assert.ok(html.includes('id="gFiltroPedidoBusca"'), 'gestao deve ter busca livre');
assert.ok(html.includes('function renderPedidos'), 'deve existir renderizacao compartilhada de pedidos');
assert.ok(html.includes('function exportarPedidosCSV'), 'deve manter exportacao de pedidos');
assert.ok(/sem edição/i.test(html), 'area de pedidos deve ser somente leitura');
assert.ok(html.includes('.pedidos-filtros { display: grid;'), 'filtros de pedidos devem usar grid');
assert.ok(html.includes('.pedidos-page > .pedidos-filtros'), 'conteudo de pedidos deve ter largura e alinhamento próprios');

console.log('area-pedidos.test.js passou');
