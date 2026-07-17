const assert = require('assert');
const fs = require('fs');

const manifest = fs.readFileSync('app/android/app/src/main/AndroidManifest.xml', 'utf8');
for (const permissao of ['ACCESS_BACKGROUND_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION', 'POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED']) {
  assert.ok(manifest.includes(`android.permission.${permissao}`), `manifest deve declarar ${permissao}`);
}
assert.ok(manifest.includes('foregroundServiceType="location"'), 'serviço deve ser do tipo location');

for (const classe of ['JornadaForegroundService.java', 'JornadaStorage.java', 'JornadaApiClient.java']) {
  assert.ok(fs.existsSync(`app/android/app/src/main/java/com/cleantabaco/promotor/${classe}`), `${classe} deve existir`);
}

const gradle = fs.readFileSync('app/android/app/build.gradle', 'utf8');
assert.ok(gradle.includes('play-services-location'), 'Android deve usar Fused Location Provider');
console.log('jornada-android.test.js passou');
