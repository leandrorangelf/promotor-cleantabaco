const assert = require('assert');
const fs = require('fs');

const scheduler = fs.readFileSync('app/android/app/src/main/java/com/cleantabaco/promotor/JornadaScheduler.java', 'utf8');
assert.ok(scheduler.includes('08'), 'scheduler deve ter início às 08h');
assert.ok(scheduler.includes('18'), 'scheduler deve ter fim às 18h');
assert.ok(scheduler.includes('America/Sao_Paulo'), 'scheduler deve usar o fuso da operação');
assert.ok(scheduler.includes('MONDAY') && scheduler.includes('FRIDAY'), 'scheduler deve restringir dias úteis');
assert.ok(scheduler.includes('AlarmManager'), 'scheduler deve usar AlarmManager');

const receiver = fs.readFileSync('app/android/app/src/main/java/com/cleantabaco/promotor/JornadaBootReceiver.java', 'utf8');
assert.ok(receiver.includes('BOOT_COMPLETED'), 'receiver deve tratar reinicialização');
assert.ok(receiver.includes('JornadaScheduler'), 'receiver deve reagendar a jornada');

const manifest = fs.readFileSync('app/android/app/src/main/AndroidManifest.xml', 'utf8');
assert.ok(manifest.includes('BOOT_COMPLETED'), 'manifest deve registrar BOOT_COMPLETED');
console.log('jornada-agendamento.test.js passou');
