import { resizedUrl, responsiveImage } from './srcset';

const local = 'http://localhost:5000/uploads/menu/0b0e6a9c-6f6e-4a52-9a3c-2f0b7d3d9e11.webp';
const cloud = 'https://res.cloudinary.com/demo/image/upload/v1712345678/qr-menu/menu/0b0e6a9c-6f6e-4a52-9a3c-2f0b7d3d9e11.webp';

describe('responsive image URLs', () => {
  test('local uploads get ?w=', () => {
    expect(resizedUrl(local, 320)).toBe(`${local}?w=320`);
  });

  test('Cloudinary images get a resize transformation', () => {
    expect(resizedUrl(cloud, 480)).toBe('https://res.cloudinary.com/demo/image/upload/w_480,c_limit,f_auto,q_auto/v1712345678/qr-menu/menu/0b0e6a9c-6f6e-4a52-9a3c-2f0b7d3d9e11.webp');
  });

  test('other images are left alone', () => {
    expect(resizedUrl('https://example.com/dosa.jpg', 320)).toBe('https://example.com/dosa.jpg');
    expect(responsiveImage('https://example.com/dosa.jpg', { sizes: '50vw' })).toEqual({ src: 'https://example.com/dosa.jpg' });
    expect(responsiveImage(undefined)).toEqual({ src: undefined });
  });

  test('builds src, srcSet and sizes', () => {
    expect(responsiveImage(local, { widths: [320, 640], sizes: '50vw' })).toEqual({
      src: `${local}?w=640`,
      srcSet: `${local}?w=320 320w, ${local}?w=640 640w`,
      sizes: '50vw'
    });
  });
});
