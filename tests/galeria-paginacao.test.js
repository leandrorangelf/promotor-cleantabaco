const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('api/validacoes-fotos.js', 'utf8');
const foto = fs.readFileSync('api/foto.js', 'utf8');

assert.ok(src.includes("limite = '24'"));
assert.ok(src.includes('cursor'));
assert.ok(src.includes('proximo_cursor'));
assert.ok(src.includes('tem_mais'));
assert.ok(src.includes('jsonb_array_elements'));
assert.ok(src.includes('LIMIT ${limiteFotos + 1}'));
assert.ok(!/validacoes:\s*itens[\s\S]{0,120}\bfoto\b/.test(src));
assert.ok(src.includes('miniatura_url'));
assert.ok(src.includes('foto_url'));
assert.ok(foto.includes('req.query.index'));
assert.ok(foto.includes("variant === 'thumb'"));
assert.ok(foto.includes('fotoOriginal?.miniatura || fotoOriginal?.imagem'), 'foto antiga deve usar imagem original como fallback lazy');
assert.ok(foto.includes("'Cache-Control', 'private"));
console.log('galeria-paginacao.test.js passou');
