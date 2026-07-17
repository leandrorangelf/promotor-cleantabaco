const assert = require('assert');
const fs = require('fs');

const web = fs.readFileSync('app/www/index.html', 'utf8');
assert.ok(web.includes('jornadaStatus'), 'assets Android devem conter cartão da jornada');
assert.ok(fs.existsSync('app/www/jornada-bridge.js'), 'assets Android devem conter bridge da jornada');
assert.ok(fs.existsSync('app/www/geo-bridge.js'), 'assets Android devem conter bridge GPS');
const manifest = fs.readFileSync('app/android/app/src/main/AndroidManifest.xml', 'utf8');
assert.ok(manifest.includes('ACCESS_BACKGROUND_LOCATION'), 'manifest deve permitir localização em segundo plano');
assert.ok(manifest.includes('FOREGROUND_SERVICE_LOCATION'), 'manifest deve declarar foreground location');
assert.ok(manifest.includes('JornadaForegroundService'), 'manifest deve registrar o serviço');
console.log('jornada-integracao.test.js passou');
