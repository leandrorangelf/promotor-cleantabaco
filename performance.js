(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.calcularPerformancePromotor = api.calcularPerformancePromotor;
  root.resolverMetasPromotor = api.resolverMetasPromotor;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const metasPadrao = {
    base_clientes: 200,
    tabela_percentual: 50,
    bonus_pdv_venda_valor: 15,
    bonus_pdv_venda_teto: 500
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
      base_clientes: melhorMeta(metas, 'base_clientes', escopos),
      tabela_percentual: melhorMeta(metas, 'tabela_percentual', escopos),
      bonus_pdv_venda_valor: melhorMeta(metas, 'bonus_pdv_venda_valor', escopos),
      bonus_pdv_venda_teto: melhorMeta(metas, 'bonus_pdv_venda_teto', escopos)
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
    const visitasComVenda = visitasMes.filter(v => {
      const qty = v?.dados?.comercial?.pedidoPac || v?.dados?.comercial?.pedidoQty || {};
      return Object.values(qty).some(q => Number(q || 0) > 0);
    });
    const chavesVendaMes = new Set(visitasComVenda.map(chavePdv).filter(Boolean));
    const tabelaPct = clientesDoPromotor.length ? Math.round((clientesDoPromotor.filter(c => chavesTabela.has(chavePdv(c))).length / clientesDoPromotor.length) * 100) : 0;
    const valorBonusAtual = Math.min(chavesVendaMes.size * metasResolvidas.bonus_pdv_venda_valor, metasResolvidas.bonus_pdv_venda_teto);
    const pdvsParaTeto = Math.ceil(metasResolvidas.bonus_pdv_venda_teto / metasResolvidas.bonus_pdv_venda_valor);
    const baseBatida = clientesDoPromotor.length >= metasResolvidas.base_clientes;

    const cards = {
      bonus_pdv_venda: {
        ...card('PDVs abertos com venda', chavesVendaMes.size, pdvsParaTeto),
        valorAtual: valorBonusAtual,
        valorAlvo: metasResolvidas.bonus_pdv_venda_teto,
        moeda: true
      },
      tabela_percentual: card('Base com tabela visivel', tabelaPct, metasResolvidas.tabela_percentual, '%'),
      base_ou_cobertura: baseBatida
        ? card('Cobertura mensal da base', chavesVisitadasMes.size, metasResolvidas.base_clientes)
        : card('Base cadastrada', clientesDoPromotor.length, metasResolvidas.base_clientes)
    };

    const proximosPassos = Object.values(cards)
      .filter(c => !c.atingida)
      .sort((a,b) => b.faltam - a.faltam)
      .slice(0, 3)
      .map(c => c.moeda
        ? `Abrir mais ${c.faltam} PDVs com venda para chegar ao teto desse bonus`
        : c.sufixo === '%' ? `Aumentar ${c.label.toLowerCase()} em ${c.faltam} pontos` : `Faltam ${c.faltam} para ${c.label.toLowerCase()}`);

    return { promotor, uf, metas: metasResolvidas, cards, proximosPassos };
  }

  return { metasPadrao, resolverMetasPromotor, calcularPerformancePromotor };
});
