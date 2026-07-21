const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const api = fs.readFileSync('api/avaliar-foto.js', 'utf8');

assert.ok(html.includes('function compactarDataUrlImagem'), 'frontend deve compactar fotos antes de chamar a IA');
assert.ok(html.includes('function prepararFotoParaIA'), 'frontend deve centralizar preparo de foto para IA');
assert.ok(html.includes('/api/analisar-foto'), 'galeria deve pedir analise no servidor sem reenviar a imagem');
assert.ok(!html.includes('registrarValidacoesVisita'), 'salvamento nao deve disparar analise automatica nem consumir tokens');

assert.ok(api.includes('function normalizarImagemEntrada'), 'API deve normalizar data URL, mime type e base64');
assert.ok(api.includes('normalizarImagemEntrada(foto)'), 'API deve usar imagem normalizada ao chamar o Gemini');
assert.ok(!api.includes("mime_type: 'image/jpeg', data: base64"), 'API nao deve forcar JPEG para qualquer imagem');
assert.ok(api.includes("const MODELO_GEMINI = 'gemini-2.5-flash'"), 'deve fixar modelo auditavel');
assert.ok(!api.includes('gemini-flash-latest'), 'nao deve usar alias latest');
assert.ok(api.includes('usageMetadata'), 'deve ler uso retornado pelo Gemini');
assert.ok(api.includes('promptTokenCount'), 'deve registrar tokens de entrada');
assert.ok(api.includes('candidatesTokenCount'), 'deve registrar tokens de saida');
assert.ok(api.includes('custo_usd_estimado'), 'deve estimar custo da analise');

console.log('validacao-ia-imagem.test.js passou');
