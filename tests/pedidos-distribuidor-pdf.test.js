const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('id="gFiltroPedidoDistribuidor"'), 'pedidos do gestor devem ter filtro por Distribuidor');
assert.ok(/distribuidor && d\.pdv\?\.distribuidor !== distribuidor/.test(html), 'filtro de pedidos deve considerar o distribuidor da visita');
assert.ok(html.includes('function exportarPedidosPDF'), 'deve existir exportacao de pedidos em PDF');
assert.ok(html.includes('onclick="exportarPedidosPDF(\'G\')"'), 'aba de pedidos do gestor deve ter botao de exportar PDF');
assert.ok(/R\$ \d+\.toFixed\(2\)|precoSku > 0 \? ' × R\$ '/.test(html) || /precoSku > 0 \? ' × R\$ '/.test(html), 'produtos do pedido devem exibir o preco negociado');

console.log('pedidos-distribuidor-pdf.test.js passou');
