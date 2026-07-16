(function(root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.calcularPerformancePromotor = api.calcularPerformancePromotor;
  root.resolverMetasPromotor = api.resolverMetasPromotor;
})(typeof window !== 'undefined' ? window : globalThis, function(root) {
  const metasPadrao = {
    base_clientes: 200,
    tabela_percentual: 50,
    bonus_pdv_venda_valor: 15,
    bonus_pdv_venda_teto: 500
  };

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

  function obterCalculadoraBonus() {
    if (root?.calcularBonificacaoPromotores) return root.calcularBonificacaoPromotores;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('./bonus.js').calcularBonificacaoPromotores;
    }
    return null;
  }

  function periodoDoMes(hoje) {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0, 0);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
    return { de: inicio.toISOString(), ate: fim.toISOString() };
  }

  function calcularPerformancePromotor({ promotor, visitas = [], clientes = [], metas = [], hoje = new Date(), coordenador_usuario = '' }) {
    const clientesDoPromotor = clientes.filter(c => c.promotor === promotor);
    const visitasDoPromotor = visitas.filter(v => v.promotor === promotor);
    const uf = clientesDoPromotor.find(c => c.uf)?.uf || visitasDoPromotor.find(v => v.dados?.pdv?.uf)?.dados?.pdv?.uf || '';
    const metasResolvidas = resolverMetasPromotor({ promotor, uf, coordenador_usuario, metas });
    const calcularBonificacaoPromotores = obterCalculadoraBonus();
    if (!calcularBonificacaoPromotores) throw new Error('calcularBonificacaoPromotores indisponivel');

    const resultadoBonus = calcularBonificacaoPromotores(
      visitasDoPromotor,
      clientesDoPromotor,
      periodoDoMes(hoje),
      { [promotor]: metasResolvidas }
    );
    const metasBonus = resultadoBonus[promotor]?.metas || {};
    const bonusPdvVenda = metasBonus.clienteNovoPositivado || { atual: 0, valor: 0 };
    const tabelaVisivel = metasBonus.tabelaVisivelBase || { atual: 0, alvo: metasResolvidas.tabela_percentual };
    const baseVisitada = metasBonus.baseDuzentosPdvs || { atual: 0, alvo: metasResolvidas.base_clientes };
    const pdvsParaTeto = bonusPdvVenda.alvoUnidades;
    const baseBatida = baseVisitada.baseCadastradaAtingida;

    const cards = {
      bonus_pdv_venda: {
        ...card('PDVs abertos com venda', bonusPdvVenda.atual, pdvsParaTeto),
        valorUnitario: bonusPdvVenda.valorUnitario,
        clientesPositivados: bonusPdvVenda.clientesNovos,
        valorAtual: bonusPdvVenda.valor,
        valorAlvo: metasResolvidas.bonus_pdv_venda_teto,
        moeda: true
      },
      tabela_percentual: {
        ...card('Base com tabela visivel', tabelaVisivel.atual, tabelaVisivel.alvo, '%'),
        carteira: tabelaVisivel.carteira,
        comTabela: tabelaVisivel.comTabela
      },
      base_ou_cobertura: baseBatida
        ? {
          ...card('Cobertura mensal da base', baseVisitada.atual, baseVisitada.alvo),
          clientesVisitados: baseVisitada.visitados
        }
        : {
          ...card('Base cadastrada', baseVisitada.baseCadastrada, metasResolvidas.base_clientes),
          clientesVisitados: baseVisitada.visitados
        }
    };

    const proximosPassos = Object.values(cards)
      .filter(c => !c.atingida)
      .sort((a,b) => b.faltam - a.faltam)
      .slice(0, 3)
      .map(c => c.moeda
        ? `Abrir mais ${c.faltam} PDVs com venda para chegar ao teto desse bonus`
        : c.sufixo === '%' ? `Aumentar ${c.label.toLowerCase()} em ${c.faltam} pontos` : `Faltam ${c.faltam} para ${c.label.toLowerCase()}`);

    return { promotor, uf, metas: metasResolvidas, cards, proximosPassos, resumoBonus: resultadoBonus[promotor] };
  }

  return { metasPadrao, resolverMetasPromotor, calcularPerformancePromotor };
});
