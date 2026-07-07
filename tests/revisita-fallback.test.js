const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('function clienteDaVisita'), 'deve converter visita anterior em cliente para revisita');
assert.ok(html.includes('function buscarClientesHistoricoRevisita'), 'deve buscar revisita tambem no historico');
assert.ok(html.includes('iniciarRevisitaVisitaId'), 'deve permitir iniciar revisita a partir de visita anterior');
assert.ok(html.includes('Historico de visitas'), 'resultado deve indicar quando veio do historico');
assert.ok(/buscarClientesHistoricoRevisita\(termo,\s*filtradosCarteira\)/.test(html), 'busca de revisita deve usar fallback por historico');

console.log('revisita-fallback.test.js passou');
