(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.calcularBonificacaoPromotores = api.calcularBonificacaoPromotores;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const SKUS_BONUS = ['GR', 'GM', 'CM', 'CC'];
  const VALOR_META = 500;

  function normalizarTexto(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function statusDaVisitaBonus(visita) {
    const comercial = visita?.dados?.comercial || {};
    if (comercial.statusPedido) return comercial.statusPedido;
    if (comercial.pedidoEntregue) return 'Pedido entregue';
    if (comercial.pedidoFeito === 'Sim') return 'Pedido confirmado';
    return 'Sem negociacao';
  }

  function pedidoConfirmado(visita) {
    const status = statusDaVisitaBonus(visita);
    return status === 'Pedido confirmado' || status === 'Pedido entregue';
  }

  function quantidadesPedido(visita) {
    const comercial = visita?.dados?.comercial || {};
    return comercial.pedidoPac || comercial.pedidoQty || {};
  }

  function vendeuQuatroSkus(visita) {
    const qty = quantidadesPedido(visita);
    return SKUS_BONUS.every(sku => Number(qty[sku] || 0) > 0);
  }

  function chavePdv(visita) {
    const pdv = visita?.dados?.pdv || {};
    return normalizarTexto(pdv.cnpj || pdv.nomeFantasia);
  }

  function inicioSemana(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  function criarResumo(nome) {
    return {
      promotor: nome,
      visitas: 0,
      pedidos: 0,
      clientesNovos4Skus: 0,
      totalBonus: 0,
      semanas: [],
      metas: {
        cliente4Skus: { atingida: false, valor: 0, atual: 0, alvo: 1 },
        dezPedidos: { atingida: false, valor: 0, atual: 0, alvo: 10 },
        cemVisitasSemana: { atingida: false, valor: 0, atual: 0, alvo: 100 }
      }
    };
  }

  function calcularBonificacaoPromotores(visitas) {
    const porPromotor = {};
    const vistosPorPromotor = {};
    const semanasPorPromotor = {};

    [...(visitas || [])]
      .sort((a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0))
      .forEach(visita => {
        const nome = visita?.promotor || 'Sem promotor';
        if (!porPromotor[nome]) porPromotor[nome] = criarResumo(nome);
        if (!vistosPorPromotor[nome]) vistosPorPromotor[nome] = new Set();
        if (!semanasPorPromotor[nome]) semanasPorPromotor[nome] = {};

        const resumo = porPromotor[nome];
        resumo.visitas++;
        if (pedidoConfirmado(visita)) resumo.pedidos++;

        const semana = inicioSemana(visita.criado_em || Date.now());
        semanasPorPromotor[nome][semana] = (semanasPorPromotor[nome][semana] || 0) + 1;

        const pdv = chavePdv(visita);
        if (pdv && !vistosPorPromotor[nome].has(pdv)) {
          vistosPorPromotor[nome].add(pdv);
          if (vendeuQuatroSkus(visita)) resumo.clientesNovos4Skus++;
        }
      });

    Object.entries(porPromotor).forEach(([nome, resumo]) => {
      resumo.semanas = Object.entries(semanasPorPromotor[nome] || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([inicio, visitasSemana]) => ({ inicio, visitas: visitasSemana }));

      resumo.metas.cliente4Skus.atingida = resumo.clientesNovos4Skus >= 1;
      resumo.metas.cliente4Skus.atual = resumo.clientesNovos4Skus;
      resumo.metas.cliente4Skus.valor = resumo.metas.cliente4Skus.atingida ? VALOR_META : 0;

      resumo.metas.dezPedidos.atingida = resumo.pedidos >= 10;
      resumo.metas.dezPedidos.atual = resumo.pedidos;
      resumo.metas.dezPedidos.valor = resumo.metas.dezPedidos.atingida ? VALOR_META : 0;

      const semanas = resumo.semanas;
      const semanasOk = semanas.length > 0 && semanas.every(s => s.visitas >= 100);
      resumo.metas.cemVisitasSemana.atingida = semanasOk;
      resumo.metas.cemVisitasSemana.atual = semanas.length ? Math.min(...semanas.map(s => s.visitas)) : 0;
      resumo.metas.cemVisitasSemana.valor = semanasOk ? VALOR_META : 0;

      resumo.totalBonus =
        resumo.metas.cliente4Skus.valor +
        resumo.metas.dezPedidos.valor +
        resumo.metas.cemVisitasSemana.valor;
    });

    return porPromotor;
  }

  return {
    calcularBonificacaoPromotores,
    statusDaVisitaBonus,
    vendeuQuatroSkus,
    inicioSemana
  };
});
