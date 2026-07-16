const assert = require('assert');
const { calcularPerformancePromotor, metasPadrao, resolverMetasPromotor } = require('../performance.js');
const { calcularBonificacaoPromotores } = require('../bonus.js');

function visita({ promotor = 'Ana', pdv, cnpj, data, pedido = false, tabela = false }) {
  return {
    promotor,
    criado_em: data,
    dados: {
      pdv: { nomeFantasia: pdv, ...(cnpj ? { cnpj } : {}), uf: 'SP' },
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
assert.strictEqual(perf.cards.base_ou_cobertura.atual, 40);
assert.strictEqual(perf.cards.base_ou_cobertura.faltam, 140);

const clientes200 = Array.from({ length: 200 }, (_, i) => ({ ...clientes[0], nome_fantasia: `Base ${i + 1}` }));
const visitasCobertura = Array.from({ length: 140 }, (_, i) => visita({ pdv: `Base ${i + 1}`, data: '2026-07-05T10:00:00Z' }));
const perfCobertura = calcularPerformancePromotor({ promotor: 'Ana', visitas: visitasCobertura, clientes: clientes200, metas, hoje: new Date('2026-07-07T12:00:00Z') });
assert.strictEqual(perfCobertura.cards.base_ou_cobertura.label, 'Cobertura mensal da base');
assert.strictEqual(perfCobertura.cards.base_ou_cobertura.atual, 140);
assert.strictEqual(perfCobertura.cards.base_ou_cobertura.faltam, 40);

assert.ok(perf.proximosPassos.length > 0);

const periodoJulho = { de: '2026-07-01T00:00:00Z', ate: '2026-07-31T23:59:59Z' };
const bonusWil = calcularBonificacaoPromotores(
  [
    visita({ promotor: 'Wil', pdv: 'Wil 1', data: '2026-07-03T10:00:00Z', pedido: true }),
    visita({ promotor: 'Wil', pdv: 'Wil 2', data: '2026-07-03T10:00:00Z', pedido: true })
  ],
  [
    { promotor: 'Wil', nome_fantasia: 'Wil 1', criado_em: '2026-07-02T10:00:00Z' },
    { promotor: 'Wil', nome_fantasia: 'Wil 2', criado_em: '2026-07-02T10:00:00Z' }
  ],
  periodoJulho,
  { Wil: { bonus_pdv_venda_valor: 15, bonus_pdv_venda_teto: 500, base_clientes: 200, tabela_percentual: 50 } }
).Wil;
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.atual, 2);
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.valor, 30);
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.valorUnitario, 15);
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.teto, 500);
assert.strictEqual(bonusWil.metas.clienteNovoPositivado.clientesNovos, 2);

const aprovacaoIa = visita({ promotor: 'Ana', pdv: 'Tabela IA', data: '2026-07-03T10:00:00Z' });
aprovacaoIa.dados.presenca.tabelaValidacoesFotos = [{ status_manual: 'pendente', status_ia: 'aprovado' }];
const tabelaResumo = calcularBonificacaoPromotores(
  [aprovacaoIa],
  [{ promotor: 'Ana', nome_fantasia: 'Tabela IA', criado_em: '2026-06-01T10:00:00Z' }],
  periodoJulho
).Ana;
assert.strictEqual(tabelaResumo.metas.tabelaVisivelBase.comTabela, 1);
assert.strictEqual(tabelaResumo.metas.tabelaVisivelBase.carteira, 1);

const visitasDuplicadas = [
  visita({ promotor: 'Ana', pdv: 'Cobertura 1', cnpj: '11.111.111/0001-11', data: '2026-07-03T10:00:00Z' }),
  visita({ promotor: 'Ana', pdv: 'Cobertura 1', cnpj: '11.111.111/0001-11', data: '2026-07-04T10:00:00Z' })
];
const coberturaResumo = calcularBonificacaoPromotores(
  visitasDuplicadas,
  [{ promotor: 'Ana', cnpj: '11.111.111/0001-11', nome_fantasia: 'Cobertura 1', criado_em: '2026-07-02T10:00:00Z' }],
  periodoJulho
).Ana;
assert.strictEqual(coberturaResumo.metas.baseDuzentosPdvs.atual, 1);
assert.strictEqual(coberturaResumo.metas.baseDuzentosPdvs.visitados, 1);

const coberturaIgnoraClienteAntigo = calcularBonificacaoPromotores(
  [
    visita({ promotor: 'Ana', pdv: 'Cliente antigo', cnpj: '22.222.222/0001-22', data: '2026-07-03T10:00:00Z' }),
    visita({ promotor: 'Ana', pdv: 'Cliente vigente', cnpj: '33.333.333/0001-33', data: '2026-07-03T10:00:00Z' })
  ],
  [
    { promotor: 'Ana', cnpj: '22.222.222/0001-22', nome_fantasia: 'Cliente antigo', criado_em: '2026-06-01T10:00:00Z' },
    { promotor: 'Ana', cnpj: '33.333.333/0001-33', nome_fantasia: 'Cliente vigente', criado_em: '2026-07-02T10:00:00Z' }
  ],
  periodoJulho
).Ana;
assert.strictEqual(coberturaIgnoraClienteAntigo.metas.baseDuzentosPdvs.atual, 1);
assert.strictEqual(coberturaIgnoraClienteAntigo.metas.baseDuzentosPdvs.visitados, 1);

const visitasSemAprovacao = [
  visita({ promotor: 'Ana', pdv: 'Reprovada', data: '2026-07-03T10:00:00Z' }),
  visita({ promotor: 'Ana', pdv: 'Pendente', data: '2026-07-03T10:00:00Z' })
];
visitasSemAprovacao[0].dados.presenca.tabelaValidacoesFotos = [{ status_manual: 'reprovado', status_ia: 'pendente' }];
visitasSemAprovacao[1].dados.presenca.tabelaValidacoesFotos = [{ status_manual: 'pendente', status_ia: 'pendente' }];
const semAprovacao = calcularBonificacaoPromotores(
  visitasSemAprovacao,
  [
    { promotor: 'Ana', nome_fantasia: 'Reprovada', criado_em: '2026-06-01T10:00:00Z' },
    { promotor: 'Ana', nome_fantasia: 'Pendente', criado_em: '2026-06-01T10:00:00Z' }
  ],
  periodoJulho
).Ana;
assert.strictEqual(semAprovacao.metas.tabelaVisivelBase.comTabela, 0);

const semIdentificador = calcularBonificacaoPromotores(
  [visita({ promotor: 'Ana', pdv: 'Sem chave', data: '2026-07-03T10:00:00Z', pedido: true })],
  [{ promotor: 'Ana', criado_em: '2026-07-02T10:00:00Z' }],
  periodoJulho
).Ana;
assert.strictEqual(semIdentificador.metas.clienteNovoPositivado.atual, 0);
assert.strictEqual(semIdentificador.metas.baseDuzentosPdvs.atual, 0);

console.log('metas-performance.test.js passou');
