const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
const inicio = html.indexOf('function atualizarStatusPedido(status)');
const fim = html.indexOf('\n}\n', inicio) + 2;
assert.ok(inicio >= 0 && fim > inicio, 'função de atualização do pedido deve existir');

const funcao = html.slice(inicio, fim);
const abreFormulario = funcao.indexOf("document.getElementById('bloquePedidos').style.display = 'block'");
const validaValor = funcao.indexOf('valorPedidoFormulario() <= 0');

assert.ok(abreFormulario >= 0, 'confirmar pedido deve exibir o formulário de itens e preços');
assert.ok(validaValor >= 0, 'confirmar pedido deve validar o valor');
assert.ok(
  abreFormulario < validaValor,
  'o formulário deve aparecer antes da validação para permitir informar item e preço'
);

console.log('pedido-confirmacao-ui.test.js passou');
