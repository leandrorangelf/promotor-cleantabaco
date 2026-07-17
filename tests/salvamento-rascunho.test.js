const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(html.includes("salvarRascunhoVisita();\n    logout(true);"), 'sessao expirada deve salvar o rascunho antes de sair');
assert.ok(html.includes('function logout(preservarFormulario = false)'), 'logout deve aceitar preservar o formulario');
assert.ok(html.includes('if (!preservarFormulario) limparFormulario();'), 'logout por sessao expirada nao deve limpar o formulario');
assert.ok(html.includes("salvarRascunhoVisita();\n\n  const btn = document.getElementById('btnSalvar');"), 'clique de salvar deve persistir o rascunho imediatamente');
assert.ok(html.includes("if (e.message !== 'Sessao expirada')"), 'erro de sessao nao deve ser mascarado como erro de conexao');
assert.ok(html.includes('function rascunhoTemConteudo'), 'rascunho deve distinguir formulario vazio de dados reais');
assert.ok(html.includes('!draft || !rascunhoTemConteudo(draft)'), 'rascunho vazio nao deve ser restaurado');

console.log('salvamento-rascunho.test.js passou');
