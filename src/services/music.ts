/**
 * Generative seasonal music, synthesised live with WebAudio: plucked notes
 * that wander a pentatonic scale over a slow drone, with a soft echo.
 * Each season has its own scale and colour:
 *   Spring  — major pentatonic (Korean pyeongjo feel), bright
 *   Summer  — lower, slower major pentatonic, warm
 *   Autumn  — yo scale, wistful
 *   Winter  — in (miyako-bushi) scale, quiet and sparse
 * No audio files, nothing to license, ~zero download size.
 */
import { audioContext } from './audio';
import { save } from './storage';

interface Mode {
  notes: number[]; // MIDI notes of the scale (two octaves)
  root: number; // drone root (MIDI)
  stepMs: number;
  density: number; // chance a step plays a note
  bright: number; // low-pass cutoff (Hz)
}

const MODES: Mode[] = [
  { notes: [62, 64, 66, 69, 71, 74, 76, 78, 81], root: 50, stepMs: 420, density: 0.42, bright: 3200 },
  { notes: [55, 57, 59, 62, 64, 67, 69, 71, 74], root: 43, stepMs: 480, density: 0.36, bright: 2600 },
  { notes: [57, 59, 62, 64, 66, 69, 71, 74, 76], root: 45, stepMs: 520, density: 0.34, bright: 2300 },
  { notes: [64, 65, 69, 71, 72, 76, 77, 81, 83], root: 52, stepMs: 600, density: 0.26, bright: 2000 },
];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Market music presets: an instrument, an optional scale and a tempo flavour laid
 * over the seasonal modes. 'default' leaves the seasonal music exactly as it is.
 */
interface Preset {
  voice: 'pluck' | 'zither' | 'koto' | 'flute' | 'bell';
  /** × stepMs (higher = slower) */
  tempo: number;
  /** × note density */
  density: number;
  /** semitones */
  shift: number;
  /** × low-pass cutoff */
  bright: number;
  /** replaces the season's scale */
  scale?: { notes: number[]; root: number };
  /** soft rain noise under the music */
  rain?: boolean;
}

export const MUSIC_PRESETS: Record<string, Preset> = {
  default: { voice: 'pluck', tempo: 1, density: 1, shift: 0, bright: 1 },
  // Gayageum: lower, warm plucks whose long notes bend and sway (nonghyeon).
  gayageum: { voice: 'zither', tempo: 1.12, density: 0.95, shift: -5, bright: 0.85 },
  // Koto in the in (miyako-bushi) scale, with rain outside.
  koto: { voice: 'koto', tempo: 1.2, density: 0.85, shift: 0, bright: 1.15, scale: { notes: [62, 63, 67, 69, 70, 74, 75, 79, 81], root: 50 }, rain: true },
  // Bamboo flute (daegeum / shakuhachi): breathy, long and slow.
  flute: { voice: 'flute', tempo: 1.9, density: 0.6, shift: 0, bright: 0.8 },
  // Moonlight: high bell tones in the yo scale, far apart.
  moonlight: { voice: 'bell', tempo: 1.6, density: 0.5, shift: 0, bright: 1.25, scale: { notes: [69, 71, 74, 76, 78, 81, 83, 86, 88], root: 45 } },
};

class Music {
  private season = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextAt = 0;
  private step = 0;
  private walk = 4;
  private out: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private ducked = false;
  private presetId = 'default';
  private previewId: string | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewOwnsTimer = false;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private noiseBuf: AudioBuffer | null = null;

  setSeason(season: number) {
    this.season = ((season % 4) + 4) % 4;
    if (this.filter) this.filter.frequency.value = this.mode().bright;
  }

  /** Equip a Market music preset ('default' = the seasonal plucks). */
  setPreset(id: string) {
    this.presetId = MUSIC_PRESETS[id] ? id : 'default';
    this.applyPreset();
  }

