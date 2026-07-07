const assert = require('assert');
const fs = require('fs');

const promotores = fs.readFileSync('api/promotores.js', 'utf8');
const login = fs.readFileSync('api/login.js', 'utf8');

assert.ok(promotores.includes('coordenador_usuario'), 'promotores deve ter coordenador_usuario');
assert.ok(promotores.includes('coordenador'), 'promotores deve aceitar perfil coordenador');
assert.ok(promotores.includes('ALTER TABLE promotores ADD COLUMN IF NOT EXISTS coordenador_usuario TEXT'), 'deve migrar coluna coordenador_usuario');
assert.ok(promotores.includes('coordenador_usuario ='), 'PUT deve salvar coordenador_usuario');
assert.ok(login.includes('coordenador_usuario'), 'login deve retornar coordenador_usuario');
assert.ok(login.includes('criarToken({ usuario: contaLogada.usuario, nome: contaLogada.nome, tipo: contaLogada.tipo, coordenador_usuario: contaLogada.coordenador_usuario })'), 'token deve incluir coordenador_usuario');

console.log('coordenadores-promotores.test.js passou');
