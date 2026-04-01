/**
 * Generate percussion WAV samples using advanced synthesis techniques:
 * - FM synthesis for metallic/wood sounds
 * - Karplus-Strong for plucked strings
 * - Noise-excited resonant filters for membranes
 * - Physical modeling concepts
 *
 * Run: node scripts/generate-samples.js
 */

const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT = path.join(__dirname, '..', 'public', 'audio');

// ── WAV writer ──────────────────────────────────────────────────────────────

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);     // chunk size
  buffer.writeUInt16LE(1, 20);      // PCM
  buffer.writeUInt16LE(1, 22);      // mono
  buffer.writeUInt32LE(SR, 24);     // sample rate
  buffer.writeUInt32LE(SR * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32);      // block align
  buffer.writeUInt16LE(16, 34);     // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  const filepath = path.join(OUT, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ── DSP utilities ───────────────────────────────────────────────────────────

function makeSamples(dur) {
  return new Float64Array(Math.ceil(SR * dur));
}

// White noise
function whiteNoise() {
  return Math.random() * 2 - 1;
}

// Biquad bandpass filter (direct form II)
class BiquadBP {
  constructor(freq, Q) {
    const w0 = 2 * Math.PI * freq / SR;
    const alpha = Math.sin(w0) / (2 * Q);
    this.b0 = alpha;
    this.b1 = 0;
    this.b2 = -alpha;
    this.a1 = -2 * Math.cos(w0);
    this.a2 = 1 - alpha;
    const a0 = 1 + alpha;
    this.b0 /= a0; this.b1 /= a0; this.b2 /= a0;
    this.a1 /= a0; this.a2 /= a0;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
            - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Biquad lowpass filter
class BiquadLP {
  constructor(freq, Q = 0.707) {
    const w0 = 2 * Math.PI * freq / SR;
    const alpha = Math.sin(w0) / (2 * Q);
    const cosw0 = Math.cos(w0);
    const a0 = 1 + alpha;
    this.b0 = ((1 - cosw0) / 2) / a0;
    this.b1 = (1 - cosw0) / a0;
    this.b2 = ((1 - cosw0) / 2) / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
            - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Biquad highpass filter
class BiquadHP {
  constructor(freq, Q = 0.707) {
    const w0 = 2 * Math.PI * freq / SR;
    const alpha = Math.sin(w0) / (2 * Q);
    const cosw0 = Math.cos(w0);
    const a0 = 1 + alpha;
    this.b0 = ((1 + cosw0) / 2) / a0;
    this.b1 = (-(1 + cosw0)) / a0;
    this.b2 = ((1 + cosw0) / 2) / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
            - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// One-pole lowpass (for Karplus-Strong damping)
class OnePoleLP {
  constructor(coeff) {
    this.a = coeff;
    this.prev = 0;
  }
  process(x) {
    this.prev = this.a * x + (1 - this.a) * this.prev;
    return this.prev;
  }
}

// Exponential decay envelope
function expDecay(t, attack, decay) {
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / decay);
}

// Linear interpolation
function lerp(a, b, t) { return a + (b - a) * t; }

// ── Karplus-Strong plucked string ───────────────────────────────────────────

function karplusStrong(freq, dur, brightness = 0.5, pluckPos = 0.5) {
  const out = makeSamples(dur);
  const delayLen = Math.round(SR / freq);
  const delay = new Float64Array(delayLen);

  // Fill delay line with filtered noise (pluck excitation)
  const pluckSample = Math.round(delayLen * pluckPos);
  for (let i = 0; i < delayLen; i++) {
    // Comb-filtered noise simulates pluck position
    delay[i] = whiteNoise() * (1 - 0.5 * Math.cos(2 * Math.PI * i / delayLen));
  }

  const damping = new OnePoleLP(0.3 + brightness * 0.65);
  let idx = 0;

  for (let i = 0; i < out.length; i++) {
    const sample = delay[idx];
    out[i] = sample;

    // Feedback: average adjacent samples + lowpass (string damping)
    const next = (idx + 1) % delayLen;
    const avg = 0.5 * (delay[idx] + delay[next]);
    delay[idx] = damping.process(avg) * 0.997; // slight loss

    idx = next;
  }

  return out;
}

// ── Instrument generators ───────────────────────────────────────────────────

function generateClave() {
  // Real clave: two hardwood sticks creating a sharp resonant click
  // FM synthesis with wood-like resonance + noise transient
  const dur = 0.08;
  const out = makeSamples(dur);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = expDecay(t, 0.0003, 0.012);

    // FM: modulator shapes carrier for inharmonic "wood" partials
    const modFreq = 3750;
    const carFreq = 2500;
    const modIndex = 4000 * expDecay(t, 0.0001, 0.008);
    const mod = Math.sin(2 * Math.PI * modFreq * t);
    const car = Math.sin(2 * Math.PI * (carFreq + modIndex * mod) * t);

    // Second resonance
    const car2 = Math.sin(2 * Math.PI * 4200 * t) * expDecay(t, 0.0002, 0.006);

    // Noise click
    const nclick = whiteNoise() * expDecay(t, 0.0001, 0.002) * 0.4;

    out[i] = (car * 0.7 + car2 * 0.3 + nclick) * env;
  }

  return out;
}

function generateConga() {
  // Conga open tone: membrane excitation + body resonance
  // Noise-excited resonant bandpass (membrane modes) + pitch sweep
  const dur = 0.7;
  const out = makeSamples(dur);

  // Membrane modes (circular drum head — Bessel function ratios)
  const f0 = 185;
  const modes = [
    { freq: f0,          Q: 25, amp: 1.0,  decay: 0.35 },
    { freq: f0 * 1.59,   Q: 20, amp: 0.35, decay: 0.15 },
    { freq: f0 * 2.14,   Q: 15, amp: 0.15, decay: 0.08 },
  ];

  const filters = modes.map(m => new BiquadBP(m.freq, m.Q));

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;

    // Excitation: short noise burst (hand hitting skin)
    const excite = whiteNoise() * expDecay(t, 0.0005, 0.008) * 3.0;

    // Sum membrane modes
    let sum = 0;
    for (let m = 0; m < modes.length; m++) {
      sum += filters[m].process(excite) * modes[m].amp * expDecay(t, 0.001, modes[m].decay);
    }

    // Body resonance (low)
    const body = Math.sin(2 * Math.PI * f0 * 0.5 * t) * expDecay(t, 0.002, 0.4) * 0.2;

    // Attack transient (slap of palm on skin)
    const attack = whiteNoise() * expDecay(t, 0.0002, 0.003) * 0.5;

    out[i] = sum + body + attack;
  }

  // Normalize
  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

function generateBongo() {
  // Higher-pitched, shorter, snappier than conga
  const dur = 0.25;
  const out = makeSamples(dur);

  const f0 = 380;
  const modes = [
    { freq: f0,        Q: 22, amp: 1.0,  decay: 0.08 },
    { freq: f0 * 1.59, Q: 18, amp: 0.4,  decay: 0.04 },
    { freq: f0 * 2.14, Q: 12, amp: 0.15, decay: 0.025 },
  ];

  const filters = modes.map(m => new BiquadBP(m.freq, m.Q));

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const excite = whiteNoise() * expDecay(t, 0.0003, 0.005) * 3.5;

    let sum = 0;
    for (let m = 0; m < modes.length; m++) {
      sum += filters[m].process(excite) * modes[m].amp * expDecay(t, 0.0005, modes[m].decay);
    }

    const attack = whiteNoise() * expDecay(t, 0.0001, 0.002) * 0.6;
    out[i] = sum + attack;
  }

  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

function generateSlap() {
  // Conga slap: muted, sharp attack, very short body
  const dur = 0.08;
  const out = makeSamples(dur);

  const bp1 = new BiquadBP(800, 8);
  const bp2 = new BiquadBP(2200, 5);
  const hp  = new BiquadHP(1500, 1.0);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const n = whiteNoise();
    const excite = n * expDecay(t, 0.0002, 0.004) * 4;

    // Muted membrane + sharp transient
    const mem  = bp1.process(excite) * expDecay(t, 0.0003, 0.025) * 0.6;
    const snap = hp.process(n) * expDecay(t, 0.0001, 0.005) * 0.8;
    const mid  = bp2.process(excite) * expDecay(t, 0.0003, 0.015) * 0.4;

    out[i] = mem + snap + mid;
  }

  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

function generateTimbales() {
  // Timbales cascara/rim: metallic, ringing
  // FM synthesis for inharmonic metallic spectrum
  const dur = 0.2;
  const out = makeSamples(dur);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = expDecay(t, 0.0002, 0.06);

    // FM pair 1: shell resonance
    const mod1 = Math.sin(2 * Math.PI * 1230 * t);
    const car1 = Math.sin(2 * Math.PI * (820 + 2500 * env * mod1) * t);

    // FM pair 2: higher ring
    const mod2 = Math.sin(2 * Math.PI * 2100 * t);
    const car2 = Math.sin(2 * Math.PI * (1550 + 1500 * env * mod2) * t);

    // Stick click (noise transient)
    const click = whiteNoise() * expDecay(t, 0.0001, 0.002) * 0.5;

    out[i] = (car1 * 0.5 + car2 * 0.25) * env + click;
  }

  return out;
}

function generateCowbell() {
  // Cowbell / cencerro: two inharmonic square-ish waves
  // FM synthesis with hard clipping for metallic character
  const dur = 0.45;
  const out = makeSamples(dur);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = expDecay(t, 0.0005, 0.15);

    // Two FM oscillators at inharmonic ratio (~1.5)
    const f1 = 545, f2 = 815;
    const mod = Math.sin(2 * Math.PI * f2 * t);
    const car = Math.sin(2 * Math.PI * (f1 + 800 * env * mod) * t);

    // Second voice
    const mod2 = Math.sin(2 * Math.PI * f1 * t);
    const car2 = Math.sin(2 * Math.PI * (f2 + 600 * env * mod2) * t);

    // Bandpass for bell-like focus
    const raw = (car * 0.5 + car2 * 0.3) * env;

    // Clipping for metallic edge
    out[i] = Math.tanh(raw * 2.5) * 0.7;
  }

  // Apply bandpass to clean up
  const bp = new BiquadBP(700, 1.2);
  const lp = new BiquadLP(3000, 0.8);
  for (let i = 0; i < out.length; i++) {
    out[i] = bp.process(out[i]) + lp.process(out[i]) * 0.3;
  }

  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

function generatePiano() {
  // Piano montuno chord stab: C4-E4-G4-C5
  // Karplus-Strong for each note, mixed
  const dur = 0.4;
  const notes = [261.6, 329.6, 392.0, 523.3];
  const amps  = [0.35, 0.25, 0.25, 0.2];

  const strings = notes.map((f, i) => {
    const s = karplusStrong(f, dur, 0.6, 0.3 + i * 0.05);
    // Apply envelope
    for (let j = 0; j < s.length; j++) {
      const t = j / SR;
      s[j] *= amps[i] * expDecay(t, 0.001, 0.25);
    }
    return s;
  });

  const out = makeSamples(dur);
  for (let i = 0; i < out.length; i++) {
    for (const s of strings) {
      if (i < s.length) out[i] += s[i];
    }
  }

  // Lowpass to soften
  const lp = new BiquadLP(4000, 0.707);
  for (let i = 0; i < out.length; i++) out[i] = lp.process(out[i]);

  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

function generateGuiro() {
  // Güiro scrape: amplitude-modulated filtered noise
  const dur = 0.12;
  const out = makeSamples(dur);
  const bp = new BiquadBP(1800, 1.5);
  const bp2 = new BiquadBP(3500, 2);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = expDecay(t, 0.005, 0.06);

    // AM modulation at ~50Hz creates the "ridges" scraping effect
    const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 50 * t);
    const n = whiteNoise() * am;

    out[i] = (bp.process(n) * 0.6 + bp2.process(n) * 0.3) * env;
  }

  return out;
}

function generateMaracas() {
  // Maracas: very short burst of high-frequency noise
  const dur = 0.06;
  const out = makeSamples(dur);
  const hp = new BiquadHP(6000, 0.8);
  const bp = new BiquadBP(9000, 1.5);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    // Envelope with slight attack for natural shaker feel
    let env;
    if (t < 0.003) env = t / 0.003;
    else env = expDecay(t - 0.003, 0, 0.025);

    const n = whiteNoise();
    out[i] = (hp.process(n) * 0.5 + bp.process(n) * 0.4) * env * 0.6;
  }

  return out;
}

function generateBass() {
  // Bass: Karplus-Strong at low frequency for realistic pluck
  const dur = 0.6;
  const freq = 65.4; // C2
  const out = karplusStrong(freq, dur, 0.35, 0.4);

  // Add sub-harmonic sine for weight
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = expDecay(t, 0.002, 0.35);
    out[i] += Math.sin(2 * Math.PI * freq * t) * env * 0.6;
    // Apply overall envelope
    out[i] *= expDecay(t, 0.003, 0.4);
  }

