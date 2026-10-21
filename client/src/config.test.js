import API_BASE_URL, { SOCKET_URL, APP_NAME } from './config';

describe('config', () => {
  test('defaults to the local API when VITE_API_URL is not set', () => {
    expect(API_BASE_URL).toBe('http://localhost:5000');
  });

  test('sockets use the API URL unless VITE_SOCKET_URL is set', () => {
    expect(SOCKET_URL).toBe(API_BASE_URL);
  });

  test('the product name lives in one constant', () => {
    expect(APP_NAME).toBe('QR Menu');
  });
});