  /** Play a short preview of a preset (even with the Music setting off), then return. */
  preview(id: string, ms = 4000) {
    const ctx = audioContext();
    if (!ctx || !MUSIC_PRESETS[id]) return;
    if (!this.out) this.build(ctx);
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewId = id;
    this.applyPreset();
    this.step = 0;
    if (!this.timer) {
      this.previewOwnsTimer = true;
      this.out!.gain.cancelScheduledValues(ctx.currentTime);
      this.out!.gain.setTargetAtTime(this.ducked ? 0 : 0.16, ctx.currentTime, 0.15);
      this.nextAt = ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 100);
    } else this.nextAt = Math.max(this.nextAt, ctx.currentTime + 0.05);
    this.syncRain();
    this.previewTimer = setTimeout(() => this.stopPreview(), ms);
  }

  /** End a preview early (e.g. when leaving the Market). */
  stopPreview() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = null;
    if (this.previewId == null) return;
    this.previewId = null;
    this.applyPreset();
    if (this.previewOwnsTimer) {
      this.previewOwnsTimer = false;
      this.stop();
      if (save.settings.music) this.start();
    }
  }

  /** The preset being previewed right now, if any. */
  get previewing(): string | null {
    return this.previewId;
  }

  private active(): Preset {
    return MUSIC_PRESETS[this.previewId ?? this.presetId] ?? MUSIC_PRESETS.default;
  }

  /** The season's mode with the active preset laid over it. */
  private mode(): Mode {
    const base = MODES[this.season];
    const p = this.active();
    if (p === MUSIC_PRESETS.default) return base;
    const sc = p.scale ?? base;
    return {
      notes: sc.notes.map((n) => n + p.shift),
      root: sc.root + p.shift,
      stepMs: base.stepMs * p.tempo,
      density: base.density * p.density,
      bright: base.bright * p.bright,
    };
  }

  private applyPreset() {
    if (this.filter) this.filter.frequency.value = this.mode().bright;
    this.syncRain();
  }

  /** Start (or keep) playing if the Music setting is on. Call from a user gesture the first time. */
  start() {
    if (!save.settings.music || this.timer) return;
    const ctx = audioContext();
    if (!ctx) return;
    if (!this.out) this.build(ctx);
    this.out!.gain.cancelScheduledValues(ctx.currentTime);
    this.out!.gain.setTargetAtTime(this.ducked ? 0 : 0.16, ctx.currentTime, 0.8);
    this.nextAt = ctx.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 100);
    this.syncRain();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.syncRain();
    const ctx = audioContext();
    if (ctx && this.out) this.out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  }

  /** Fade out while an ad plays (and back in afterwards). */
  duck(on: boolean) {
    this.ducked = on;
    const ctx = audioContext();
    if (ctx && this.out) this.out.gain.setTargetAtTime(on ? 0 : save.settings.music ? 0.16 : 0, ctx.currentTime, 0.3);
  }

  refresh() {
    if (save.settings.music) this.start();
    else this.stop();
  }

  private build(ctx: AudioContext) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = MODES[this.season].bright;
    // A soft echo gives the plucks some room.
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    this.filter.connect(this.out);
    this.filter.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.out);
    this.out.connect(ctx.destination);
  }

  private schedule() {
    const ctx = audioContext();
    if (!ctx || !this.filter) return;
    const mode = this.mode();
    const voice = this.active().voice;
    while (this.nextAt < ctx.currentTime + 0.3) {
      const t = this.nextAt;
      // Drone: a fifth that swells every 16 steps.
      if (this.step % 16 === 0) {
        this.pad(ctx, hz(mode.root), t, (mode.stepMs * 16) / 1000);
        this.pad(ctx, hz(mode.root + 7), t + 0.4, (mode.stepMs * 14) / 1000);
      }
      if (Math.random() < mode.density) {
        // Random walk on the scale, nudged back toward the middle.
        const pull = this.walk > 6 ? -1 : this.walk < 2 ? 1 : 0;
        this.walk = Math.max(0, Math.min(mode.notes.length - 1, this.walk + pull + Math.round((Math.random() - 0.5) * 3)));
        const accent = this.step % 8 === 0 ? 1 : 0.7;
        if (voice === 'pluck') this.pluck(ctx, hz(mode.notes[this.walk]), t, accent);
        else this.voice(ctx, voice, hz(mode.notes[this.walk]), t, accent, mode.stepMs / 1000);
        // Sometimes a soft grace note a scale step above.
        if (voice === 'pluck' && Math.random() < 0.12 && this.walk < mode.notes.length - 1) this.pluck(ctx, hz(mode.notes[this.walk + 1]), t + 0.09, 0.4);
        else if ((voice === 'zither' || voice === 'koto') && Math.random() < 0.12 && this.walk < mode.notes.length - 1)
          this.voice(ctx, voice, hz(mode.notes[this.walk + 1]), t + 0.09, 0.4, mode.stepMs / 1000);
      }
      // Rain: the odd drop on the eaves.
      if (this.rain && Math.random() < 0.3) this.drop(ctx, t + Math.random() * (mode.stepMs / 1000));
      this.step++;
      this.nextAt += mode.stepMs / 1000;
    }
  }

  private pluck(ctx: AudioContext, f: number, t: number, vol: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    for (const [mult, type, v] of [[1, 'triangle', 1], [2.003, 'sine', 0.35], [3.01, 'sine', 0.12]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * mult, t);
      const og = ctx.createGain();
      og.gain.value = v;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 1.9);
    }
    g.connect(this.filter!);
  }

  /** Preset instruments (the default pluck above is untouched). */
  private voice(ctx: AudioContext, kind: Preset['voice'], f: number, t: number, vol: number, step: number) {
    const g = ctx.createGain();
    const parts: [number, OscillatorType, number][] =
      kind === 'zither'
        ? [[1, 'triangle', 1], [2, 'sine', 0.42], [3.002, 'sine', 0.16], [4.01, 'sine', 0.05]]
        : kind === 'koto'
          ? [[1, 'triangle', 0.9], [2.005, 'sine', 0.5], [3.01, 'sine', 0.28], [5.02, 'sine', 0.08]]
          : kind === 'flute'
            ? [[1, 'sine', 1], [2, 'sine', 0.16], [3, 'sine', 0.04]]
            : [[1, 'sine', 1], [2.76, 'sine', 0.32], [5.4, 'sine', 0.12], [8.93, 'sine', 0.04]];
    let end: number;
    if (kind === 'flute') {
      // Slow breath in, a long held note, then a soft release.
      const hold = Math.min(2.6, step * (1.6 + Math.random() * 1.2));
      end = t + hold + 0.6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * vol, t + 0.16);
      g.gain.setTargetAtTime(0.15 * vol, t + 0.2, 0.4);
      g.gain.setTargetAtTime(0.0001, t + hold, 0.18);
      this.breath(ctx, t, 0.22, 0.05 * vol);
    } else {
      const decay = kind === 'bell' ? 3.4 : kind === 'koto' ? 1.3 : 1.7;
      end = t + decay + 0.1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((kind === 'bell' ? 0.22 : 0.3) * vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    }
    // Zither notes sometimes bend up and sigh back (nonghyeon); the flute sways.
    const bend = kind === 'zither' && Math.random() < 0.3;
    const sway = kind === 'flute' || (kind === 'zither' && !bend && Math.random() < 0.5);
    for (const [mult, type, v] of parts) {
      const o = ctx.createOscillator();
      o.type = type;
      const fm = f * mult;
      o.frequency.setValueAtTime(fm, t);
      if (bend) {
        o.frequency.setValueAtTime(fm, t + 0.18);
        o.frequency.linearRampToValueAtTime(fm * 1.059, t + 0.42);
        o.frequency.linearRampToValueAtTime(fm, t + 0.8);
      } else if (sway) {
        const n = 24;
        const curve = new Float32Array(n);
        const depth = kind === 'flute' ? 0.006 : 0.01;
        for (let i = 0; i < n; i++) curve[i] = fm * (1 + depth * Math.sin((i / (n - 1)) * Math.PI * 6) * (i / (n - 1)));
        o.frequency.setValueCurveAtTime(curve, t + 0.3, Math.max(0.4, end - t - 0.4));
      }
      const og = ctx.createGain();
      // Higher bell partials fade first, like struck metal.
      if (kind === 'bell' && mult > 1) {
        og.gain.setValueAtTime(v, t);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 3.4 / mult);
      } else og.gain.value = v;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(end);
    }
    g.connect(this.filter!);
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      // Brown-ish noise: softer than white, like rain on a roof.
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.2;
      }
    }
    return this.noiseBuf;
  }

  /** A puff of breath noise at the start of a flute note. */
  private breath(ctx: AudioContext, t: number, dur: number, vol: number) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 6, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.filter!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** One raindrop: a tiny high tick. */
  private drop(ctx: AudioContext, t: number) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2200 + Math.random() * 2400, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.018 + Math.random() * 0.02, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + 0.07);
  }

  /** Start or stop the rain bed to match the active preset. */
  private syncRain() {
    const want = !!this.timer && !!this.active().rain;
    if (!want && !this.rain) return;
    const ctx = audioContext();
    if (!ctx || !this.out) return;
    if (want && !this.rain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise(ctx);
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 260;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(0.32, ctx.currentTime, 0.6);
      src.connect(lp).connect(hp).connect(gain).connect(this.out);
      src.start();
      this.rain = { src, gain };
    } else if (!want && this.rain) {
      const r = this.rain;
      this.rain = null;
      r.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
      r.src.stop(ctx.currentTime + 1.2);
    }
  }

  private pad(ctx: AudioContext, f: number, t: number, dur: number) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.filter!);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

export const music = new Music();
