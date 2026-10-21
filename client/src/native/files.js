import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// Writes the file to the app's cache and opens the Android share sheet (WhatsApp, Drive, Gmail, print...).
// Closing the sheet without choosing is not an error.
export async function shareBlob(blob, filename, title) {
  const path = `shared/${Date.now()}-${filename.replace(/[^\w.-]+/g, '-')}`;
  const { uri } = await Filesystem.writeFile({ path, data: await toBase64(blob), directory: Directory.Cache, recursive: true });
  try {
    await Share.share({ title, files: [uri], dialogTitle: title });
  } catch (err) {
    if (!/cancel/i.test(err?.message || '')) throw err;
  }
}
