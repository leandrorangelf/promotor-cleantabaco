import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

window.NativeCameraBridge = {
  getPhoto: (opts) => Camera.getPhoto(opts),
  CameraResultType,
  CameraSource
};
