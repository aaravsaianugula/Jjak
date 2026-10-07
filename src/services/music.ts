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

class Music {
  private season = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextAt = 0;
  private step = 0;
  private walk = 4;
  private out: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private ducked = false;

  setSeason(season: number) {
    this.season = ((season % 4) + 4) % 4;
    if (this.filter) this.filter.frequency.value = MODES[this.season].bright;
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
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
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
    const mode = MODES[this.season];
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
        this.pluck(ctx, hz(mode.notes[this.walk]), t, accent);
        // Sometimes a soft grace note a scale step above.
        if (Math.random() < 0.12 && this.walk < mode.notes.length - 1) this.pluck(ctx, hz(mode.notes[this.walk + 1]), t + 0.09, 0.4);
      }
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
