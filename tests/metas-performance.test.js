const assert = require('assert');
const { calcularPerformancePromotor, metasPadrao, resolverMetasPromotor } = require('../performance.js');

function visita({ pdv, data, pedido = false, tabela = false }) {
  return {
    promotor: 'Ana',
    criado_em: data,
    dados: {
      pdv: { nomeFantasia: pdv, uf: 'SP' },
      presenca: { tabelaValidacoesFotos: tabela ? [{ status_ia: 'aprovado' }] : [] },
      comercial: {
        pedidoFeito: pedido ? 'Sim' : 'Nao',
        pedidoPac: pedido ? { GR: 1 } : { GR: 0 }
      }
    }
  };
}

const clientes = Array.from({ length: 180 }, (_, i) => ({
  promotor: 'Ana',
  nome_fantasia: `PDV ${i + 1}`,
  uf: 'SP',
  criado_em: i < 40 ? '2026-07-02T10:00:00Z' : '2026-06-01T10:00:00Z'
}));

const visitas = [
  ...Array.from({ length: 30 }, (_, i) => visita({ pdv: `PDV ${i + 1}`, data: '2026-07-03T10:00:00Z', pedido: true, tabela: i < 20 })),
  ...Array.from({ length: 60 }, (_, i) => visita({ pdv: `PDV ${i + 31}`, data: '2026-07-04T10:00:00Z', pedido: false, tabela: i < 30 }))
];

const metas = [
  { tipo_meta: 'base_clientes', escopo_tipo: 'global', escopo_valor: 'global', valor: 200 },
  { tipo_meta: 'base_clientes', escopo_tipo: 'uf', escopo_valor: 'SP', valor: 180 },
  { tipo_meta: 'tabela_percentual', escopo_tipo: 'global', escopo_valor: 'global', valor: 50 },
  { tipo_meta: 'bonus_pdv_venda_teto', escopo_tipo: 'global', escopo_valor: 'global', valor: 500 }
];

const resolvidas = resolverMetasPromotor({ promotor: 'Ana', uf: 'SP', metas });
assert.strictEqual(resolvidas.base_clientes, 180);
assert.strictEqual(resolvidas.tabela_percentual, 50);
assert.strictEqual(resolvidas.bonus_pdv_venda_valor, metasPadrao.bonus_pdv_venda_valor);

const perf = calcularPerformancePromotor({ promotor: 'Ana', visitas, clientes, metas, hoje: new Date('2026-07-07T12:00:00Z') });

assert.strictEqual(perf.cards.bonus_pdv_venda.atual, 30);
assert.strictEqual(perf.cards.bonus_pdv_venda.valorAtual, 450);
assert.strictEqual(perf.cards.bonus_pdv_venda.valorAlvo, 500);
assert.strictEqual(perf.cards.bonus_pdv_venda.faltam, 4);

assert.strictEqual(perf.cards.tabela_percentual.atual, 28);
assert.strictEqual(perf.cards.tabela_percentual.alvo, 50);

assert.strictEqual(perf.cards.base_ou_cobertura.label, 'Cobertura mensal da base');
assert.strictEqual(perf.cards.base_ou_cobertura.atual, 90);
assert.strictEqual(perf.cards.base_ou_cobertura.faltam, 90);

const clientes200 = Array.from({ length: 200 }, (_, i) => ({ ...clientes[0], nome_fantasia: `Base ${i + 1}` }));
const visitasCobertura = Array.from({ length: 140 }, (_, i) => visita({ pdv: `Base ${i + 1}`, data: '2026-07-05T10:00:00Z' }));
const perfCobertura = calcularPerformancePromotor({ promotor: 'Ana', visitas: visitasCobertura, clientes: clientes200, metas, hoje: new Date('2026-07-07T12:00:00Z') });
assert.strictEqual(perfCobertura.cards.base_ou_cobertura.label, 'Cobertura mensal da base');
assert.strictEqual(perfCobertura.cards.base_ou_cobertura.atual, 140);
assert.strictEqual(perfCobertura.cards.base_ou_cobertura.faltam, 40);

assert.ok(perf.proximosPassos.length > 0);

console.log('metas-performance.test.js passou');
