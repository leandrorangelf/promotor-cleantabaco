const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
assert.ok(!html.includes('data-gestor-page="diretoria"'), 'aba Diretoria deve ser removida');
assert.ok(!html.includes('id="gDiretoria"'), 'pagina Diretoria deve ser removida');

assert.ok(html.includes("tipo === 'coordenador'"), 'login deve tratar coordenador como painel gestor limitado');
assert.ok(html.includes("tipoAtual === 'coordenador'"), 'frontend deve reconhecer tipo coordenador');
assert.ok(html.includes('popularFiltroPromotoresPermitidos'), 'deve limitar filtro de promotores para coordenador');
assert.ok(html.includes('only-gestor'), 'acoes administrativas continuam restritas');

console.log('coordenadores-dashboard.test.js passou');
