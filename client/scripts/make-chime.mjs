// Writes public/notification.wav: a soft two-note chime (A5 then E6) for new-order alerts.
// Plain PCM so no encoder is needed. Run: node scripts/make-chime.mjs
import { writeFileSync } from 'node:fs';

const RATE = 22050;
const notes = [{ freq: 880, start: 0, length: 0.45 }, { freq: 1318.5, start: 0.16, length: 0.6 }];
const total = Math.ceil(RATE * 0.8);
const samples = new Float32Array(total);
for (const { freq, start, length } of notes) {
  const from = Math.floor(start * RATE);
  for (let i = 0; i < length * RATE && from + i < total; i += 1) {
    const t = i / RATE;
    const envelope = Math.min(1, t / 0.01) * Math.exp(-t * 6); // quick attack, bell-like decay
    samples[from + i] += envelope * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t));
  }
}
const peak = Math.max(...samples.map(Math.abs));
const data = Buffer.alloc(total * 2);
samples.forEach((s, i) => data.writeInt16LE(Math.round((s / peak) * 0.7 * 32767), i * 2));

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(new URL('../public/notification.wav', import.meta.url), Buffer.concat([header, data]));
console.log(`public/notification.wav: ${44 + data.length} bytes`);
