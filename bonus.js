(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.calcularBonificacaoPromotores = api.calcularBonificacaoPromotores;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const VALOR_META = 500;
  const VALOR_CLIENTE_NOVO = 15;
  const META_BASE_PDVS = 200;
  const META_PERCENTUAL_TABELA = 50;

  function normalizarTexto(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  function quantidadesPedido(visita) {
    const comercial = visita?.dados?.comercial || {};
    return comercial.pedidoPac || comercial.pedidoQty || {};
  }

  function positivadaComSku(visita) {
    const qty = quantidadesPedido(visita);
    return Object.values(qty).some(v => Number(v || 0) > 0);
  }

  function chavePdvVisita(visita) {
    const pdv = visita?.dados?.pdv || {};
    return normalizarTexto(pdv.cnpj || pdv.nomeFantasia);
  }

  function chavePdvCliente(cliente) {
    return normalizarTexto(cliente?.cnpj || cliente?.nome_fantasia);
  }

  function dentroDoPeriodo(data, de, ate) {
    if (!de && !ate) return true;
    const t = new Date(data).getTime();
    if (de && t < new Date(de).getTime()) return false;
    if (ate && t > new Date(ate).getTime()) return false;
    return true;
  }

  function criarResumo(nome) {
    return {
      promotor: nome,
      totalBonus: 0,
      metas: {
        clienteNovoPositivado: { atingida: false, valor: 0, atual: 0, alvo: 1 },
        tabelaVisivelBase: { atingida: false, valor: 0, atual: 0, alvo: META_PERCENTUAL_TABELA },
        baseDuzentosPdvs: { atingida: false, valor: 0, atual: 0, alvo: META_BASE_PDVS }
      }
    };
  }

  function calcularBonificacaoPromotores(visitas, clientes, periodo) {
    const de = periodo?.de || null;
    const ate = periodo?.ate || null;
    const listaVisitas = visitas || [];
    const listaClientes = clientes || [];

    const visitasPorPromotor = {};
    listaVisitas.forEach(v => {
      const nome = v?.promotor || 'Sem promotor';
      if (!visitasPorPromotor[nome]) visitasPorPromotor[nome] = [];
      visitasPorPromotor[nome].push(v);
    });

    const clientesPorPromotor = {};
    listaClientes.forEach(c => {
      const nome = c?.promotor || 'Sem promotor';
      if (!clientesPorPromotor[nome]) clientesPorPromotor[nome] = [];
      clientesPorPromotor[nome].push(c);
    });

    const nomes = new Set([...Object.keys(visitasPorPromotor), ...Object.keys(clientesPorPromotor)]);
    const resultado = {};

    nomes.forEach(nome => {
      const visitasDoPromotor = visitasPorPromotor[nome] || [];
      const clientesDoPromotor = clientesPorPromotor[nome] || [];
      const resumo = criarResumo(nome);

      const visitasNoPeriodo = visitasDoPromotor.filter(v => dentroDoPeriodo(v.criado_em, de, ate));

      // Meta 1: R$15 por cliente novo (cadastrado no periodo) positivado (>=1 SKU vendido no periodo), teto R$500
      const clientesNovos = clientesDoPromotor.filter(c => dentroDoPeriodo(c.criado_em, de, ate));
      const chavesPositivadas = new Set(
        visitasNoPeriodo.filter(positivadaComSku).map(chavePdvVisita).filter(Boolean)
      );
      const clientesNovosPositivados = clientesNovos.filter(c => chavesPositivadas.has(chavePdvCliente(c))).length;
      resumo.metas.clienteNovoPositivado.atual = clientesNovosPositivados;
      resumo.metas.clienteNovoPositivado.valor = Math.min(clientesNovosPositivados * VALOR_CLIENTE_NOVO, VALOR_META);
      resumo.metas.clienteNovoPositivado.atingida = resumo.metas.clienteNovoPositivado.valor > 0;

      // Meta 2: R$500 quando 50% da base de clientes tem tabela de precos visivel (registrada com foto na visita)
      const chavesTabelaVisivel = new Set(
        visitasNoPeriodo.filter(v => v?.dados?.presenca?.tabelaVisivel).map(chavePdvVisita).filter(Boolean)
      );
      const totalBase = clientesDoPromotor.length;
      const comTabelaVisivel = clientesDoPromotor.filter(c => chavesTabelaVisivel.has(chavePdvCliente(c))).length;
      const percentualTabela = totalBase ? Math.round((comTabelaVisivel / totalBase) * 100) : 0;
      resumo.metas.tabelaVisivelBase.atual = percentualTabela;
      resumo.metas.tabelaVisivelBase.atingida = totalBase > 0 && percentualTabela >= META_PERCENTUAL_TABELA;
      resumo.metas.tabelaVisivelBase.valor = resumo.metas.tabelaVisivelBase.atingida ? VALOR_META : 0;

      // Meta 3: R$500 quando o promotor tem >=200 PDVs cadastrados e visitados no periodo
      const chavesVisitadas = new Set(visitasNoPeriodo.map(chavePdvVisita).filter(Boolean));
      const cadastradosEVisitados = clientesDoPromotor.filter(c => chavesVisitadas.has(chavePdvCliente(c))).length;
      resumo.metas.baseDuzentosPdvs.atual = cadastradosEVisitados;
      resumo.metas.baseDuzentosPdvs.atingida = cadastradosEVisitados >= META_BASE_PDVS;
      resumo.metas.baseDuzentosPdvs.valor = resumo.metas.baseDuzentosPdvs.atingida ? VALOR_META : 0;

      resumo.totalBonus =
        resumo.metas.clienteNovoPositivado.valor +
        resumo.metas.tabelaVisivelBase.valor +
        resumo.metas.baseDuzentosPdvs.valor;

      resultado[nome] = resumo;
    });

    return resultado;
  }

  return {
    calcularBonificacaoPromotores,
    positivadaComSku
  };
});
