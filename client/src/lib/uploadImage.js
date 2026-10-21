import { api } from './api';

// Uploads one image file and returns its public URL. kind: 'menu' | 'logo' | 'profile' | 'banner'.
// The server checks, resizes and re-encodes the image; save the returned URL on the record.
export async function uploadImage(file, kind) {
  const data = new FormData();
  data.append('image', file);
  const res = await api.post(`/api/uploads/${kind}`, data);
  return res.data.url;
}
