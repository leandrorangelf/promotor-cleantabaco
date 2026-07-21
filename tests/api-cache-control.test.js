const assert = require('assert');
const fs = require('fs');

[
  'api/listar.js',
  'api/clientes.js',
  'api/validacoes-fotos.js'
].forEach(file => {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(
    src.includes("res.setHeader('Cache-Control', 'no-store')") ||
    src.includes('res.setHeader("Cache-Control", "no-store")'),
    `${file} deve desativar cache HTTP para dados dinamicos`
  );
});

const foto = fs.readFileSync('api/foto.js', 'utf8');
assert.ok(foto.includes("res.setHeader('Cache-Control', 'private, max-age=300')"), 'foto individual deve usar cache privado curto');

console.log('api-cache-control.test.js passou');
