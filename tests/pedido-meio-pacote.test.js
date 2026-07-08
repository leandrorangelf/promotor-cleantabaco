const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

['GR', 'GM', 'CM', 'CC'].forEach(sku => {
  assert.ok(
    html.includes(`onclick="alterarQty('qty${sku}',-0.5)"`),
    `botao de menos do ${sku} deve decrementar 0.5`
  );
  assert.ok(
    html.includes(`onclick="alterarQty('qty${sku}',0.5)"`),
    `botao de mais do ${sku} deve incrementar 0.5`
  );
});

assert.ok(
  html.includes('function lerQtyPac(id)'),
  'deve existir o helper lerQtyPac para parsear quantidade com virgula decimal'
);
assert.ok(
  !/parseInt\(document\.getElementById\('qty/.test(html),
  'leitura de quantidade de pacote nao deve mais usar parseInt'
);

console.log('pedido-meio-pacote.test.js passou');
