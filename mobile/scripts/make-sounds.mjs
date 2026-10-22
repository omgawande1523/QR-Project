// Writes the three notification sounds into android/app/src/main/res/raw and ios/App/App/Sounds (16-bit mono
// WAV, near full scale so they are heard in a busy kitchen; iOS plays WAV notification sounds up to 30 s). Each type sounds different so staff know what it is without looking:
//   new_order      three rising notes, the most insistent
//   table_request  a two-note "ding-dong", like a counter bell
//   order_ready    two quick high notes
// Channel ids and file names must match client/src/native/push.js. Run: node scripts/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RATE = 44100;

// A bell-like note: fundamental plus two partials with an exponential decay.
function note(freq, start, length, gain = 1) {
  return { freq, start, length, gain };
}

function render(notes, seconds) {
  const samples = new Float32Array(Math.round(RATE * seconds));
  for (const n of notes) {
    const from = Math.round(n.start * RATE);
    const count = Math.round(n.length * RATE);
    for (let i = 0; i < count && from + i < samples.length; i += 1) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.005);
      const envelope = attack * Math.exp(-t * 5.5) * n.gain;
      const wave = Math.sin(2 * Math.PI * n.freq * t) + 0.45 * Math.sin(2 * Math.PI * n.freq * 2 * t) + 0.2 * Math.sin(2 * Math.PI * n.freq * 3.01 * t);
      samples[from + i] += envelope * wave;
    }
  }
  const peak = samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0) || 1;
  const scale = 0.89 / peak; // about -1 dBFS
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(v * scale * 32767), i * 2));
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
  return Buffer.concat([header, data]);
}

const SOUNDS = {
  new_order: render([note(1046.5, 0, 0.9), note(1318.5, 0.16, 0.9), note(1568, 0.32, 1.1), note(1046.5, 0.9, 0.6, 0.8), note(1318.5, 1.06, 0.6, 0.8), note(1568, 1.22, 0.8, 0.8)], 2.1),
  table_request: render([note(880, 0, 1.0), note(698.5, 0.38, 1.2)], 1.6),
  order_ready: render([note(1760, 0, 0.35), note(1760, 0.22, 0.6)], 0.9)
};

for (const folder of ['../android/app/src/main/res/raw/', '../ios/App/App/Sounds/']) {
  const dir = fileURLToPath(new URL(folder, import.meta.url));
  mkdirSync(dir, { recursive: true });
  for (const [name, wav] of Object.entries(SOUNDS)) writeFileSync(`${dir}${name}.wav`, wav);
  console.log(`notification sounds written to ${dir}`);
}
