const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const deletar = fs.readFileSync('api/deletar.js', 'utf8');

assert.ok(html.includes("btn-detalhes"), 'historico do promotor deve manter botao de detalhes');
assert.ok(!html.includes("onclick=\"editarVisita('${v.id}')\""), 'historico do promotor nao deve exibir editar visita');
assert.ok(!html.includes("onclick=\"excluirVisitaPromotor('${v.id}')\""), 'historico do promotor nao deve exibir excluir visita');
assert.ok(!html.includes('async function excluirVisitaPromotor'), 'frontend do promotor nao deve ter funcao de exclusao');
assert.ok(deletar.includes('if (!souGestor)'), 'api deve restringir delete a gestor');
assert.ok(deletar.includes('Apenas gestores podem excluir visitas'), 'api deve retornar erro claro para promotor');
assert.ok(!deletar.includes('delete from visitas where id = ${id} and promotor = ${sessao.nome}'), 'api nao deve deletar visita por promotor');

console.log('permissoes-visitas.test.js passou');
