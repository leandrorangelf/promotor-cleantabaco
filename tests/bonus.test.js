const assert = require('assert');
const { calcularBonificacaoPromotores } = require('../bonus.js');

function visita({ promotor = 'Wil', data, pdv, status = 'Sem negociacao', qty = {} }) {
  return {
    promotor,
    criado_em: data,
    dados: {
      pdv: { nomeFantasia: pdv },
      comercial: {
        statusPedido: status,
        pedidoFeito: status === 'Pedido confirmado' || status === 'Pedido entregue' ? 'Sim' : 'Nao',
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

const visitas = [];
visitas.push(visita({
  data: '2026-07-06T10:00:00Z',
  pdv: 'Cliente Novo 4 SKU',
  status: 'Pedido confirmado',
  qty: { GR: 1, GM: 1, CM: 1, CC: 1 }
}));

for (let i = 0; i < 9; i++) {
  visitas.push(visita({
    data: `2026-07-${String(6 + (i % 5)).padStart(2, '0')}T11:00:00Z`,
    pdv: `Pedido ${i}`,
    status: i % 2 ? 'Pedido entregue' : 'Pedido confirmado',
    qty: { GR: 1 }
  }));
}

for (let i = 0; i < 90; i++) {
  visitas.push(visita({
    data: `2026-07-${String(6 + (i % 5)).padStart(2, '0')}T12:00:00Z`,
    pdv: `Visita Semana 1 ${i}`
  }));
}

for (let i = 0; i < 100; i++) {
  visitas.push(visita({
    data: `2026-07-${String(13 + (i % 5)).padStart(2, '0')}T12:00:00Z`,
    pdv: `Visita Semana 2 ${i}`
  }));
}

const resultado = calcularBonificacaoPromotores(visitas);

assert.strictEqual(resultado.Wil.metas.cliente4Skus.atingida, true);
assert.strictEqual(resultado.Wil.metas.dezPedidos.atingida, true);
assert.strictEqual(resultado.Wil.metas.cemVisitasSemana.atingida, true);
assert.strictEqual(resultado.Wil.totalBonus, 1500);
assert.strictEqual(resultado.Wil.pedidos, 10);
assert.deepStrictEqual(resultado.Wil.semanas.map(s => s.visitas), [100, 100]);

const falhaSemana = calcularBonificacaoPromotores([
  visita({ data: '2026-07-06T10:00:00Z', pdv: 'A' }),
  visita({ data: '2026-07-13T10:00:00Z', pdv: 'B' })
]);

assert.strictEqual(falhaSemana.Wil.metas.cemVisitasSemana.atingida, false);
assert.strictEqual(falhaSemana.Wil.totalBonus, 0);

console.log('bonus.test.js passou');
