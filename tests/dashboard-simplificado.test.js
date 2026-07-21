const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

['meses','promotores','coordenadores','ufs','cidades','produtos'].forEach(nome => {
  assert.ok(html.includes(`data-dashboard-filter="${nome}"`), `filtro ${nome} ausente`);
});
assert.ok(html.includes('function mesesDashboardSelecionados'));
assert.ok(html.includes('function aplicarFiltrosDashboard'));
assert.ok(html.includes('carregarDashboardResumo({ force: true })'), 'Aplicar filtros deve ignorar cache anterior');
assert.ok(html.includes("cache: force ? 'no-store' : 'default'"), 'force deve ignorar tambem o cache HTTP');
['Pacotes — Gudang Red','Pacotes — Gudang Menta','Pacotes — Cretec Menta','Pacotes — Cretec Cereja'].forEach(rotulo => {
  assert.ok(html.includes(rotulo), `${rotulo} ausente`);
});
assert.ok(html.includes('Selecionar tudo'));
assert.ok(html.includes('dashboard-filter-search'));
['dashboardVisitas','dashboardPedidos','dashboardPacotesGR','dashboardPacotesGM','dashboardPacotesCM','dashboardPacotesCC','gMapaBrasil','gRanking'].forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `${id} ausente`);
});
assert.ok(html.includes('function renderMapaBrasilResumo'));
assert.ok(html.includes('function renderRankingDashboard'));
assert.ok(html.includes('data-icon="visitas"'));
assert.ok(html.includes('<svg'));
assert.ok(!html.includes('id="gResumoInteligente"'));
assert.ok(!html.includes('id="gEvolucao"'));
assert.ok(!html.includes('id="gReceptividade"'));
[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].forEach(([,src]) => {
  if (src.trim()) new Function(src);
});
console.log('dashboard-simplificado.test.js passou');
