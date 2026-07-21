const assert = require('assert');
const fs = require('fs');
const api = fs.readFileSync('api/dashboard-resumo.js', 'utf8');

assert.ok(api.includes("res.setHeader('Server-Timing'"));
assert.ok(!api.includes('validacoes_fotos'));
assert.ok(!/SELECT[^;]+\bfotos\b/i.test(api));
console.log('dashboard-response-budget.test.js passou');
