import { IS_STAGE } from './page';
import { STANDALONE } from './env';
import { speak, stopSpeech } from '../standalone/speech';

/**
 * Voice queue. Only plays on the stage page.
 * voice.say('Hi Anna')                  -> goes to the end of the queue
 * voice.say('Thanks for the gift', true) -> priority, jumps to the front (used for gifts)
 * voice.say('Oh wow! | ^Hooray!')        -> "|" splits parts; "^" shouts a little louder
 * voice.say('M: He says | F: She says') -> 2 hosts: "M:" male voice, "F:" female voice (until changed)
 * voice.say('F: The answer is | E: cat') -> "E:" English voice, for the English word itself
 * Lines that wait too long (default 60 s) are dropped so old news is never read.
 */
interface Line {
  text: string;
  at: number;
  done?: () => void;
  start?: () => void; // called when the line starts (so the camera can pan to whoever is mentioned)
  valid?: () => boolean; // returning false when its turn comes drops the line (old news)
  keep?: boolean; // never dropped however long it waits (long opening speech)
}

// M male, F female, E English (the teacher reading an English word)
type Who = 'M' | 'F' | 'E';

const MAX_WAIT_MS = 60_000;
const MAX_QUEUE = 30;

class Voice {
  private normal: Line[] = [];
  private priority: Line[] = [];
  private playing = false;
  private current: HTMLAudioElement | null = null;
  private lastSpokeAt = Date.now();
  rate = readRate(); // default 1.25: fast host pace (owner's choice); adjustable on the control page
  volume = 1;
  enabled = IS_STAGE;
  /** teacher voice picked on the control page: 'f' female (Jenny), 'm' male (Guy) */
  teacher: 'f' | 'm' = 'f';
  /** reports which host is talking (so the host character can bounce) */
  onSpeaker?: (who: 'M' | 'F' | null) => void;

  /** `done`: called when the line finished, was dropped, or this page does not play sound */
  say(text: string, priority = false, done?: () => void, keep = false, start?: () => void, valid?: () => boolean) {
    if (!this.enabled || !text.trim()) {
      if (start) setTimeout(start, 0);
      if (done) setTimeout(done, 0);
      return;
    }
    const q = priority ? this.priority : this.normal;
    q.push({ text: text.trim(), at: Date.now(), done, keep, start, valid });
    // priority line: start making the audio as soon as it is queued so it plays without waiting for the server
    if (priority && !STANDALONE) for (const p of this.parts(text)) fetch(this.urlOf(p)).catch(() => {});
    if (q.length > MAX_QUEUE) q.shift()?.done?.();
    void this.next();
  }

  private stops = 0;
  stop() {
    this.stops++;
    for (const l of [...this.normal, ...this.priority]) l.done?.();
    this.normal = [];
    this.priority = [];
    this.current?.pause();
    this.current = null;
    if (STANDALONE) stopSpeech();
    this.playing = false;
    this.lastSpokeAt = Date.now();
    this.onSpeaker?.(null);
  }

  get busy() {
    return this.playing || this.normal.length + this.priority.length > 0;
  }

  /** Ordinary lines waiting (not counting the one being read) */
  get waiting() {
    return this.normal.length;
  }

  /** Priority (gift) lines waiting */
  get waitingPriority() {
    return this.priority.length;
  }

  /** How long the voice has been silent (0 while reading or with lines waiting) */
  quietForMs(now = Date.now()) {
    return this.busy ? 0 : now - this.lastSpokeAt;
  }

  // "M: Oh wow! | ^Hooray!" -> parts: who talks (M male, F female), shouted or not
  private parts(text: string) {
    // LIVE-CLASS: only the teacher talks, so a line without "M:"/"F:" (e.g. typed by the owner) is the female voice too (2026-11-04)
    let who: Who = 'F';
    const out: { who: Who; hype: boolean; text: string }[] = [];
    for (let raw of text.split('|')) {
      raw = raw.trim();
      const sp = /^(M|F|E):\s*/.exec(raw);
      if (sp) {
        who = sp[1] as Who;
        raw = raw.slice(sp[0].length);
      }
      const t = raw.replace(/^\^+/, '');
      if (t) out.push({ who, hype: raw.startsWith('^'), text: t });
    }
    return out;
  }

