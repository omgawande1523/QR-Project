import axios from 'axios';
import API_BASE_URL from '../config';

// Uploads one image file and returns its public URL. kind: 'menu' | 'logo' | 'profile' | 'banner'.
// The server checks, resizes and re-encodes the image; save the returned URL on the record.
export async function uploadImage(file, kind) {
  const data = new FormData();
  data.append('image', file);
  const res = await axios.post(`${API_BASE_URL}/api/uploads/${kind}`, data, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  return res.data.url;
}
