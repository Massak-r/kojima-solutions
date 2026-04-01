/**
 * Generate salsa/rumba loop WAV files from one-shot samples.
 * Each instrument gets its own 2-bar loop at a reference BPM.
 * Adds slight humanization (timing + velocity) for natural feel.
 *
 * Usage: node scripts/generate-loops.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '..', 'public', 'audio');

// ── WAV helpers ──────────────────────────────────────────────────────────────

function readWav(path) {
  const buf = readFileSync(path);
  // Parse WAV header
  const numChannels = buf.readUInt16LE(22);
  const sampleRate  = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  // Find 'data' chunk
  let dataOffset = 12;
  while (dataOffset < buf.length - 8) {
    const id = buf.toString('ascii', dataOffset, dataOffset + 4);
    const size = buf.readUInt32LE(dataOffset + 4);
    if (id === 'data') {
      dataOffset += 8;
      const samples = [];
      const bytesPerSample = bitsPerSample / 8;
      for (let i = 0; i < size; i += bytesPerSample * numChannels) {
        // Read first channel only (mono or left)
        if (bitsPerSample === 16) {
          samples.push(buf.readInt16LE(dataOffset + i) / 32768);
        } else if (bitsPerSample === 24) {
          const b0 = buf[dataOffset + i];
          const b1 = buf[dataOffset + i + 1];
          const b2 = buf[dataOffset + i + 2];
          const val = (b2 << 16) | (b1 << 8) | b0;
          samples.push((val > 0x7FFFFF ? val - 0x1000000 : val) / 8388608);
        }
      }
      return { samples, sampleRate };
    }
    dataOffset += 8 + size;
    if (size % 2) dataOffset++; // word alignment
  }
  throw new Error('No data chunk found in ' + path);
}

function writeWav(path, samples, sampleRate) {
  const numSamples = samples.length;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);      // chunk size
  buf.writeUInt16LE(1, 20);       // PCM
  buf.writeUInt16LE(1, 22);       // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(bytesPerSample, 32);  // block align
  buf.writeUInt16LE(16, 34);      // bits per sample
  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buf);
}

// ── Loop generation ──────────────────────────────────────────────────────────

const B = true, _ = false;

function humanize(baseMs, amount = 8) {
  // Random offset ±amount ms
  return baseMs + (Math.random() - 0.5) * 2 * amount;
}

function velocityVar(base = 1.0, range = 0.15) {
  return base + (Math.random() - 0.5) * 2 * range;
}

function generateLoop({ samplePath, pattern, bpm, sampleRate = 44100 }) {
  const sample = readWav(samplePath);

  // Resample if needed
  let sampleData = sample.samples;
  if (sample.sampleRate !== sampleRate) {
    const ratio = sample.sampleRate / sampleRate;
    const newLen = Math.floor(sampleData.length / ratio);
    const resampled = new Float64Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i * ratio;
      const idx = Math.floor(srcIdx);
      const frac = srcIdx - idx;
      resampled[i] = (sampleData[idx] || 0) * (1 - frac) + (sampleData[idx + 1] || 0) * frac;
    }
    sampleData = Array.from(resampled);
  }

  // 16 steps = 2 bars of 4/4 in 8th notes
  const stepDuration = 60 / (bpm * 2); // seconds per step
  const loopDuration = 16 * stepDuration;
  const loopSamples = Math.ceil(loopDuration * sampleRate);
  const output = new Float64Array(loopSamples);

  for (let step = 0; step < 16; step++) {
    if (!pattern[step]) continue;

    const baseOffsetMs = step * stepDuration * 1000;
    const offsetMs = humanize(baseOffsetMs, step === 0 ? 0 : 6); // don't humanize beat 1
    const offsetSamples = Math.round((offsetMs / 1000) * sampleRate);
    const vel = velocityVar(1.0, 0.12);

    for (let i = 0; i < sampleData.length; i++) {
      const pos = offsetSamples + i;
      if (pos >= 0 && pos < loopSamples) {
        output[pos] += sampleData[i] * vel;
      }
    }
  }

  return Array.from(output);
}

// ── Define styles ────────────────────────────────────────────────────────────

const SALSA_BPM = 95;
const RUMBA_BPM = 72;

const styles = {
  salsa: {
    bpm: SALSA_BPM,
    instruments: [
      { name: 'clave',    file: 'clave.wav',    pattern: [B,_,_,B,_,_,B,_, _,_,B,_,B,_,_,_] },
      { name: 'conga',    file: 'conga.wav',    pattern: [_,_,_,B,_,_,_,B, _,_,_,B,_,_,_,B] },
      { name: 'bongo',    file: 'bongo.wav',    pattern: [_,B,_,_,_,B,_,B, _,B,_,_,_,B,_,B] },
      { name: 'timbales', file: 'timbales.wav', pattern: [_,B,_,B,_,_,B,_, _,B,_,B,_,_,B,_] },
      { name: 'cowbell',  file: 'cowbell.wav',  pattern: [B,_,_,_,B,_,B,_, B,_,_,_,B,_,B,_] },
      { name: 'maracas',  file: 'maracas.wav',  pattern: [B,B,B,B,B,B,B,B, B,B,B,B,B,B,B,B] },
      { name: 'piano',    file: 'piano.wav',    pattern: [_,_,_,B,_,_,B,B, _,B,B,_,_,_,B,_] },
      { name: 'guiro',    file: 'guiro.wav',    pattern: [B,_,B,_,B,_,B,_, B,_,B,_,B,_,B,_] },
      { name: 'bass',     file: 'bass.wav',     pattern: [B,_,_,_,_,_,_,B, _,B,_,_,_,_,_,_] },
    ],
  },
  rumba: {
    bpm: RUMBA_BPM,
    instruments: [
      { name: 'clave',   file: 'clave.wav',   pattern: [B,_,_,B,_,_,_,B, _,_,B,_,B,_,_,_] },
      { name: 'quinto',  file: 'bongo.wav',   pattern: [_,_,B,_,_,B,_,B, _,_,B,_,_,_,B,_] },
      { name: 'tresdos', file: 'slap.wav',    pattern: [_,B,_,_,_,_,B,_, _,B,_,_,_,_,B,_] },
      { name: 'tumba',   file: 'conga.wav',   pattern: [B,_,_,_,B,_,_,_, B,_,_,_,B,_,_,_] },
      { name: 'palito',  file: 'palito.wav',  pattern: [B,B,_,B,_,_,B,B, B,B,_,B,_,_,B,B] },
      { name: 'shekere', file: 'shekere.wav', pattern: [B,_,B,_,B,_,B,_, B,_,B,_,B,_,B,_] },
      { name: 'guiro',   file: 'guiro.wav',   pattern: [B,_,_,B,_,_,_,_, B,_,_,B,_,_,_,_] },
    ],
  },
};

// ── Generate all loops ───────────────────────────────────────────────────────

const LOOPS_DIR = join(AUDIO_DIR, 'loops');
mkdirSync(LOOPS_DIR, { recursive: true });

for (const [styleName, style] of Object.entries(styles)) {
  console.log(`\n── ${styleName.toUpperCase()} (${style.bpm} BPM) ──`);

  for (const instr of style.instruments) {
    const samplePath = join(AUDIO_DIR, instr.file);
    const outPath = join(LOOPS_DIR, `${styleName}_${instr.name}.wav`);

    const loop = generateLoop({
      samplePath,
      pattern: instr.pattern,
      bpm: style.bpm,
    });

    writeWav(outPath, loop, 44100);
    const sizeKB = (readFileSync(outPath).length / 1024).toFixed(1);
    console.log(`  ✓ ${styleName}_${instr.name}.wav (${sizeKB} KB)`);
  }
}

console.log('\n✅ All loops generated!\n');
