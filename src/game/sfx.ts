import type { StageView } from './useGame';

/**
 * Sound effects, played only on the stage page. By default the browser synthesises every sound (no files, no copyright worries).
 * Want nicer sounds? Drop an mp3 with the same name into public/assets/sfx/ (e.g. ting.mp3) and the game uses the file instead.
 * ting    someone answered right
 * drum    school drum, class starts
 * go      the teacher says go, the letter board appears
 * tick    ticking in the last 5 seconds
 * bell    time is up, the answer shows
 * pop     a gift drops onto a desk
 * clap    the whole class claps
 * fanfare mid-class prizes, birthdays
 * whoosh  big shows: swoosh when a new part starts
 * boom    big shows: the teacher says go, the music "drops"
 * chime   Golden Bell: little bells
 * gong    Golden Bell: the big bell rings out when the answer shows
 * The EDM background music of the big shows is synthesised too (music()), quieter than the teacher's voice.
 */
export type SfxName = 'ting' | 'drum' | 'go' | 'tick' | 'bell' | 'pop' | 'clap' | 'fanfare' | 'whoosh' | 'boom' | 'chime' | 'gong';
const NAMES: SfxName[] = ['ting', 'drum', 'go', 'tick', 'bell', 'pop', 'clap', 'fanfare', 'whoosh', 'boom', 'chime', 'gong'];

/** Background music of the big shows: Everest 128 BPM in A minor, Golden Bell 140 BPM in D minor. Each cell is one 1/16 note */
const TRACKS = {
  everest: { bpm: 128, chords: [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]] },
  nhay: { bpm: 124, chords: [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]] }, // dance break at recess
  chuong: { bpm: 140, chords: [[293.7, 349.2, 440], [233.1, 293.7, 349.2], [174.6, 220, 261.6], [261.6, 329.6, 392]] },
} as const;

class Sfx {
  volume = 0.35; // quieter than the teacher so it never drowns her out
  // ---------- EDM background music ----------
  private track: keyof typeof TRACKS | null = null;
  /** 0: teacher talking (music backs off, kick + pad only) · 1: waiting for answers (full beat) · 2: last 5 seconds (rush + drum roll) */
  private level = 0;
  private musicOut: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextAt = 0;
  private step = 0;

