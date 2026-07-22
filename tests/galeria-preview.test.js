const assert = require('assert');
const fs = require('fs');

for (const arquivo of ['index.html', 'app/www/index.html']) {
  const html = fs.readFileSync(arquivo, 'utf8');
  assert.ok(html.includes('data-galeria-url='), `${arquivo}: deve declarar a URL lazy`);
  assert.ok(html.includes('img.dataset.galeriaUrl'), `${arquivo}: deve ler data-galeria-url pelo nome DOM correto`);
  assert.ok(!html.includes('`${API}${img.dataset.url}`'), `${arquivo}: não deve ler dataset.url inexistente`);
  assert.match(
    html,
    /apiFetch\(`\$\{API\}\$\{img\.dataset\.galeriaUrl\}`,[\s\S]{0,80}headers:\s*headers\(\)/,
    `${arquivo}: miniatura deve manter autenticação`
  );
}

console.log('galeria-preview.test.js passou');