  // Lowpass for round bass tone
  const lp = new BiquadLP(300, 1.0);
  for (let i = 0; i < out.length; i++) out[i] = lp.process(out[i]);

  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

function generatePalito() {
  // Palito: wooden sticks — like clave but higher, drier, shorter
  const dur = 0.04;
  const out = makeSamples(dur);

  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = expDecay(t, 0.0002, 0.006);

    // FM: higher frequencies than clave for thinner sticks
    const modFreq = 5500;
    const carFreq = 3500;
    const modIndex = 5000 * expDecay(t, 0.0001, 0.004);
    const mod = Math.sin(2 * Math.PI * modFreq * t);
    const car = Math.sin(2 * Math.PI * (carFreq + modIndex * mod) * t);

    // Additional high partial
    const p2 = Math.sin(2 * Math.PI * 6000 * t) * expDecay(t, 0.0001, 0.003) * 0.3;

    // Click
    const click = whiteNoise() * expDecay(t, 0.00005, 0.001) * 0.3;

    out[i] = (car * 0.6 + p2 + click) * env;
  }

  return out;
}

function generateShekere() {
  // Shekeré: beaded gourd — granular noise bursts
  const dur = 0.08;
  const out = makeSamples(dur);
  const bp = new BiquadBP(4000, 0.8);
  const hp = new BiquadHP(2500, 0.5);

  // Multiple micro-grains for bead rattle effect
  const numGrains = 12;
  for (let g = 0; g < numGrains; g++) {
    const start = Math.random() * 0.04;
    const grainDur = 0.003 + Math.random() * 0.005;
    const startSamp = Math.round(start * SR);
    const endSamp = Math.min(out.length, Math.round((start + grainDur) * SR));
    const amp = 0.15 + Math.random() * 0.15;

    for (let i = startSamp; i < endSamp; i++) {
      const localT = (i - startSamp) / SR;
      const grainEnv = Math.sin(Math.PI * localT / grainDur); // Hann window
      out[i] += whiteNoise() * grainEnv * amp;
    }
  }

  // Filter the result
  for (let i = 0; i < out.length; i++) {
    out[i] = bp.process(out[i]) * 0.6 + hp.process(out[i]) * 0.3;
  }

  // Overall envelope
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] *= expDecay(t, 0.005, 0.04);
  }

  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

