import { Geolocation } from '@capacitor/geolocation';

window.NativeGeoBridge = {
  getCurrentPosition: (opts) => Geolocation.getCurrentPosition(opts),
  requestPermissions: () => Geolocation.requestPermissions()
};
