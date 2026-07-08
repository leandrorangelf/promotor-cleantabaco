const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('.kpi-status-pill'), 'CSS deve definir o badge de status do card de metas');
assert.ok(html.includes('.kpi-icon'), 'CSS deve definir o icone do card de metas');
assert.ok(html.includes('.kpi-bar-fill'), 'CSS deve definir a barra de progresso nova');
assert.ok(html.includes("bonus_pdv_venda: '💰'"), 'deve mapear icone do card de bonus de PDV');
assert.ok(html.includes("tabela_percentual: '📊'"), 'deve mapear icone do card de % de tabela');
assert.ok(html.includes("base_ou_cobertura: '🏪'"), 'deve mapear icone do card de base/cobertura');
assert.ok(html.includes('kpi-status-pill'), 'template do card deve usar a classe do badge de status');
assert.ok(!html.includes('height:6px;background:#EEF1F7'), 'barra de progresso antiga em linha deve ser removida do template');

console.log('painel-metas-visual.test.js passou');
