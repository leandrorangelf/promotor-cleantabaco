const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/avaliar-foto.js', 'utf8');

assert.ok(api.includes('export default async function handler'), 'deve exportar handler serverless');
assert.ok(api.includes("req.method !== 'POST'"), 'deve aceitar somente POST');
assert.ok(api.includes('IA_VALIDACAO_REAL'), 'deve ter flag para ativar IA real');
assert.ok(api.includes('GEMINI_API_KEY'), 'deve ler chave Gemini somente no backend');
assert.ok(api.includes("modo: 'mock'") || api.includes('modo: "mock"'), 'deve ter resposta mockada segura');
assert.ok(api.includes('materiais_detectados'), 'resposta deve conter materiais_detectados');
assert.ok(!api.includes('process.env.GEMINI_API_KEY ||'), 'nao deve ter fallback hardcoded para chave');

console.log('validacao-ia-api.test.js passou');
