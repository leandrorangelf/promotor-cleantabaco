const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const salvar = fs.readFileSync('api/salvar.js', 'utf8');
const editar = fs.readFileSync('api/editar.js', 'utf8');

assert.ok(html.includes('function validarValorPedidoConfirmado'), 'frontend deve validar valor antes de confirmar pedido');
assert.ok(/validarValorPedidoConfirmado\(dados\)/.test(html), 'salvamento deve chamar validacao do valor do pedido');
assert.ok(html.includes("dados.comercial.statusPedido = 'Em negociação'"), 'pedido sem valor deve voltar para em negociacao para permitir finalizar a visita');
assert.ok(html.includes('Pedido confirmado ou entregue exige valor'), 'mensagem deve explicar a exigencia de valor');
assert.ok(salvar.includes('Pedido confirmado ou entregue exige valor'), 'api salvar deve bloquear pedido confirmado sem valor');
assert.ok(editar.includes('Pedido confirmado ou entregue exige valor'), 'api editar deve bloquear pedido confirmado sem valor');

console.log('pedido-valor-obrigatorio.test.js passou');
