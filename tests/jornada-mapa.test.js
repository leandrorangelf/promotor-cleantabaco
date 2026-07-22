const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('function carregarJornadasMapa'), 'deve carregar jornadas do backend');
assert.ok(html.includes('function renderJornadasMapa'), 'deve renderizar a trilha contínua');
assert.ok(html.includes('jornadaPolyline'), 'deve manter uma camada de trilha independente');
assert.ok(html.includes('/api/jornadas'), 'deve consultar o endpoint de jornadas');
assert.ok(html.includes('Não há pontos contínuos'), 'deve informar ausência de pontos');

for (const arquivo of ['index.html', 'app/www/index.html']) {
  const tela = fs.readFileSync(arquivo, 'utf8');
  assert.ok(tela.includes('ajustar=true'), `${arquivo}: deve pedir ajuste somente no fluxo do mapa`);
  assert.ok(tela.includes("segmento.origem === 'matched'"), `${arquivo}: deve distinguir geometria ajustada`);
  assert.ok(tela.includes("dashArray: ajustado ? undefined : '8 5'"), `${arquivo}: raw deve ser tracejado`);
  assert.ok(tela.includes('Rota ajustada às ruas'), `${arquivo}: deve explicar linha contínua`);
  assert.ok(tela.includes('Trilha GPS original'), `${arquivo}: deve explicar fallback`);
}
console.log('jornada-mapa.test.js passou');
