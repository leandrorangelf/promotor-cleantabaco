import assert from 'node:assert/strict';
import {
  ajustarTrilha,
  classificarPerfil,
  criarJanelas,
  separarPorLacuna
} from '../api/_map-match.mjs';

const ponto = (minuto, latitude, longitude, velocidade = null, precisao = 8) => ({
  latitude,
  longitude,
  velocidade,
  precisao,
  capturado_em: new Date(Date.UTC(2026, 6, 22, 12, minuto)).toISOString()
});

const continuo = [
  ponto(0, -23, -46, 12),
  ponto(1, -23.001, -46.001, 11),
  ponto(2, -23.002, -46.002, 10)
];

assert.equal(separarPorLacuna([...continuo, ponto(20, -23.01, -46.01, 1)]).length, 2, 'lacuna maior que 15 min deve separar');
assert.equal(classificarPerfil(continuo), 'driving', 'velocidade sustentada deve usar direção');
assert.equal(
  classificarPerfil([
    ponto(0, -23, -46, 1),
    ponto(1, -23.0002, -46.0002, 1.2),
    ponto(2, -23.0004, -46.0004, 0.8)
  ]),
  'walking',
  'trecho lento sustentado deve usar caminhada'
);
const janelas = criarJanelas(Array.from({ length: 195 }, (_, i) => ({ i })));
assert.deepEqual(janelas.map(janela => janela.length), [100, 100], 'janelas não devem repetir um bloco final já coberto');
assert.deepEqual(janelas[0].slice(-5), janelas[1].slice(0, 5), 'janelas devem sobrepor cinco pontos');

const semToken = await ajustarTrilha(continuo, {
  token: '',
  fetchImpl: async () => { throw new Error('não deveria chamar'); }
});
assert.equal(semToken.ajuste.status, 'indisponivel');
assert.equal(semToken.segmentos[0].origem, 'raw');

const urls = [];
const ajustado = await ajustarTrilha(continuo, {
  token: 'teste',
  fetchImpl: async url => {
    urls.push(url);
    return {
      ok: true,
      json: async () => ({
        matchings: [{ geometry: { coordinates: [[-46, -23], [-46.001, -23.001], [-46.002, -23.002]] } }]
      })
    };
  }
});
assert.equal(ajustado.ajuste.status, 'completo');
assert.equal(ajustado.segmentos[0].origem, 'matched');
assert.deepEqual(ajustado.segmentos[0].pontos[0], [-23, -46], 'deve converter [lng,lat] para [lat,lng]');
assert.match(urls[0], /mapbox\/driving/);
assert.match(urls[0], /timestamps=/);
assert.match(urls[0], /radiuses=/);

const falha = await ajustarTrilha([...continuo, ponto(20, -23.01, -46.01, 1)], {
  token: 'teste',
  fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) })
});
assert.equal(falha.segmentos.every(segmento => segmento.origem === 'raw'), true);
assert.equal(falha.ajuste.status, 'indisponivel');

console.log('map-match.test.mjs passou');
