const assert = require('assert');
const { calcularBonificacaoPromotores } = require('../bonus.js');

function visita({ promotor, data, pdv, qty = {}, statusIa = '', statusManual = '' }) {
  const validacoes = (statusIa || statusManual) ? [{ status_ia: statusIa, status_manual: statusManual }] : [];
  return {
    promotor,
    criado_em: data,
    dados: {
      pdv: { nomeFantasia: pdv },
      presenca: { tabelaValidacoesFotos: validacoes },
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

// Meta 2 (Ana): base de so 10 clientes (abaixo do minimo de 200), 5 com tabela aprovada.
// O percentual deve ser calculado sobre a base minima (200), nao sobre os 10 cadastrados,
// senao bastaria cadastrar poucos clientes e aprovar 1 tabela pra bater 50% artificialmente.
const clientesAna = [];
const visitasAna = [];
for (let i = 0; i < 10; i++) {
  const nome = `PDV Tabela ${i}`;
  clientesAna.push(cliente({ promotor: 'Ana', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasAna.push(visita({ promotor: 'Ana', data: '2026-07-10T10:00:00Z', pdv: nome, statusIa: i < 5 ? 'aprovado' : 'reprovado' }));
}

// Meta 2 (Rui): base de 10 clientes, 4 com foto aprovada pela IA (40% - nao bate a meta)
const clientesRui = [];
const visitasRui = [];
for (let i = 0; i < 10; i++) {
  const nome = `PDV Tabela Rui ${i}`;
  clientesRui.push(cliente({ promotor: 'Rui', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasRui.push(visita({ promotor: 'Rui', data: '2026-07-10T10:00:00Z', pdv: nome, statusIa: i < 4 ? 'aprovado' : 'reprovado' }));
}

// Meta 2 (Leo): base cheia de 200 clientes, 100 com tabela aprovada (50% da base real - bate a meta)
const clientesLeo = [];
const visitasLeo = [];
for (let i = 0; i < 200; i++) {
  const nome = `PDV Tabela Leo ${i}`;
  clientesLeo.push(cliente({ promotor: 'Leo', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasLeo.push(visita({ promotor: 'Leo', data: '2026-07-10T10:00:00Z', pdv: nome, statusIa: i < 100 ? 'aprovado' : 'reprovado' }));
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
  [...visitasWil, ...visitasBea, ...visitasAna, ...visitasRui, ...visitasLeo, ...visitasIvo],
  [...clientesWil, ...clientesBea, ...clientesAna, ...clientesRui, ...clientesLeo, ...clientesIvo],
  periodo
);

assert.strictEqual(resultado.Wil.metas.clienteNovoPositivado.atual, 20);
assert.strictEqual(resultado.Wil.metas.clienteNovoPositivado.valor, 300);
assert.strictEqual(resultado.Wil.metas.clienteNovoPositivado.atingida, true);
assert.strictEqual(resultado.Wil.totalBonus, 300);

assert.strictEqual(resultado.Bea.metas.clienteNovoPositivado.atual, 40);
assert.strictEqual(resultado.Bea.metas.clienteNovoPositivado.valor, 500);

assert.strictEqual(resultado.Ana.metas.tabelaVisivelBase.atual, 3);
assert.strictEqual(resultado.Ana.metas.tabelaVisivelBase.atingida, false);
assert.strictEqual(resultado.Ana.metas.tabelaVisivelBase.valor, 0);

assert.strictEqual(resultado.Rui.metas.tabelaVisivelBase.atual, 2);
assert.strictEqual(resultado.Rui.metas.tabelaVisivelBase.atingida, false);
assert.strictEqual(resultado.Rui.metas.tabelaVisivelBase.valor, 0);

assert.strictEqual(resultado.Leo.metas.tabelaVisivelBase.atual, 50);
assert.strictEqual(resultado.Leo.metas.tabelaVisivelBase.atingida, true);
assert.strictEqual(resultado.Leo.metas.tabelaVisivelBase.valor, 500);

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

// Meta 2 (Iara): revisao manual tem prioridade sobre a decisao automatica da IA
// Loja 1: IA aprovou, sem revisao -> conta
// Loja 2: IA reprovou, gestor aprovou manualmente -> conta
// Loja 3: IA aprovou, gestor reprovou manualmente -> nao conta
// Loja 4: sem nenhuma foto avaliada -> nao conta
const resultadoRevisao = calcularBonificacaoPromotores(
  [
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 1', statusIa: 'aprovado' }),
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 2', statusIa: 'reprovado', statusManual: 'aprovado' }),
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 3', statusIa: 'aprovado', statusManual: 'reprovado' }),
    visita({ promotor: 'Iara', data: '2026-07-10T10:00:00Z', pdv: 'Loja 4' })
  ],
  ['Loja 1','Loja 2','Loja 3','Loja 4'].map(nome => cliente({ promotor: 'Iara', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' })),
  periodo,
  { Iara: { tabela_percentual: 50, base_clientes: 4 } }
);
assert.strictEqual(resultadoRevisao.Iara.metas.tabelaVisivelBase.atual, 50);
assert.strictEqual(resultadoRevisao.Iara.metas.tabelaVisivelBase.atingida, true);

// Meta 3 (Zeca): 200 clientes cadastrados de verdade e visitados (bate a meta) +
// 50 clientes que só tiveram prospecção (registro rápido, sem formulário completo) —
// prospecção não deve contar nem como cadastro nem como visita pra essa meta.
const clientesZeca = [];
const visitasZeca = [];
for (let i = 0; i < 200; i++) {
  const nome = `PDV Completo Zeca ${i}`;
  clientesZeca.push(cliente({ promotor: 'Zeca', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasZeca.push(visita({ promotor: 'Zeca', data: '2026-07-15T10:00:00Z', pdv: nome }));
}
for (let i = 0; i < 50; i++) {
  const nome = `PDV Prospeccao Zeca ${i}`;
  clientesZeca.push(cliente({ promotor: 'Zeca', nome_fantasia: nome, criado_em: '2026-01-01T10:00:00Z' }));
  visitasZeca.push({
    promotor: 'Zeca',
    criado_em: '2026-07-15T10:00:00Z',
    dados: { tipo: 'prospeccao', pdv: { nomeFantasia: nome } }
  });
}
const resultadoZeca = calcularBonificacaoPromotores(visitasZeca, clientesZeca, periodo);
assert.strictEqual(resultadoZeca.Zeca.metas.baseDuzentosPdvs.atual, 200);
assert.strictEqual(resultadoZeca.Zeca.metas.baseDuzentosPdvs.atingida, true);

// Se todos os 200 "cadastrados e visitados" fossem só prospecção, a meta nao deveria bater
const resultadoSoProspeccao = calcularBonificacaoPromotores(
  Array.from({ length: 200 }, (_, i) => ({
    promotor: 'Nara',
    criado_em: '2026-07-15T10:00:00Z',
    dados: { tipo: 'prospeccao', pdv: { nomeFantasia: `PDV Nara ${i}` } }
  })),
  Array.from({ length: 200 }, (_, i) => cliente({ promotor: 'Nara', nome_fantasia: `PDV Nara ${i}`, criado_em: '2026-01-01T10:00:00Z' })),
  periodo
);
assert.strictEqual(resultadoSoProspeccao.Nara.metas.baseDuzentosPdvs.atual, 0);
assert.strictEqual(resultadoSoProspeccao.Nara.metas.baseDuzentosPdvs.atingida, false);

console.log('bonus.test.js passou');
