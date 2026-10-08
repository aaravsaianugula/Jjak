/**
 * All sound is synthesised with WebAudio — no audio files to license or ship.
 * Soft wood "tok" for taps, a bell for each jjak that climbs a pentatonic scale
 * with the combo, and a low stamp + chord when a board is cleared.
 */
import { save } from './storage';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** The shared AudioContext (created on demand), regardless of the sound setting. */
export function audioContext(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * App hidden: stop the audio stream itself, not just its volume, so the phone's audio
 * hardware can sleep. The next sound (or music on return) resumes it via audioContext().
 */
export function suspendAudio(): void {
  if (ctx?.state === 'running') void ctx.suspend();
}

function ac(): AudioContext | null {
  if (!save.settings.sound) return null;
  return audioContext();
}

/** Call from the first user gesture so iOS/Android webviews unlock audio. */
export const unlockAudio = () => void audioContext();

/** True once audio has been unlocked by a gesture (ambient sounds wait for this). */
export const audioReady = () => ctx?.state === 'running';

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, glideTo?: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master!);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, freq: number, vol: number) {
  const c = ctx!;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(bp).connect(g).connect(master!);
  src.start(start);
}

// D major pentatonic, two octaves — always consonant whatever the combo.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const note = (step: number, base = 587.33) => base * 2 ** (SCALE[Math.min(step, SCALE.length - 1)] / 12);

export const sfx = {
  tap() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    noise(t, 0.03, 2200, 0.35);
    tone(1300, t, 0.05, 'sine', 0.12, 700);
  },
  deselect() {
    const c = ac();
    if (!c) return;
    tone(700, c.currentTime, 0.05, 'sine', 0.06, 500);
  },
  match(combo: number) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const f = note(combo - 1 + 2);
    tone(f, t, 0.9, 'sine', 0.22);
    tone(f * 2.01, t, 0.45, 'sine', 0.05);
    tone(f * 3, t + 0.005, 0.25, 'triangle', 0.025);
    if (combo >= 3) tone(note(combo + 3), t + 0.07, 0.6, 'sine', 0.08);
  },
  miss() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    tone(160, t, 0.12, 'sine', 0.2, 110);
    noise(t, 0.05, 400, 0.2);
  },
  shuffle() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 6; i++) noise(t + i * 0.035, 0.03, 2800 - i * 200, 0.18);
  },
  hint() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    tone(note(4), t, 0.4, 'sine', 0.08);
    tone(note(6), t + 0.09, 0.5, 'sine', 0.07);
  },
  stamp() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    tone(90, t, 0.25, 'sine', 0.4, 50);
    noise(t, 0.08, 300, 0.5);
    [0, 2, 4, 7].forEach((s, i) => tone(note(s + 3, 293.66), t + 0.12 + i * 0.07, 1.4, 'sine', 0.09));
  },
  reveal() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    [7, 9, 12].forEach((s, i) => tone(note(Math.min(9, s - 3)), t + i * 0.06, 0.8, 'sine', 0.07));
  },
  /** Garden wind chime: a small bronze bell, inharmonic partials, long soft tail. */
  chime() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const f = note(5 + Math.floor(Math.random() * 3), 880);
    tone(f, t, 2.4, 'sine', 0.08);
    tone(f * 2.76, t, 1.1, 'sine', 0.025);
    tone(f * 5.4, t, 0.4, 'sine', 0.01);
    tone(f * 1.5, t + 0.32, 1.6, 'sine', 0.03);
  },
  /** Bamboo fountain: a hollow wooden clack (`vol` < 1 for the distant, ambient one). */
  clack(vol = 1) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    noise(t, 0.04, 900, 0.5 * vol);
    tone(420, t, 0.09, 'triangle', 0.18 * vol, 300);
    tone(840, t, 0.05, 'sine', 0.06 * vol);
  },
};
