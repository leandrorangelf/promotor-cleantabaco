(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.calcularPerformancePromotor = api.calcularPerformancePromotor;
  root.resolverMetasPromotor = api.resolverMetasPromotor;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const metasPadrao = {
    pdvs_cadastrados: 200,
    pdvs_visitados_mes: 200,
    tabela_percentual: 50,
    pedidos_mes: 10,
    cliente_novo_positivado: 1
  };

  function normalizarTexto(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function chavePdv(valor) {
    return normalizarTexto(valor?.cnpj || valor?.nome_fantasia || valor?.dados?.pdv?.cnpj || valor?.dados?.pdv?.nomeFantasia);
  }

  function noMesAtual(data, hoje) {
    const d = new Date(data);
    return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
  }

  function melhorMeta(metas, tipo, escopos) {
    for (const escopo of escopos) {
      const encontrada = metas.find(m =>
        m.tipo_meta === tipo &&
        m.escopo_tipo === escopo.tipo &&
        String(m.escopo_valor || '').toLowerCase() === String(escopo.valor || '').toLowerCase() &&
        m.ativo !== false
      );
      if (encontrada) return Number(encontrada.valor);
    }
    return metasPadrao[tipo];
  }

  function resolverMetasPromotor({ promotor, uf, coordenador_usuario = '', metas = [] }) {
    const escopos = [
      { tipo: 'promotor', valor: promotor },
      { tipo: 'coordenador', valor: coordenador_usuario },
      { tipo: 'uf', valor: uf },
      { tipo: 'global', valor: 'global' }
    ];
    return {
      pdvs_cadastrados: melhorMeta(metas, 'pdvs_cadastrados', escopos),
      pdvs_visitados_mes: melhorMeta(metas, 'pdvs_visitados_mes', escopos),
      tabela_percentual: melhorMeta(metas, 'tabela_percentual', escopos),
      pedidos_mes: melhorMeta(metas, 'pedidos_mes', escopos),
      cliente_novo_positivado: melhorMeta(metas, 'cliente_novo_positivado', escopos)
    };
  }

  function card(label, atual, alvo, sufixo = '') {
    const faltam = Math.max(0, Number(alvo || 0) - Number(atual || 0));
    const pct = alvo ? Math.min(100, Math.round((Number(atual || 0) / Number(alvo || 1)) * 100)) : 0;
    return { label, atual, alvo, faltam, pct, sufixo, atingida: faltam === 0 };
  }

  function calcularPerformancePromotor({ promotor, visitas = [], clientes = [], metas = [], hoje = new Date(), coordenador_usuario = '' }) {
    const clientesDoPromotor = clientes.filter(c => c.promotor === promotor);
    const visitasDoPromotor = visitas.filter(v => v.promotor === promotor);
    const uf = clientesDoPromotor.find(c => c.uf)?.uf || visitasDoPromotor.find(v => v.dados?.pdv?.uf)?.dados?.pdv?.uf || '';
    const metasResolvidas = resolverMetasPromotor({ promotor, uf, coordenador_usuario, metas });
    const visitasMes = visitasDoPromotor.filter(v => noMesAtual(v.criado_em, hoje));
    const chavesVisitadasMes = new Set(visitasMes.map(chavePdv).filter(Boolean));
    const chavesTabela = new Set(visitasMes.filter(v => v?.dados?.presenca?.tabelaVisivel).map(chavePdv).filter(Boolean));
    const pedidosMes = visitasMes.filter(v => ['Pedido confirmado', 'Pedido entregue'].includes(v?.dados?.comercial?.statusPedido) || v?.dados?.comercial?.pedidoFeito === 'Sim').length;
    const tabelaPct = clientesDoPromotor.length ? Math.round((clientesDoPromotor.filter(c => chavesTabela.has(chavePdv(c))).length / clientesDoPromotor.length) * 100) : 0;
    const clientesNovosMes = clientesDoPromotor.filter(c => noMesAtual(c.criado_em, hoje)).length;

    const cards = {
      pdvs_cadastrados: card('PDVs cadastrados', clientesDoPromotor.length, metasResolvidas.pdvs_cadastrados),
      pdvs_visitados_mes: card('PDVs visitados no mes', chavesVisitadasMes.size, metasResolvidas.pdvs_visitados_mes),
      tabela_percentual: card('Base com tabela visivel', tabelaPct, metasResolvidas.tabela_percentual, '%'),
      pedidos_mes: card('Pedidos no mes', pedidosMes, metasResolvidas.pedidos_mes),
      cliente_novo_positivado: card('Clientes novos no mes', clientesNovosMes, metasResolvidas.cliente_novo_positivado)
    };

    const proximosPassos = Object.values(cards)
      .filter(c => !c.atingida)
      .sort((a,b) => b.faltam - a.faltam)
      .slice(0, 3)
      .map(c => c.sufixo === '%' ? `Aumentar ${c.label.toLowerCase()} em ${c.faltam} pontos` : `Faltam ${c.faltam} para ${c.label.toLowerCase()}`);

    return { promotor, uf, metas: metasResolvidas, cards, proximosPassos };
  }

  return { metasPadrao, resolverMetasPromotor, calcularPerformancePromotor };
});
