const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('Pacotes produzidos no mês'), 'painel do promotor deve mostrar pacotes produzidos no mês');
assert.ok(html.includes('pPacotesMesCard'), 'painel do promotor deve ter card dedicado de pacotes');
assert.ok(html.includes("function pacotesProduzidosNoMes"), 'deve existir calculo mensal de pacotes produzidos');
assert.ok(!html.includes("{ id:'pdvs', cor:"), 'dashboard principal nao deve exibir card redundante de PDVs');
assert.ok(!html.includes("{ id:'ruptura', cor:"), 'dashboard principal nao deve exibir card redundante de ruptura');
assert.ok(!html.includes("{ id:'produto', cor:"), 'dashboard principal nao deve exibir card redundante de produto');
assert.ok(!html.includes("{ id:'entregues', cor:"), 'dashboard principal nao deve exibir card redundante de entregues');

console.log('dashboard-pacotes.test.js passou');
