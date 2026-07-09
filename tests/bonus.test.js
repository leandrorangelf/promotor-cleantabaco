const assert = require('assert');
const { calcularBonificacaoPromotores } = require('../bonus.js');

function visita({ promotor, data, pdv, qty = {}, comFoto = false }) {
  return {
    promotor,
    criado_em: data,
    fotos_count: comFoto ? 1 : 0,
    dados: {
      pdv: { nomeFantasia: pdv },
      presenca: {},
      comercial: {
        pedidoPac: {
          GR: qty.GR || 0,
          GM: qty.GM || 0,
          CM: qty.CM || 0,
          CC: qty.CC || 0
        }
      }
    }
  };
}

function cliente({ promotor, nome_fantasia, criado_em }) {
  return { promotor, nome_fantasia, cnpj: '', criado_em };
}

const periodo = { de: '2026-07-01T00:00:00Z', ate: '2026-07-31T23:59:59Z' };

// Meta 1 (Wil): 20 clientes novos no periodo, todos positivados com 1 SKU (20 * 15 = 300, abaixo do teto de 500)
const clientesWil = [];
const visitasWil = [];
for (let i = 0; i < 20; i++) {
  const nome = `Cliente Novo ${i}`;
  clientesWil.push(cliente({ promotor: 'Wil', nome_fantasia: nome, criado_em: '2026-07-05T10:00:00Z' }));
  visitasWil.push(visita({ promotor: 'Wil', data: '2026-07-06T10:00:00Z', pdv: nome, qty: { GR: 1 } }));
}

// Meta 1 (Bea): 40 clientes novos positivados - teto de R$500 nao pode ser ultrapassado
const clientesBea = [];
const visitasBea = [];
for (let i = 0; i < 40; i++) {
  const nome = `Cliente Teto ${i}`;
  clientesBea.push(cliente({ promotor: 'Bea', nome_fantasia: nome, criado_em: '2026-07-05T10:00:00Z' }));
  visitasBea.push(visita({ promotor: 'Bea', data: '2026-07-06T10:00:00Z', pdv: nome, qty: { GR: 1 } }));
}

// Meta 2 (Ana): base de 10 clientes, 5 com pelo menos 1 foto no periodo (50% - bate a meta)
const clientesAna = [];
const visitasAna = [];
for (let i = 0; i < 10; i++) {
  const nome = `PDV Tabela ${i}`;
  clientesAna.push(cliente({ promotor: 'Ana', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasAna.push(visita({ promotor: 'Ana', data: '2026-07-10T10:00:00Z', pdv: nome, comFoto: i < 5 }));
}

// Meta 2 (Rui): base de 10 clientes, 4 com pelo menos 1 foto (40% - nao bate a meta)
const clientesRui = [];
const visitasRui = [];
for (let i = 0; i < 10; i++) {
  const nome = `PDV Tabela Rui ${i}`;
  clientesRui.push(cliente({ promotor: 'Rui', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasRui.push(visita({ promotor: 'Rui', data: '2026-07-10T10:00:00Z', pdv: nome, comFoto: i < 4 }));
}

// Meta 3 (Ivo): 200 PDVs cadastrados e visitados no periodo
const clientesIvo = [];
const visitasIvo = [];
for (let i = 0; i < 200; i++) {
  const nome = `PDV Base ${i}`;
  clientesIvo.push(cliente({ promotor: 'Ivo', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasIvo.push(visita({ promotor: 'Ivo', data: '2026-07-15T10:00:00Z', pdv: nome }));
}

const resultado = calcularBonificacaoPromotores(
  [...visitasWil, ...visitasBea, ...visitasAna, ...visitasRui, ...visitasIvo],
  [...clientesWil, ...clientesBea, ...clientesAna, ...clientesRui, ...clientesIvo],
  periodo
);

assert.strictEqual(resultado.Wil.metas.clienteNovoPositivado.atual, 20);
assert.strictEqual(resultado.Wil.metas.clienteNovoPositivado.valor, 300);
assert.strictEqual(resultado.Wil.metas.clienteNovoPositivado.atingida, true);
assert.strictEqual(resultado.Wil.totalBonus, 300);

assert.strictEqual(resultado.Bea.metas.clienteNovoPositivado.atual, 40);
assert.strictEqual(resultado.Bea.metas.clienteNovoPositivado.valor, 500);

assert.strictEqual(resultado.Ana.metas.tabelaVisivelBase.atual, 50);
assert.strictEqual(resultado.Ana.metas.tabelaVisivelBase.atingida, true);
assert.strictEqual(resultado.Ana.metas.tabelaVisivelBase.valor, 500);

assert.strictEqual(resultado.Rui.metas.tabelaVisivelBase.atual, 40);
assert.strictEqual(resultado.Rui.metas.tabelaVisivelBase.atingida, false);
assert.strictEqual(resultado.Rui.metas.tabelaVisivelBase.valor, 0);

assert.strictEqual(resultado.Ivo.metas.baseDuzentosPdvs.atual, 200);
assert.strictEqual(resultado.Ivo.metas.baseDuzentosPdvs.atingida, true);
assert.strictEqual(resultado.Ivo.metas.baseDuzentosPdvs.valor, 500);
assert.strictEqual(resultado.Ivo.totalBonus, 500);

// Fora do periodo filtrado nao conta para cliente novo
const resultadoForaPeriodo = calcularBonificacaoPromotores(
  [visita({ promotor: 'Tom', data: '2026-06-06T10:00:00Z', pdv: 'X', qty: { GR: 1 } })],
  [cliente({ promotor: 'Tom', nome_fantasia: 'X', criado_em: '2026-06-05T10:00:00Z' })],
  periodo
);
assert.strictEqual(resultadoForaPeriodo.Tom.metas.clienteNovoPositivado.valor, 0);
assert.strictEqual(resultadoForaPeriodo.Tom.totalBonus, 0);

const resultadoConfigurado = calcularBonificacaoPromotores(
  [
    visita({ promotor: 'Geo', data: '2026-07-10T10:00:00Z', pdv: 'G1' }),
    visita({ promotor: 'Geo', data: '2026-07-10T10:00:00Z', pdv: 'G2' })
  ],
  [
    cliente({ promotor: 'Geo', nome_fantasia: 'G1', criado_em: '2026-01-01T10:00:00Z' }),
    cliente({ promotor: 'Geo', nome_fantasia: 'G2', criado_em: '2026-01-01T10:00:00Z' })
  ],
  periodo,
  { Geo: { base_clientes: 2, tabela_percentual: 50, bonus_pdv_venda_valor: 15, bonus_pdv_venda_teto: 500 } }
);
assert.strictEqual(resultadoConfigurado.Geo.metas.baseDuzentosPdvs.alvo, 2);
assert.strictEqual(resultadoConfigurado.Geo.metas.baseDuzentosPdvs.atingida, true);

// Meta 2 (Iara): tabela conta pela presenca de foto na visita, independente de avaliacao de IA
const resultadoFoto = calcularBonificacaoPromotores(
  [
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 1', comFoto: true }),
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 2', comFoto: true }),
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 3', comFoto: false }),
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 4', comFoto: false })
  ],
  ['Loja 1','Loja 2','Loja 3','Loja 4'].map(nome => cliente({ promotor: 'Iara', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' })),
  periodo,
  { Iara: { tabela_percentual: 50 } }
);
assert.strictEqual(resultadoFoto.Iara.metas.tabelaVisivelBase.atual, 50);
assert.strictEqual(resultadoFoto.Iara.metas.tabelaVisivelBase.atingida, true);

console.log('bonus.test.js passou');
