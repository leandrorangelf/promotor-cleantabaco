const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('<option value="coordenador">Coordenador</option>'), 'perfil deve incluir coordenador');
assert.ok(html.includes('id="admCoordenador"'), 'form deve ter campo coordenador responsavel');
assert.ok(html.includes('renderCoordenadoresAdmin'), 'deve renderizar lista de coordenadores');
assert.ok(html.includes('coordenador_usuario'), 'ui deve enviar/mostrar coordenador_usuario');
assert.ok(html.includes('Coordenador:'), 'lista deve exibir coordenador do promotor');

console.log('coordenadores-ui.test.js passou');
