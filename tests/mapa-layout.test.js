const assert = require('assert');
const fs = require('fs');

for (const arquivo of ['index.html', 'app/www/index.html']) {
  const html = fs.readFileSync(arquivo, 'utf8');
  assert.ok(html.includes('class="mapa-filtros-grid"'), `${arquivo}: deve ter uma grade única`);
  assert.ok(html.includes('class="mapa-filtros-acoes"'), `${arquivo}: ações devem ter faixa própria`);
  assert.ok(html.includes('class="mapa-checkbox-group"'), `${arquivo}: checkbox deve ter alinhamento próprio`);
  assert.ok(html.includes('id="mapaKmTrechosCard"'), `${arquivo}: trechos devem ter cartão próprio`);
  assert.ok(!/<label>&nbsp;<\/label>[\s\S]{0,180}mapaIncluirProspeccao/.test(html), `${arquivo}: não deve alinhar checkbox com rótulo vazio`);
  assert.match(
    html,
    /\.mapa-filtros-grid\s*\{[^}]*grid-template-columns:\s*minmax\(220px,\s*2fr\)\s*repeat\(2,\s*minmax\(150px,\s*1fr\)\)\s*minmax\(220px,\s*1\.3fr\)/,
    `${arquivo}: desktop deve ter quatro colunas explícitas`
  );
}

console.log('mapa-layout.test.js passou');
