const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function renderFichaResumo'), 'deve existir renderizacao do resumo do cliente');
assert.ok(html.includes('function renderFichaPedidos'), 'deve existir renderizacao dos pedidos do cliente');
assert.ok(html.includes('function renderFichaVisitas'), 'deve existir renderizacao das visitas do cliente');
assert.ok(/Total de visitas/.test(html), 'resumo deve mostrar total de visitas');
assert.ok(/Total de pedidos/.test(html), 'resumo deve mostrar total de pedidos');
assert.ok(/Valor total comprado/.test(html), 'resumo deve mostrar valor total comprado');
assert.ok(/Pacotes totais/.test(html), 'resumo deve mostrar pacotes totais');
assert.ok(/M.dia entre visitas/.test(html), 'resumo deve mostrar media de dias entre visitas');
assert.ok(/.ltima visita/.test(html), 'resumo deve mostrar data da ultima visita');
assert.ok(/.ltimo pedido/.test(html), 'resumo deve mostrar data do ultimo pedido');
assert.ok(/renderFichaPedidos[\s\S]{0,900}abrirDetalheGestor/.test(html), 'linhas de pedidos da ficha devem abrir o modal de detalhe existente');
assert.ok(/renderFichaVisitas[\s\S]{0,900}abrirDetalheGestor/.test(html), 'linhas de visitas da ficha devem abrir o modal de detalhe existente');

console.log('clientes-ficha-conteudo.test.js passou');
