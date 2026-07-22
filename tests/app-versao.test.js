const assert = require('assert');
const fs = require('fs');

const api = fs.readFileSync('api/app-presenca.js', 'utf8');
assert.ok(api.includes('app_presencas'), 'deve persistir presença e versão do aplicativo');
assert.ok(api.includes("sessao.tipo === 'promotor'"), 'somente promotor registra a própria versão');

const plugin = fs.readFileSync('app/android/app/src/main/java/com/cleantabaco/promotor/JornadaPlugin.java', 'utf8');
assert.ok(plugin.includes('info.versionName'), 'plugin deve informar versionName nativa');
assert.ok(plugin.includes('info.getLongVersionCode()'), 'plugin deve informar versionCode nativo');

const gradle = fs.readFileSync('app/android/app/build.gradle', 'utf8');
assert.ok(gradle.includes('versionCode 2'), 'novo APK deve incrementar versionCode');
assert.ok(gradle.includes('versionName "1.1.0"'), 'painel deve mostrar versão 1.1.0');

for (const arquivo of ['index.html', 'app/www/index.html']) {
  const html = fs.readFileSync(arquivo, 'utf8');
  assert.ok(html.includes('/api/app-presenca'), `${arquivo}: deve registrar e consultar versão`);
  assert.ok(html.includes('Versão do app:'), `${arquivo}: painel deve exibir versão instalada`);
  assert.ok(html.includes('Último contato:'), `${arquivo}: painel deve exibir último contato`);
}

console.log('app-versao.test.js passou');