  private urlOf(p: { who: Who; hype: boolean; text: string }) {
    // male teacher / male voice: English words in the male voice too
    const v = p.who === 'F' ? `&v=${this.teacher}` : p.who === 'E' ? (this.teacher === 'm' ? '&v=enm' : '&v=en') : '';
    return `/api/tts?rate=${this.rate}${p.hype ? '&hype=1' : ''}${v}&text=${encodeURIComponent(p.text)}`;
  }

  private async next() {
    if (this.playing) return;
    const now = Date.now();
    let line: Line | undefined;
    while ((line = this.priority.shift() ?? this.normal.shift())) {
      if (line.valid && !line.valid()) {
        line.done?.();
        continue;
      }
      if (line.keep || now - line.at < MAX_WAIT_MS) break;
      line.done?.();
    }
    if (!line) return;
    this.playing = true;
    line.start?.();
    const stopAt = this.stops;
    try {
      for (const part of this.parts(line.text)) {
        this.onSpeaker?.(part.who === 'E' ? 'F' : part.who); // the English voice is the teacher reading
        if (STANDALONE) {
          // single-file build: the browser's own voice (no server)
          const g = this.teacher === 'm' || part.who === 'M' ? 'm' : 'f';
          await speak(part.text, { gender: g, rate: this.rate, volume: this.volume, hype: part.hype });
          if (this.stops !== stopAt) break; // stop() in the middle
          continue;
        }
        const audio = new Audio(this.urlOf(part));
        audio.volume = this.volume;
        this.current = audio;
        await new Promise<void>((resolve) => {
          // Self-healing: one stuck line (never loads, never errors) would keep the host silent for the whole live.
          // Not playing after 8 s: drop it; while playing: cut it after its length + 4 s.
          // Dropping really cancels (stop loading, no retry): a dropped line used to play when it finished loading,
          // on top of the next line, so two voices talked at once (fixed 2026-11-05)
          let over = false;
          let guard = setTimeout(finish, 8000);
          function finish() {
            if (over) return;
            over = true;
            clearTimeout(guard);
            audio.pause();
            if (!audio.ended) {
              audio.removeAttribute('src');
              audio.load(); // stop loading
            }
            resolve();
          }
          audio.onplaying = () => {
            if (over) {
              audio.pause(); // dropped but it still started: stop it now
              return;
            }
            clearTimeout(guard);
            const ms = Number.isFinite(audio.duration) ? audio.duration * 1000 + 4000 : 40_000;
            guard = setTimeout(finish, ms);
          };
          audio.onended = finish;
          audio.onerror = finish;
          // the browser blocked autoplay: retry a few times instead of dropping (unless the line was dropped)
          const tryPlay = (left: number) => {
            if (over) return;
            audio.play().catch(() => (left > 0 && !over ? setTimeout(() => tryPlay(left - 1), 1500) : finish()));
          };
          tryPlay(4);
        });
        if (this.current !== audio) break; // stop() in the middle
      }
    } finally {
      line.done?.();
      // stop() while this line was speaking: a newer line may already be playing, leave it alone
      // (before: the old line finishing late reset `playing` and started a 2nd voice on top)
      if (this.stops === stopAt) {
        this.onSpeaker?.(null);
        this.current = null;
        this.playing = false;
        this.lastSpokeAt = Date.now();
        void this.next();
      }
    }
  }
}

function readRate() {
  try {
    const r = Number(localStorage.getItem('voice-rate'));
    return r >= 0.5 && r <= 1.5 ? r : 1.0; // normal reading speed (owner 2026-11-04: 1.1 was a bit fast); adjustable on the control page
  } catch {
    return 1.0;
  }
}

export const voice = new Voice();

export { speakableName } from './names';
