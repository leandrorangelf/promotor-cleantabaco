const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('id="mobileMenuToggleP"'), 'deve existir botao hamburguer mobile do promotor');
assert.ok(html.includes('id="mobileMenuToggleG"'), 'deve existir botao hamburguer mobile do gestor');
assert.ok(html.includes('id="mobileMenuDrawerP"'), 'deve existir drawer mobile do promotor');
assert.ok(html.includes('id="mobileMenuDrawerG"'), 'deve existir drawer mobile do gestor');
assert.ok(html.includes('function alternarMenuMobile'), 'deve existir funcao para abrir/fechar o menu mobile');
assert.ok(html.includes("alternarMenuMobile('P', false)"), 'o menu do promotor deve fechar ao selecionar uma aba');
assert.ok(html.includes("alternarMenuMobile('G', false)"), 'o menu do gestor deve fechar ao selecionar uma aba');

console.log('menu-mobile.test.js passou');