  /** Called every game tick: start / stop / change the intensity of the big-show music */
  music(track: keyof typeof TRACKS | null, level: number) {
    if (this.volume <= 0) track = null;
    this.level = level;
    if (track === this.track) {
      if (this.musicOut && this.ctx) this.musicOut.gain.setTargetAtTime(this.volume * (level === 0 ? 0.35 : 0.75), this.ctx.currentTime, 0.15);
      return;
    }
    this.track = track;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicOut && this.ctx) {
      const old = this.musicOut;
      old.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
      setTimeout(() => old.disconnect(), 1500);
    }
    this.musicOut = null;
    if (!track) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      const out = this.ctx.createGain();
      out.gain.value = 0.0001;
      out.gain.setTargetAtTime(this.volume * 0.35, this.ctx.currentTime, 0.4);
      out.connect(this.ctx.destination);
      this.musicOut = out;
      this.nextAt = this.ctx.currentTime + 0.1;
      this.step = 0;
      this.musicTimer = setInterval(() => this.schedule(), 25);
    } catch {
      // the browser blocks audio: skip
    }
  }

  private schedule() {
    const c = this.ctx;
    const out = this.musicOut;
    if (!c || !out || !this.track) return;
    const tr = TRACKS[this.track];
    const sixteenth = 60 / tr.bpm / 4;
    while (this.nextAt < c.currentTime + 0.12) {
      beat(c, out, tr.chords[Math.floor(this.step / 16) % 4], this.step % 16, this.nextAt, sixteenth, this.level);
      this.nextAt += sixteenth;
      this.step++;
    }
  }
  private ctx: AudioContext | null = null;
  private files: Partial<Record<SfxName, HTMLAudioElement>> = {};
  private lastAt: Partial<Record<SfxName, number>> = {};

  /** Call inside a click/tap: browsers only start audio after a user gesture */
  unlock() {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // no Web Audio: no sound effects
    }
  }

  /** Try the channel owner's own mp3 first; no file means the synthesised sound */
  loadFiles() {
    for (const n of NAMES) {
      const a = new Audio(`/assets/sfx/${n}.mp3`);
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => (this.files[n] = a), { once: true });
    }
  }

  play(name: SfxName, minGapMs = 80) {
    if (this.volume <= 0) return;
    const now = performance.now();
    if (now - (this.lastAt[name] ?? -Infinity) < minGapMs) return;
    this.lastAt[name] = now;
    const file = this.files[name];
    if (file) {
      const a = file.cloneNode() as HTMLAudioElement;
      a.volume = Math.min(1, this.volume * 2);
      void a.play().catch(() => {});
      return;
    }
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      SYNTH[name](this.ctx, this.volume);
    } catch {
      // the browser blocks audio: skip
    }
  }

  // ---------- automatic sounds from the game state ----------
  private lastTick = -1;
  private lastGiftAt = -1;

  /** Called every game tick: ticking in the last 5 seconds while waiting for answers */
  clock(phase: string, boardShown: boolean, endsAt: number, now: number) {
    const left = Math.ceil((endsAt - now) / 1000);
    const asking = (phase === 'question' && boardShown) || phase === 'bonus';
    if (!asking || left > 5 || left < 1) {
      this.lastTick = -1;
      return;
    }
    if (left !== this.lastTick) {
      this.lastTick = left;
      this.play('tick', 0);
    }
  }

  /** Compare the previous and the new snapshot to play sounds at the right moment */
  watch(prev: StageView | null, next: StageView) {
    const giftAt = Math.max(0, ...next.seats.flatMap((s) => s.desk.map((g) => g.at)));
    if (!prev) {
      this.lastGiftAt = giftAt; // page just opened: old gifts stay silent
      return;
    }
    if (next.phase === 'intro' && prev.phase !== 'intro') this.play('drum');
    if (next.phase === 'question' && next.boardShown && !(prev.phase === 'question' && prev.boardShown && prev.qNo === next.qNo)) this.play('go');
    if (next.qNo === prev.qNo && next.correctCount > prev.correctCount) this.play('ting', 150);
    if (next.phase === 'reveal' && prev.phase !== 'reveal') this.play('bell');
    if (giftAt > this.lastGiftAt) this.play('pop');
    this.lastGiftAt = Math.max(this.lastGiftAt, giftAt);
    if (next.clapping && !prev.clapping) this.play('clap');
    if ((next.phase === 'praise' && prev.phase !== 'praise') || (next.birthday && next.birthday.at !== prev.birthday?.at)) this.play('fanfare', 500);
    // big shows
    const a = prev.show;
    const b = next.show;
    if (!b) return;
    const moved = !a || a.step !== b.step || a.qNo !== b.qNo || a.section !== b.section;
    if (moved && (b.step === 'gather' || b.step === 'section')) this.play('whoosh', 300);
    if (b.stage === 'ask' && next.boardShown && !(a?.stage === 'ask' && prev.boardShown && !moved)) this.play('boom', 300);
    if (b.stage === 'reveal' && a?.stage !== 'reveal' && b.step === 'mc') {
      if (b.kind === 'chuong') this.play(b.lastRight > 0 ? 'chime' : 'gong', 300);
      else this.play(b.lastRight > 0 ? 'ting' : 'bell', 300);
    }
    if (b.step === 'honor' && a?.step !== 'honor') {
      this.play('fanfare', 500);
      if (b.kind === 'chuong') this.play('chime', 300);
    }
  }
}

/** One 1/16 step of the EDM music: four-on-the-floor kick, clap on 2 and 4, hi-hat, bouncy bass, synth arp, chord pad */
function beat(c: AudioContext, out: GainNode, chord: readonly number[], pos: number, t: number, len: number, level: number) {
  // kick: while the teacher talks only half the beats, so the voice stays clear
  if (level === 0 ? pos % 8 === 0 : pos % 4 === 0) toneAt(c, out, 'sine', 150, t, 0.28, 1, 42);
  if (level === 0) {
    if (pos === 0) chord.forEach((f) => toneAt(c, out, 'triangle', f, t, len * 15, 0.07));
    return;
  }
  if (pos === 4 || pos === 12) noiseAt(c, out, t, 0.13, 0.5, 'bandpass', 1600);
  if (pos % 4 === 2 || level === 2) noiseAt(c, out, t, pos % 4 === 2 ? 0.07 : 0.03, level === 2 ? 0.28 : 0.22, 'highpass', 8000);
  // bass bounces between the kicks ("pumping")
  if (pos % 4 === 2) toneAt(c, out, 'sawtooth', chord[0] / 2, t, len * 1.6, 0.35, undefined, 500);
  // arp: up and down the chord, one octave higher
  if (pos % 2 === 0) toneAt(c, out, 'square', chord[[0, 1, 2, 1][(pos / 2) % 4]] * 2, t, len * 0.9, 0.09, undefined, 2600);
  // last 5 seconds: drum roll + a riser at the start of each bar
  if (level === 2) {
    noiseAt(c, out, t, 0.06, 0.18 + (pos / 16) * 0.3, 'bandpass', 2500);
    if (pos === 0) riser(c, out, t, len * 16);
  }
}

