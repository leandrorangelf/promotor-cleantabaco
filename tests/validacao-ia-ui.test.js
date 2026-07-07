const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('Validacao IA') || html.includes('Validação IA'), 'deve mostrar area Validacao IA');
assert.ok(html.includes('id="iaFotoInput"'), 'deve ter input de foto para IA');
assert.ok(html.includes("document.getElementById('iaFotoInput').click()"), 'deve ter botao visivel para abrir seletor de foto');
assert.ok(html.includes('onchange="prepararFotoIA(event)"'), 'deve guardar a foto quando selecionada');
assert.ok(html.includes('let iaFotoSelecionada'), 'deve manter foto selecionada em memoria');
assert.ok(html.includes('id="iaFotoStatus"'), 'deve mostrar status da foto selecionada');
assert.ok(html.includes('id="iaFotoPreview"'), 'deve mostrar preview da foto selecionada');
assert.ok(html.includes('function analisarFotoIA'), 'deve ter funcao analisarFotoIA');
assert.ok(html.includes('function prepararFotoIA'), 'deve ter funcao prepararFotoIA');
assert.ok(html.includes('/api/avaliar-foto'), 'deve chamar a rota isolada de avaliacao');
assert.ok(html.includes('id="iaResultado"'), 'deve ter container para resultado');
assert.ok(!html.includes('GEMINI_API_KEY'), 'frontend nao deve expor GEMINI_API_KEY');

console.log('validacao-ia-ui.test.js passou');
