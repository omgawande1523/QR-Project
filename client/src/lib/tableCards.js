import QRCode from 'qrcode';
import { APP_NAME } from '../config';
import { cssVar } from './tokens';

// Default QR colour: the brand's dark olive (dark enough to scan reliably).
export const defaultQrColor = () => cssVar('--olive-800', '#485000');

export const tableUrl = (restaurantId, table) => `${window.location.origin}/menu/${restaurantId}?table=${table}`;

// Relative luminance; QR codes need dark modules on a light background to scan reliably.
export function isDarkEnough(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (luminance + 0.05) >= 4.5; // contrast with white
}

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous'; // uploads are served with CORS so the canvas stays exportable
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// QR code canvas with an optional logo in the centre (error correction H tolerates ~30% cover).
export async function qrCanvas(text, { size = 600, color = defaultQrColor(), logo = null } = {}) {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, { width: size, margin: 1, errorCorrectionLevel: 'H', color: { dark: color, light: '#ffffff' } });
  if (logo) {
    const ctx = canvas.getContext('2d');
    const box = size * 0.22;
    const x = (size - box) / 2;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x - box * 0.08, x - box * 0.08, box * 1.16, box * 1.16, box * 0.22);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, x, box, box, box * 0.18);
    ctx.clip();
    ctx.drawImage(logo, x, x, box, box);
    ctx.restore();
  }
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A printable table card (3:4): restaurant, "Scan to order", QR, big table number.
export async function tableCardCanvas({ restaurantName, restaurantId, table, color, logo }) {
  const width = 1200;
  const height = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  await document.fonts?.ready;
  const font = (weight, px) => `${weight} ${px}px "Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif`;

  ctx.fillStyle = cssVar('--cream-bg', '#faf6ee');
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 60, 60, width - 120, height - 120, 80);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, 60, 60, width - 120, 220, 80);
  ctx.fill();
  ctx.fillRect(60, 200, width - 120, 80);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(800, 72);
  ctx.fillText(fitText(ctx, restaurantName, width - 240), width / 2, 200);

  ctx.fillStyle = cssVar('--ink', '#1e2112');
  ctx.font = font(700, 54);
  ctx.fillText('Scan to see the menu & order', width / 2, 400);

  const qr = await qrCanvas(tableUrl(restaurantId, table), { size: 760, color, logo });
  ctx.drawImage(qr, (width - 760) / 2, 450);

  ctx.font = font(800, 150);
  ctx.fillStyle = color;
  ctx.fillText(`Table ${table}`, width / 2, 1390);
  ctx.font = font(600, 36);
  ctx.fillStyle = cssVar('--muted', '#5f634e');
  ctx.fillText(`Powered by ${APP_NAME}`, width / 2, 1470);
  return canvas;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// A4 portrait, four cards per page (2 x 2), each about 92 x 123 mm.
export async function downloadTablesPdf({ restaurantName, restaurantId, tables, color, logo }) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cardW = 92;
  const cardH = cardW * (4 / 3);
  const gapX = (210 - cardW * 2) / 3;
  const gapY = (297 - cardH * 2) / 3;
  for (let i = 0; i < tables.length; i += 1) {
    if (i > 0 && i % 4 === 0) pdf.addPage();
    const slot = i % 4;
    const x = gapX + (slot % 2) * (cardW + gapX);
    const y = gapY + Math.floor(slot / 2) * (cardH + gapY);
    const card = await tableCardCanvas({ restaurantName, restaurantId, table: tables[i], color, logo });
    pdf.addImage(card.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, cardW, cardH);
  }
  pdf.save(`${restaurantName.replace(/[^\w]+/g, '-')}-table-cards.pdf`);
}
