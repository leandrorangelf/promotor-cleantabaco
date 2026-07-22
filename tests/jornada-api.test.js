const assert = require('assert');
const fs = require('fs');

for (const arquivo of ['jornada-iniciar.js', 'jornada-pontos.js', 'jornada-encerrar.js', 'jornadas.js']) {
  const codigo = fs.readFileSync(`api/${arquivo}`, 'utf8');
  assert.ok(codigo.includes('autenticar(req)'), `${arquivo} deve autenticar o request`);
  assert.ok(codigo.includes('CREATE TABLE IF NOT EXISTS'), `${arquivo} deve garantir as tabelas`);
}

const pontos = fs.readFileSync('api/jornada-pontos.js', 'utf8');
assert.ok(pontos.includes('ponto_id'), 'pontos devem ter chave idempotente');
assert.ok(pontos.includes('ON CONFLICT'), 'lote de pontos deve ser idempotente');
assert.ok(pontos.includes('jornada_id'), 'pontos devem pertencer a uma jornada');

const jornadas = fs.readFileSync('api/jornadas.js', 'utf8');
assert.ok(jornadas.includes("from './_map-match.cjs'"), 'jornadas deve usar helper CommonJS compatível com o runtime Vercel');
assert.ok(!jornadas.includes("from './_map-match.mjs'"), 'função Vercel não deve carregar helper ESM via require');
assert.ok(jornadas.includes('GEOAPIFY_API_KEY'), 'chave Geoapify deve ser lida somente no servidor');
assert.ok(jornadas.includes('SELECT nome FROM promotores'), 'restrição do coordenador deve consultar a tabela real de promotores');
assert.ok(!jornadas.includes('FROM usuarios'), 'API não deve consultar tabela usuarios inexistente');
assert.ok(jornadas.includes("NULLIF(${inicio}, '')::date"), 'data inicial vazia não deve ser convertida diretamente para date');
assert.ok(jornadas.includes("NULLIF(${fim}, '')::date"), 'data final vazia não deve ser convertida diretamente para date');
assert.ok(!jornadas.includes('MAPBOX_ACCESS_TOKEN'), 'API não deve depender da chave Mapbox');
assert.ok(jornadas.includes('rota_assinatura'), 'deve persistir assinatura do cache');
assert.ok(jornadas.includes('rota_ajustada JSONB'), 'deve persistir geometria derivada');
assert.ok(jornadas.includes('segmentos'), 'resposta deve expor segmentos estáveis');
assert.ok(jornadas.includes('ajuste'), 'resposta deve informar qualidade do ajuste');
assert.ok(jornadas.includes("req.query?.ajustar === 'true'"), 'chamada externa deve exigir ajuste explícito');

const iniciar = fs.readFileSync('api/jornada-iniciar.js', 'utf8');
assert.ok(iniciar.includes('America/Sao_Paulo'), 'início deve usar o fuso da operação');

console.log('jornada-api.test.js passou');
