import { registerPlugin } from '@capacitor/core';

const Jornada = registerPlugin('Jornada');
window.NativeJornadaBridge = {
  getStatus: () => Jornada.getStatus(),
  start: (options) => Jornada.start(options),
  stop: (options) => Jornada.stop(options),
  flush: () => Jornada.flush(),
  schedule: (options) => Jornada.schedule(options)
};
