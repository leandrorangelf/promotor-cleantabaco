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

  function visitaEhProspeccao(visita) {
    return visita?.dados?.tipo === 'prospeccao';
  }

  // Prospecção é só nome + foto + GPS (sem formulário completo). Um cliente só conta
  // como "cadastrado" pra metas se tiver dado cadastral de verdade, ou já tiver tido
  // ao menos uma visita completa (não-prospecção) associada.
  function clienteTemCadastroCompleto(cliente, visitasDoPromotor) {
    if (cliente?.cnpj || cliente?.endereco || cliente?.tipo) return true;
    const chave = chavePdvCliente(cliente);
    return visitasDoPromotor.some(v => !visitaEhProspeccao(v) && chavePdvVisita(v) === chave);
  }

  function statusValidacaoFoto(validacao) {
    return validacao?.status_manual || validacao?.status_ia || 'pendente';
  }

  function tabelaConfirmadaNaVisita(visita) {
    const validacoes = visita?.dados?.presenca?.tabelaValidacoesFotos || [];
    return validacoes.some(v => statusValidacaoFoto(v) === 'aprovado');
  }

  function dentroDoPeriodo(data, de, ate) {
    if (!de && !ate) return true;
    const t = new Date(data).getTime();
    if (de && t < new Date(de).getTime()) return false;
    if (ate && t > new Date(ate).getTime()) return false;
    return true;
  }

  function criarResumo(nome, metas = {}) {
    const alvoBase = Number(metas.base_clientes || META_BASE_PDVS);
    const alvoTabela = Number(metas.tabela_percentual || META_PERCENTUAL_TABELA);
    return {
      promotor: nome,
      totalBonus: 0,
      metas: {
        clienteNovoPositivado: { atingida: false, valor: 0, atual: 0, alvo: 1 },
        tabelaVisivelBase: { atingida: false, valor: 0, atual: 0, alvo: alvoTabela },
        baseDuzentosPdvs: { atingida: false, valor: 0, atual: 0, alvo: alvoBase }
      }
    };
  }

  function calcularBonificacaoPromotores(visitas, clientes, periodo, metasPorPromotor = {}) {
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
      const metasConfig = metasPorPromotor[nome] || {};
      const valorClienteNovo = Number(metasConfig.bonus_pdv_venda_valor || VALOR_CLIENTE_NOVO);
      const tetoClienteNovo = Number(metasConfig.bonus_pdv_venda_teto || VALOR_META);
      const resumo = criarResumo(nome, metasConfig);

      const visitasNoPeriodo = visitasDoPromotor.filter(v => dentroDoPeriodo(v.criado_em, de, ate));
      const clientesCadastroCompleto = clientesDoPromotor.filter(c => clienteTemCadastroCompleto(c, visitasDoPromotor));

      // Meta 1: R$15 por cliente novo (cadastrado no periodo) positivado (>=1 SKU vendido no periodo), teto R$500
      const clientesNovos = clientesDoPromotor.filter(c => dentroDoPeriodo(c.criado_em, de, ate) && !c.suspeito_duplicata);
      const chavesPositivadas = new Set(
        visitasNoPeriodo.filter(positivadaComSku).map(chavePdvVisita).filter(Boolean)
      );
      const clientesNovosPositivados = clientesNovos.filter(c => chavesPositivadas.has(chavePdvCliente(c))).length;
      resumo.metas.clienteNovoPositivado.atual = clientesNovosPositivados;
      resumo.metas.clienteNovoPositivado.valor = Math.min(clientesNovosPositivados * valorClienteNovo, tetoClienteNovo);
      resumo.metas.clienteNovoPositivado.atingida = resumo.metas.clienteNovoPositivado.valor > 0;

      // Meta 2: R$500 quando 50% da base de clientes tem foto aprovada (manualmente) em qualquer visita ate hoje
      // (nao restringe ao periodo do mes: uma tabela ja confirmada continua valendo nos meses seguintes)
      // O percentual e sempre calculado sobre a base minima (200, ou a meta configurada), nunca sobre uma
      // base pequena ainda em formacao — senao 1 tabela em 2 clientes cadastrados já bateria 50%.
      const chavesTabelaVisivel = new Set(
        visitasDoPromotor.filter(tabelaConfirmadaNaVisita).map(chavePdvVisita).filter(Boolean)
      );
      const totalBase = clientesCadastroCompleto.length;
      const comTabelaVisivel = clientesCadastroCompleto.filter(c => chavesTabelaVisivel.has(chavePdvCliente(c))).length;
      const baseParaPercentual = Math.max(totalBase, resumo.metas.baseDuzentosPdvs.alvo);
      const percentualTabela = baseParaPercentual ? Math.round((comTabelaVisivel / baseParaPercentual) * 100) : 0;
      resumo.metas.tabelaVisivelBase.atual = percentualTabela;
      resumo.metas.tabelaVisivelBase.atingida = totalBase >= resumo.metas.baseDuzentosPdvs.alvo && percentualTabela >= resumo.metas.tabelaVisivelBase.alvo;
      resumo.metas.tabelaVisivelBase.valor = resumo.metas.tabelaVisivelBase.atingida ? VALOR_META : 0;

      // Meta 3: R$500 quando o promotor tem >=200 PDVs cadastrados e visitados no periodo
      // (prospecção não conta como "visitado" aqui — só visita completa)
      const chavesVisitadas = new Set(visitasNoPeriodo.filter(v => !visitaEhProspeccao(v)).map(chavePdvVisita).filter(Boolean));
      const cadastradosEVisitados = clientesCadastroCompleto.filter(c => chavesVisitadas.has(chavePdvCliente(c))).length;
      resumo.metas.baseDuzentosPdvs.atual = cadastradosEVisitados;
      resumo.metas.baseDuzentosPdvs.atingida = cadastradosEVisitados >= resumo.metas.baseDuzentosPdvs.alvo;
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
