const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function ultimoPedidoCliente'), 'deve existir funcao que encontra o ultimo pedido do cliente');
assert.ok(/ultimoPedidoCliente\(cliente\)[\s\S]{0,200}pedidoFeito === 'Sim'/.test(html), 'ultimo pedido deve exigir visita com pedido feito');
assert.ok(/const ultimoPedido = ultimoPedidoCliente\(c\)/.test(html), 'revisita rapida deve buscar o ultimo pedido do cliente');
assert.ok(/qtyEl\.textContent = String\(qty\[sku\] \|\| 0\)/.test(html), 'revisita rapida deve pre-preencher as quantidades por SKU do ultimo pedido');
assert.ok(/Último pedido carregado/.test(html), 'aviso de revisita deve informar quando o ultimo pedido foi pre-carregado');

console.log('revisita-ultimo-pedido.test.js passou');
