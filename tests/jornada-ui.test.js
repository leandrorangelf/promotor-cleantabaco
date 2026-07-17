const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
for (const id of ['jornadaStatus', 'jornadaUltimoPonto', 'jornadaPendentes']) {
  assert.ok(html.includes(`id="${id}"`), `deve existir ${id}`);
}
assert.ok(html.includes('function inicializarJornada'), 'deve inicializar jornada no login');
assert.ok(html.includes('function atualizarStatusJornada'), 'deve atualizar cartão de jornada');
assert.ok(html.includes('Capacitor.isNativePlatform'), 'deve separar app nativo do navegador');
assert.ok(html.includes('jornada-bridge.js'), 'deve carregar a ponte somente quando necessário');
console.log('jornada-ui.test.js passou');