function generateTres() {
  // Tres cubano: bright plucked string chord (E4-G#4-C5)
  // Karplus-Strong with higher brightness for steel strings
  const dur = 0.35;
  const notes = [329.6, 415.3, 523.3];
  const amps  = [0.4, 0.35, 0.3];

  const strings = notes.map((f, i) => {
    const s = karplusStrong(f, dur, 0.75, 0.25);
    for (let j = 0; j < s.length; j++) {
      const t = j / SR;
      s[j] *= amps[i] * expDecay(t, 0.0005, 0.2);
    }
    return s;
  });

  const out = makeSamples(dur);
  for (let i = 0; i < out.length; i++) {
    for (const s of strings) {
      if (i < s.length) out[i] += s[i];
    }
  }

  // Slight brightness boost
  const bp = new BiquadBP(2000, 0.5);
  for (let i = 0; i < out.length; i++) {
    out[i] += bp.process(out[i]) * 0.2;
  }

  const peak = out.reduce((mx, s) => Math.max(mx, Math.abs(s)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.1;

  return out;
}

// ── Generate all samples ────────────────────────────────────────────────────

console.log('\n🥁 Generating percussion samples...\n');

fs.mkdirSync(OUT, { recursive: true });

writeWav('clave.wav',    generateClave());
writeWav('conga.wav',    generateConga());
writeWav('bongo.wav',    generateBongo());
writeWav('slap.wav',     generateSlap());
writeWav('timbales.wav', generateTimbales());
writeWav('cowbell.wav',  generateCowbell());
writeWav('piano.wav',    generatePiano());
writeWav('guiro.wav',    generateGuiro());
writeWav('maracas.wav',  generateMaracas());
writeWav('bass.wav',     generateBass());
writeWav('palito.wav',   generatePalito());
writeWav('shekere.wav',  generateShekere());
writeWav('tres.wav',     generateTres());

console.log('\n✅ All samples generated in public/audio/\n');