/** Scheduled note (absolute time) on the music bus; `lowpass` takes off the harsh top */
function toneAt(c: AudioContext, out: AudioNode, type: OscillatorType, freq: number, t: number, dur: number, gain: number, slideTo?: number, lowpass?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = o;
  if (lowpass) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    node = o.connect(f);
  }
  node.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseAt(c: AudioContext, out: AudioNode, t: number, dur: number, gain: number, type: BiquadFilterType, freq: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

/** Riser (noise swept through a filter from low to high) */
function riser(c: AudioContext, out: AudioNode, t: number, dur: number, gain = 0.25) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 4;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(6000, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

// ---------- synthesised sounds ----------
type Synth = (ctx: AudioContext, vol: number) => void;

/** One note: wave, frequency, start (seconds), length, loudness */
function tone(ctx: AudioContext, vol: number, type: OscillatorType, freq: number, start: number, dur: number, gain = 1, slideTo?: number) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Noise burst (claps, drum skin) */
function noise(ctx: AudioContext, vol: number, start: number, dur: number, gain = 1, filterFreq = 1500) {
  const t = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

const SYNTH: Record<SfxName, Synth> = {
  // two bright high notes
  ting: (c, v) => {
    tone(c, v, 'sine', 1319, 0, 0.25, 0.6);
    tone(c, v, 'sine', 1760, 0.07, 0.35, 0.5);
  },
  // school drum "boom boom boom"
  drum: (c, v) => {
    for (const s of [0, 0.32, 0.64]) {
      tone(c, v, 'sine', 110, s, 0.45, 1.4, 55);
      noise(c, v, s, 0.12, 0.4, 300);
    }
  },
  // "ting ting" going up: start
  go: (c, v) => {
    tone(c, v, 'triangle', 784, 0, 0.15, 0.7);
    tone(c, v, 'triangle', 1175, 0.12, 0.3, 0.7);
  },
  tick: (c, v) => tone(c, v, 'square', 1000, 0, 0.05, 0.25),
  // time-up bell
  bell: (c, v) => {
    tone(c, v, 'sine', 880, 0, 0.9, 0.6);
    tone(c, v, 'sine', 1320, 0, 0.6, 0.25);
  },
  // "pop" of a gift landing on a desk
  pop: (c, v) => tone(c, v, 'sine', 600, 0, 0.16, 0.9, 1400),
  // patter of applause
  clap: (c, v) => {
    for (let i = 0; i < 14; i++) noise(c, v, i * 0.09 + Math.random() * 0.04, 0.08, 0.5, 1200 + Math.random() * 800);
  },
  // little fanfare "ta-ta-ta-taaa"
  fanfare: (c, v) => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(c, v, 'triangle', f, i * 0.13, i === 3 ? 0.6 : 0.16, 0.6));
  },
  // 1-second riser
  whoosh: (c, v) => riser(c, c.destination, c.currentTime, 1, v * 0.9),
  // "boom": falling sub bass + noise, like a music drop
  boom: (c, v) => {
    tone(c, v, 'sine', 120, 0, 0.7, 1.6, 30);
    noise(c, v, 0, 0.35, 0.6, 200);
    tone(c, v, 'sawtooth', 880, 0, 0.25, 0.25, 220);
  },
  // little bell rings 6 times
  chime: (c, v) => {
    for (let i = 0; i < 6; i++) {
      tone(c, v, 'sine', 1568, i * 0.14, 0.5, 0.45);
      tone(c, v, 'sine', 2350, i * 0.14 + 0.01, 0.35, 0.2);
    }
  },
  // big bell ringing out: many inharmonic frequencies, like metal
  gong: (c, v) => {
    for (const [f, g] of [[196, 1], [420, 0.6], [655, 0.45], [987, 0.3]] as const) tone(c, v, 'sine', f, 0, 2.2, g * 0.7);
  },
};

export const sfx = new Sfx();
