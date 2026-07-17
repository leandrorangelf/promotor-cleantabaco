const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('function carregarJornadasMapa'), 'deve carregar jornadas do backend');
assert.ok(html.includes('function renderJornadasMapa'), 'deve renderizar a trilha contínua');
assert.ok(html.includes('jornadaPolyline'), 'deve manter uma camada de trilha independente');
assert.ok(html.includes('/api/jornadas'), 'deve consultar o endpoint de jornadas');
assert.ok(html.includes('Não há pontos contínuos'), 'deve informar ausência de pontos');
console.log('jornada-mapa.test.js passou');
