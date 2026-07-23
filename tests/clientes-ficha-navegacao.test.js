const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function abrirFichaClienteGestor'), 'deve existir funcao para abrir a ficha do cliente');
assert.ok(html.includes('function fecharFichaClienteGestor'), 'deve existir funcao para fechar a ficha e voltar a busca');
assert.ok(html.includes('function mudarSubAbaFichaCliente'), 'deve existir navegacao entre sub-abas da ficha');
assert.ok(html.includes('data-ficha-subtab="resumo"'), 'ficha deve ter sub-aba Resumo');
assert.ok(html.includes('data-ficha-subtab="pedidos"'), 'ficha deve ter sub-aba Pedidos');
assert.ok(html.includes('data-ficha-subtab="visitas"'), 'ficha deve ter sub-aba Visitas');
assert.ok(html.includes('id="fichaSubpageResumo"'), 'deve existir container da sub-aba Resumo');
assert.ok(html.includes('id="fichaSubpagePedidos"'), 'deve existir container da sub-aba Pedidos');
assert.ok(html.includes('id="fichaSubpageVisitas"'), 'deve existir container da sub-aba Visitas');
assert.ok(html.includes('clienteMatchesVisita(cliente, v)') || html.includes('clienteMatchesVisita(fichaClienteAtual, v)'), 'ficha deve casar visitas com o cliente via clienteMatchesVisita');

console.log('clientes-ficha-navegacao.test.js passou');
