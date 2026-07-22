export const LACUNA_MS = 15 * 60 * 1000;
export const LIMITE_PONTOS = 1000;
export const SOBREPOSICAO = 5;
const LIMITE_CAMINHADA_MPS = 2.2;

export function normalizarPontos(pontos = []) {
  return pontos
    .filter(ponto =>
      Number.isFinite(+ponto?.latitude) &&
      Number.isFinite(+ponto?.longitude) &&
      !Number.isNaN(Date.parse(ponto?.capturado_em))
    )
    .map(ponto => ({
      ...ponto,
      latitude: +ponto.latitude,
      longitude: +ponto.longitude,
      precisao: ponto.precisao !== null && ponto.precisao !== undefined && Number.isFinite(+ponto.precisao)
        ? Math.max(1, +ponto.precisao)
        : 25
    }))
    .sort((a, b) => Date.parse(a.capturado_em) - Date.parse(b.capturado_em));
}

export function separarPorLacuna(pontos, lacunaMs = LACUNA_MS) {
  return normalizarPontos(pontos).reduce((grupos, ponto) => {
    const atual = grupos.at(-1);
    if (!atual || Date.parse(ponto.capturado_em) - Date.parse(atual.at(-1).capturado_em) > lacunaMs) {
      grupos.push([ponto]);
    } else {
      atual.push(ponto);
    }
    return grupos;
  }, []);
}

export function classificarPerfil(pontos = []) {
  const velocidades = pontos
    .map(ponto => ponto?.velocidade)
    .filter(valor => valor !== null && valor !== undefined && Number.isFinite(+valor))
    .map(Number)
    .sort((a, b) => a - b);
  if (velocidades.length < 3) return 'driving';
  const meio = Math.floor(velocidades.length / 2);
  const mediana = velocidades.length % 2
    ? velocidades[meio]
    : (velocidades[meio - 1] + velocidades[meio]) / 2;
  return mediana < LIMITE_CAMINHADA_MPS ? 'walking' : 'driving';
}

export function separarPorPerfil(pontos = []) {
  const normalizados = normalizarPontos(pontos);
  if (normalizados.length < 2) return [];
  const lentos = normalizados.map(ponto =>
    ponto.velocidade !== null &&
    ponto.velocidade !== undefined &&
    Number.isFinite(+ponto.velocidade) &&
    +ponto.velocidade < LIMITE_CAMINHADA_MPS
  );
  const perfis = Array(normalizados.length).fill('driving');
  for (let inicio = 0; inicio < lentos.length;) {
    if (!lentos[inicio]) { inicio += 1; continue; }
    let fim = inicio + 1;
    while (fim < lentos.length && lentos[fim]) fim += 1;
    if (fim - inicio >= 3) {
      for (let i = inicio; i < fim; i += 1) perfis[i] = 'walking';
    }
    inicio = fim;
  }

  const segmentos = [{ perfil: perfis[0], pontos: [normalizados[0]] }];
  for (let i = 1; i < normalizados.length; i += 1) {
    const atual = segmentos.at(-1);
    if (perfis[i] === atual.perfil) {
      atual.pontos.push(normalizados[i]);
    } else {
      segmentos.push({ perfil: perfis[i], pontos: [normalizados[i - 1], normalizados[i]] });
    }
  }
  return segmentos.filter(segmento => segmento.pontos.length >= 2);
}

export function criarJanelas(pontos = [], tamanho = LIMITE_PONTOS, sobreposicao = SOBREPOSICAO) {
  if (!Number.isInteger(tamanho) || tamanho < 2) throw new Error('Tamanho de janela inválido');
  if (!Number.isInteger(sobreposicao) || sobreposicao < 0 || sobreposicao >= tamanho) throw new Error('Sobreposição inválida');
  const janelas = [];
  const passo = tamanho - sobreposicao;
  for (let inicio = 0; inicio < pontos.length; inicio += passo) {
    const janela = pontos.slice(inicio, inicio + tamanho);
    if (janela.length < 2) break;
    janelas.push(janela);
    if (inicio + tamanho >= pontos.length) break;
  }
  return janelas;
}

function segmentoRaw(pontos, perfil = classificarPerfil(pontos)) {
  return {
    perfil,
    origem: 'raw',
    pontos: pontos.map(ponto => [ponto.latitude, ponto.longitude]),
    inicio_em: pontos[0]?.capturado_em || null,
    fim_em: pontos.at(-1)?.capturado_em || null
  };
}

export function segmentosRaw(pontos = []) {
  return separarPorLacuna(pontos)
    .filter(grupo => grupo.length >= 2)
    .map(grupo => segmentoRaw(grupo));
}

function statusDosSegmentos(segmentos) {
  if (!segmentos.length) return 'sem_dados';
  const ajustados = segmentos.filter(segmento => segmento.origem === 'matched').length;
  if (ajustados === segmentos.length) return 'completo';
  if (ajustados > 0) return 'parcial';
  return 'indisponivel';
}

async function ajustarJanela(janela, perfil, token, fetchImpl) {
  const modo = perfil === 'walking' ? 'walk' : 'drive';
  const waypoints = janela.map(ponto => ({
    location: [ponto.longitude, ponto.latitude],
    timestamp: ponto.capturado_em,
    ...(ponto.direcao !== null && ponto.direcao !== undefined && Number.isFinite(+ponto.direcao)
      ? { bearing: +ponto.direcao }
      : {})
  }));
  const url = `https://api.geoapify.com/v1/mapmatching?apiKey=${encodeURIComponent(token)}`;
  try {
    const resposta = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: modo, waypoints }),
      signal: AbortSignal.timeout(12000)
    });
    if (!resposta.ok) return segmentoRaw(janela, perfil);
    const dados = await resposta.json();
    const coordenadasAjustadas = (dados.features || [])
      .flatMap(feature => {
        const geometria = feature?.geometry;
        if (geometria?.type === 'LineString') return geometria.coordinates || [];
        if (geometria?.type === 'MultiLineString') return (geometria.coordinates || []).flatMap(linha => linha || []);
        return [];
      })
      .filter(par => Array.isArray(par) && par.length >= 2 && Number.isFinite(+par[0]) && Number.isFinite(+par[1]))
      .map(([lng, lat]) => [+lat, +lng]);
    if (coordenadasAjustadas.length < 2) return segmentoRaw(janela, perfil);
    return {
      perfil,
      origem: 'matched',
      pontos: coordenadasAjustadas,
      inicio_em: janela[0].capturado_em,
      fim_em: janela.at(-1).capturado_em
    };
  } catch {
    return segmentoRaw(janela, perfil);
  }
}

export async function ajustarTrilha(pontos = [], { token = '', fetchImpl = fetch } = {}) {
  const grupos = separarPorLacuna(pontos).filter(grupo => grupo.length >= 2);
  if (!grupos.length) return { segmentos: [], ajuste: { status: 'sem_dados', provedor: token ? 'geoapify' : null } };
  if (!token) {
    const segmentos = grupos.map(grupo => segmentoRaw(grupo));
    return { segmentos, ajuste: { status: 'indisponivel', provedor: null } };
  }

  const segmentos = [];
  for (const grupo of grupos) {
    for (const trecho of separarPorPerfil(grupo)) {
      const janelas = criarJanelas(trecho.pontos);
      for (const janela of janelas) segmentos.push(await ajustarJanela(janela, trecho.perfil, token, fetchImpl));
    }
  }
  return { segmentos, ajuste: { status: statusDosSegmentos(segmentos), provedor: 'geoapify' } };
}
