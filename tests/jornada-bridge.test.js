const assert = require('assert');
const fs = require('fs');

const bridge = fs.readFileSync('app/src/jornada-bridge.js', 'utf8');
for (const metodo of ['getStatus', 'start', 'stop', 'flush', 'schedule']) {
  assert.ok(bridge.includes(metodo), `bridge deve expor ${metodo}`);
}
const packageJson = fs.readFileSync('app/package.json', 'utf8');
assert.ok(packageJson.includes('build:jornada-bridge'), 'package deve ter build da ponte');
const plugin = fs.readFileSync('app/android/app/src/main/java/com/cleantabaco/promotor/JornadaPlugin.java', 'utf8');
for (const metodo of ['getStatus', 'start', 'stop', 'flush', 'schedule']) {
  assert.ok(plugin.includes(metodo), `plugin deve implementar ${metodo}`);
}
console.log('jornada-bridge.test.js passou');
