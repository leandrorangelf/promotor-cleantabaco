const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes(`onclick="abrirModalProspeccao()"`), 'deve existir botao que abre o modal de prospeccao');
assert.ok(html.includes('id="modalProspeccao"'), 'deve existir o modal de prospeccao');
assert.ok(html.includes('id="prospeccaoNome"'), 'modal deve ter campo de nome do local');
assert.ok(html.includes('id="fotoProspeccaoInput"'), 'modal deve ter input de arquivo para foto');
assert.ok(html.includes('id="prospeccaoFotoGrid"'), 'modal deve ter grid para mostrar a foto capturada');
assert.ok(html.includes('id="btnSalvarProspeccao"'), 'modal deve ter botao de salvar');
assert.ok(html.includes('function abrirModalProspeccao()'), 'deve existir funcao abrirModalProspeccao');
assert.ok(html.includes('function fecharModalProspeccao()'), 'deve existir funcao fecharModalProspeccao');
assert.ok(/abrirModalProspeccao\(\)\s*\{[\s\S]{0,300}classList\.add\('open'\)/.test(html), 'abrirModalProspeccao deve abrir o overlay com classList.add(open)');
assert.ok(/fecharModalProspeccao\(\)\s*\{\s*document\.getElementById\('modalProspeccao'\)\.classList\.remove\('open'\)/.test(html), 'fecharModalProspeccao deve fechar com classList.remove(open)');

console.log('prospeccao-modal.test.js passou');
