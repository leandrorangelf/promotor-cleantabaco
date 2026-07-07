const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('leaflet@1.9.4/dist/leaflet.css'), 'deve carregar o CSS do Leaflet');
assert.ok(html.includes('leaflet@1.9.4/dist/leaflet.js'), 'deve carregar o JS do Leaflet');
assert.ok(/integrity="sha256-[^"]+"[^>]*leaflet\.css/.test(html) || /leaflet\.css[\s\S]{0,60}integrity="sha256-/.test(html), 'link do Leaflet deve ter integrity (SRI)');
assert.ok(/integrity="sha256-[^"]+"[^>]*leaflet\.js/.test(html) || /leaflet\.js[\s\S]{0,80}integrity="sha256-/.test(html), 'script do Leaflet deve ter integrity (SRI)');

assert.ok(html.includes(`data-gestor-page="mapa"`), 'deve existir botao de nav para a aba Mapa');
assert.ok(html.includes(`id="gMapa"`), 'deve existir a pagina gMapa');
assert.ok(html.includes(`id="mapaFiltroPromotor"`), 'mapa deve ter filtro proprio de promotor');
assert.ok(html.includes('function aplicarFiltrosMapa()'), 'mapa deve aplicar filtros pela propria aba');
assert.ok(html.includes('sincronizarFiltrosMapa'), 'mapa deve sincronizar filtros com a visao geral');
assert.ok(html.includes(`id="mapaLeafletEl"`), 'deve existir o container do Leaflet');

assert.ok(html.includes('function renderMapa()'), 'deve existir a funcao renderMapa');
assert.ok(/if \(!mapaLeaflet\)/.test(html), 'deve ter guard contra reinicializar o mapa Leaflet mais de uma vez');
assert.ok(/mapaCamadaPontos\.clearLayers\(\)/.test(html), 'deve limpar a camada de pontos antes de redesenhar (evita residuo)');
assert.ok(/if \(aba === 'mapa'\) \{ sincronizarFiltrosMapa\(\); renderMapa\(\); \}/.test(html), 'mudarAbaG deve sincronizar filtros e chamar renderMapa ao abrir a aba');

console.log('mapa-timeline.test.js passou');
