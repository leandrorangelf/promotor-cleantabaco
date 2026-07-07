const assert = require('assert');
const { calcularPerformancePromotor, metasPadrao, resolverMetasPromotor } = require('../performance.js');

const visitas = [
  { promotor: 'Ana', criado_em: '2026-07-02T10:00:00Z', dados: { pdv: { nomeFantasia: 'PDV 1' }, presenca: { tabelaVisivel: true }, comercial: { pedidoFeito: 'Sim', statusPedido: 'Pedido confirmado' } } },
  { promotor: 'Ana', criado_em: '2026-07-03T10:00:00Z', dados: { pdv: { nomeFantasia: 'PDV 2' }, presenca: { tabelaVisivel: false }, comercial: { pedidoFeito: 'Nao', statusPedido: 'Sem negociação' } } },
  { promotor: 'Ana', criado_em: '2026-06-03T10:00:00Z', dados: { pdv: { nomeFantasia: 'PDV 3' }, presenca: { tabelaVisivel: true }, comercial: { pedidoFeito: 'Sim', statusPedido: 'Pedido confirmado' } } }
];

const clientes = [
  { promotor: 'Ana', nome_fantasia: 'PDV 1', uf: 'SP', criado_em: '2026-07-01T10:00:00Z' },
  { promotor: 'Ana', nome_fantasia: 'PDV 2', uf: 'SP', criado_em: '2026-07-01T10:00:00Z' },
  { promotor: 'Ana', nome_fantasia: 'PDV 3', uf: 'SP', criado_em: '2026-06-01T10:00:00Z' }
];

const metas = [
  { tipo_meta: 'pdvs_cadastrados', escopo_tipo: 'global', escopo_valor: 'global', valor: 200 },
  { tipo_meta: 'pdvs_cadastrados', escopo_tipo: 'uf', escopo_valor: 'SP', valor: 120 },
  { tipo_meta: 'pedidos_mes', escopo_tipo: 'promotor', escopo_valor: 'Ana', valor: 5 }
];

const resolvidas = resolverMetasPromotor({ promotor: 'Ana', uf: 'SP', metas });
assert.strictEqual(resolvidas.pdvs_cadastrados, 120);
assert.strictEqual(resolvidas.pedidos_mes, 5);
assert.strictEqual(resolvidas.tabela_percentual, metasPadrao.tabela_percentual);

const perf = calcularPerformancePromotor({ promotor: 'Ana', visitas, clientes, metas, hoje: new Date('2026-07-07T12:00:00Z') });
assert.strictEqual(perf.cards.pdvs_cadastrados.atual, 3);
assert.strictEqual(perf.cards.pdvs_cadastrados.faltam, 117);
assert.strictEqual(perf.cards.pdvs_visitados_mes.atual, 2);
assert.strictEqual(perf.cards.tabela_percentual.atual, 33);
assert.strictEqual(perf.cards.pedidos_mes.atual, 1);
assert.strictEqual(perf.cards.pedidos_mes.faltam, 4);
assert.ok(perf.proximosPassos.length > 0);

console.log('metas-performance.test.js passou');
