import assert from 'node:assert/strict';
import {
  ajustarTrilha,
  classificarPerfil,
  criarJanelas,
  separarPorPerfil,
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
const misto = [
  ponto(0, -23, -46, 12),
  ponto(1, -23.001, -46.001, 11),
  ponto(2, -23.002, -46.002, 10),
  ponto(3, -23.0022, -46.0022, 1),
  ponto(4, -23.0024, -46.0024, 1.1),
  ponto(5, -23.0026, -46.0026, 0.9),
  ponto(6, -23.0036, -46.0036, 9),
  ponto(7, -23.0046, -46.0046, 10)
];
assert.deepEqual(
  separarPorPerfil(misto).map(segmento => segmento.perfil),
  ['driving', 'walking', 'driving'],
  'deve preservar pequenos trechos sustentados a pé dentro da jornada motorizada'
);
const janelas = criarJanelas(Array.from({ length: 1095 }, (_, i) => ({ i })));
assert.deepEqual(janelas.map(janela => janela.length), [1000, 100], 'janelas devem respeitar o limite de mil pontos sem repetir bloco já coberto');
assert.deepEqual(janelas[0].slice(-5), janelas[1].slice(0, 5), 'janelas devem sobrepor cinco pontos');

const semToken = await ajustarTrilha(continuo, {
  token: '',
  fetchImpl: async () => { throw new Error('não deveria chamar'); }
});
assert.equal(semToken.ajuste.status, 'indisponivel');
assert.equal(semToken.segmentos[0].origem, 'raw');

const chamadas = [];
const ajustado = await ajustarTrilha(continuo, {
  token: 'teste',
  fetchImpl: async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    return {
      ok: true,
      json: async () => ({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: [[[-46, -23], [-46.001, -23.001], [-46.002, -23.002]]]
          },
          properties: {}
        }]
      })
    };
  }
});
assert.equal(ajustado.ajuste.status, 'completo');
assert.equal(ajustado.segmentos[0].origem, 'matched');
assert.deepEqual(ajustado.segmentos[0].pontos[0], [-23, -46], 'deve converter [lng,lat] para [lat,lng]');
assert.match(chamadas[0].url, /^https:\/\/api\.geoapify\.com\/v1\/mapmatching\?apiKey=/);
assert.equal(chamadas[0].opcoes.method, 'POST');
assert.equal(chamadas[0].opcoes.headers['Content-Type'], 'application/json');
assert.equal(JSON.parse(chamadas[0].opcoes.body).mode, 'drive');
assert.deepEqual(JSON.parse(chamadas[0].opcoes.body).waypoints[0].location, [-46, -23]);
assert.equal('bearing' in JSON.parse(chamadas[0].opcoes.body).waypoints[0], false, 'não deve inventar direção ausente');

const falha = await ajustarTrilha([...continuo, ponto(20, -23.01, -46.01, 1)], {
  token: 'teste',
  fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) })
});
assert.equal(falha.segmentos.every(segmento => segmento.origem === 'raw'), true);
assert.equal(falha.ajuste.status, 'indisponivel');

const caminhada = await ajustarTrilha([
  ponto(0, -23, -46, 1),
  ponto(1, -23.0002, -46.0002, 1.1),
  ponto(2, -23.0004, -46.0004, 0.9)
], {
  token: 'teste',
  fetchImpl: async (_url, opcoes) => ({
    ok: true,
    json: async () => {
      assert.equal(JSON.parse(opcoes.body).mode, 'walk');
      return { features: [{ geometry: { type: 'MultiLineString', coordinates: [[[-46, -23], [-46.0004, -23.0004]]] } }] };
    }
  })
});
assert.equal(caminhada.ajuste.status, 'completo');

console.log('map-match.test.mjs passou');
