const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/avaliar-foto.js', 'utf8');

assert.ok(api.includes('export default async function handler'), 'deve exportar handler serverless');
assert.ok(api.includes("req.method !== 'POST'"), 'deve aceitar somente POST');
assert.ok(api.includes('IA_VALIDACAO_REAL'), 'deve ter flag para ativar IA real');
assert.ok(api.includes('GEMINI_API_KEY'), 'deve ler chave Gemini somente no backend');
assert.ok(api.includes("modo: 'mock'") || api.includes('modo: "mock"'), 'deve ter resposta mockada segura');
assert.ok(api.includes('materiais_detectados'), 'resposta deve conter materiais_detectados');
assert.ok(api.includes('TABELA DE PRECOS oficial'), 'prompt deve priorizar tabela oficial');
assert.ok(api.includes('Gudang Garam') && api.includes('El Poncio'), 'prompt deve incluir textos reais da tabela');
assert.ok(api.includes('C invertido'), 'prompt deve considerar variacao visual do Cretec');
assert.ok(api.includes('verde') && api.includes('vermelho'), 'prompt deve considerar os modelos oficiais verde e vermelho');
assert.ok(api.includes('gudan garam'), 'prompt deve considerar leitura OCR aproximada de Gudang Garam');
assert.ok(api.includes('score baixo'), 'prompt deve reprovar com score baixo quando nao houver evidencia');
assert.ok(api.includes('reprovadas com score proximo de 0'), 'prompt deve reprovar imagens sem relacao com PDV');
assert.ok(!api.includes('process.env.GEMINI_API_KEY ||'), 'nao deve ter fallback hardcoded para chave');

console.log('validacao-ia-api.test.js passou');
