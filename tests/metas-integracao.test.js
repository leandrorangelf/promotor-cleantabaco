const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const api = fs.existsSync('api/metas.js') ? fs.readFileSync('api/metas.js', 'utf8') : '';
const performance = fs.readFileSync('performance.js', 'utf8');

assert.ok(api.includes('CREATE TABLE IF NOT EXISTS metas'), 'api/metas deve criar tabela metas');
assert.ok(api.includes('tipo_meta'), 'api/metas deve persistir tipo_meta');
assert.ok(api.includes('escopo_tipo'), 'api/metas deve persistir escopo_tipo');
assert.ok(api.includes("sessao.tipo !== 'gestor'"), 'somente gestor deve editar metas');

assert.ok(html.includes('data-gestor-page="metas"'), 'gestor deve ter aba Metas');
assert.ok(html.includes('id="gMetas"'), 'deve existir pagina gMetas');
assert.ok(html.includes('function carregarMetas'), 'deve carregar metas no frontend');
assert.ok(html.includes('data-p-page="painel"'), 'promotor deve ter tela inicial Painel');
assert.ok(html.includes('id="pPainel"'), 'deve existir painel inicial do promotor');
assert.ok(html.includes('function renderPainelPromotor'), 'deve renderizar performance do promotor');
assert.ok(html.includes('calcularPerformancePromotor'), 'frontend deve usar calculo de performance');
assert.ok(html.includes('id="metaPromotor"'), 'editor de metas deve permitir escolher promotor diretamente');
assert.ok(html.includes('salvarMetasPromotorGestor'), 'editor deve salvar pacote de metas por promotor');
assert.ok(html.includes("escopo_tipo: 'promotor'"), 'metas do editor simples devem ser gravadas por promotor');
assert.ok(html.includes('bonus_pdv_venda'), 'painel deve mostrar gatilho de PDV aberto com venda');
assert.ok(html.includes('base_clientes'), 'painel deve usar meta de base de clientes');
assert.ok(!html.includes('pedidos_mes">Pedidos no mês'), 'editor nao deve manter meta errada de pedidos no mes');
assert.ok(!html.includes('cliente_novo_positivado">Cliente novo positivado'), 'editor nao deve manter meta errada de cliente novo simples');
assert.ok(performance.includes('calcularBonificacaoPromotores'), 'performance deve reaproveitar bonus.js como fonte das regras');

console.log('metas-integracao.test.js passou');
