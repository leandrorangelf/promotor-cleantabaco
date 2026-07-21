const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('/api/dashboard-resumo'));
assert.ok(html.includes('dashboardResumoCache'));
assert.ok(html.includes('dashboardRequestId'));
assert.ok(html.includes('AbortController'));
assert.ok(!/async function carregarDashboardResumo[\s\S]{0,2200}\/api\/clientes/.test(html));
assert.ok(!/async function carregarDashboardResumo[\s\S]{0,2200}\/api\/listar/.test(html));
console.log('dashboard-performance.test.js passou');
