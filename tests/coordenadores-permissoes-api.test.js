const assert = require('assert');
const fs = require('fs');

const listar = fs.readFileSync('api/listar.js', 'utf8');
const foto = fs.readFileSync('api/foto.js', 'utf8');
const clientes = fs.readFileSync('api/clientes.js', 'utf8');

for (const [nome, src] of [['listar', listar], ['foto', foto], ['clientes', clientes]]) {
  assert.ok(src.includes("sessao.tipo === 'coordenador'"), `${nome} deve tratar coordenador`);
  assert.ok(src.includes('coordenador_usuario'), `${nome} deve consultar coordenador_usuario`);
}

assert.ok(listar.includes('promotores_permitidos'), 'listar deve restringir por lista de promotores permitidos');
assert.ok(foto.includes('Sem permissao para ver fotos desta visita'), 'foto deve negar foto fora da equipe');
assert.ok(clientes.includes('promotores_permitidos'), 'clientes deve restringir carteira por lista de promotores permitidos');

console.log('coordenadores-permissoes-api.test.js passou');
