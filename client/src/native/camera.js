import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// "Take photo" and "Choose from gallery" in the image picker. Returns a File for the usual upload and crop
// flow, or null if the person backed out. Photos are scaled to at most 2400 px before upload (the server
// keeps originals up to 3000 px), which keeps uploads quick on mobile data.
export async function pickPhoto(source) {
  let photo;
  try {
    photo = await Camera.getPhoto({
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 85,
      width: 2400,
      correctOrientation: true,
      saveToGallery: false
    });
  } catch (err) {
    if (/cancel|no image/i.test(err?.message || '')) return null;
    throw err;
  }
  const blob = await (await fetch(photo.webPath)).blob();
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : `image/${photo.format === 'png' ? 'png' : 'jpeg'}`;
  return new File([blob], `photo.${photo.format || 'jpg'}`, { type });
}
