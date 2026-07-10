const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/clientes.js', 'utf8');

assert.ok(
  /SELECT \* FROM clientes WHERE promotor = \$\{promotor\}[\s\S]*?ORDER BY nome_fantasia LIMIT 5000/.test(api),
  'a carteira individual deve retornar todos os clientes, sem cortar em 100 registros'
);

console.log('carteira-limite.test.js passou');
