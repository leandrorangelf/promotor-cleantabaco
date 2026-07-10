const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const api = fs.readFileSync('api/avaliar-foto.js', 'utf8');

assert.ok(html.includes('function compactarDataUrlImagem'), 'frontend deve compactar fotos antes de chamar a IA');
assert.ok(html.includes('function prepararFotoParaIA'), 'frontend deve centralizar preparo de foto para IA');
assert.ok(html.includes('const fotoIA = await prepararFotoParaIA(item.foto)'), 'Galeria deve enviar foto preparada para IA');
assert.ok(html.includes('const fotoIA = await prepararFotoParaIA(fotosDaVisita[i])'), 'salvamento deve registrar validacao com foto preparada');

assert.ok(api.includes('function normalizarImagemEntrada'), 'API deve normalizar data URL, mime type e base64');
assert.ok(api.includes('normalizarImagemEntrada(foto)'), 'API deve usar imagem normalizada ao chamar o Gemini');
assert.ok(!api.includes("mime_type: 'image/jpeg', data: base64"), 'API nao deve forcar JPEG para qualquer imagem');

console.log('validacao-ia-imagem.test.js passou');
