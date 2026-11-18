/**
 * Teacher voice for the single-file build: the browser's own text-to-speech (Web Speech API),
 * free and offline-capable, no server needed.
 * Works around the usual browser quirks:
 *   - long lines stop after ~15 s in Chrome: text is spoken sentence by sentence
 *   - `onend` sometimes never fires: every sentence has a watchdog timer
 *   - voices load late: the list is refreshed on `voiceschanged`
 *   - no voices at all (some Linux / headless browsers): lines are "spoken" silently on a timer,
 *     so the game clock never gets stuck
 */
export type Gender = 'f' | 'm';

const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const VOICE_KEY = 'live-class-en:voice';
const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|zira|aria|jenny|ana\b|emma|libby|sonia|susan|hazel|serena|allison|ava|nicky|joanna|salli|kendra|kimberly|ivy|google us english|google uk english female|natasha|clara|michelle|sara/i;
const MALE = /\bmale|man\b|daniel|alex\b|fred|david|mark|guy|ryan|george|james|tom\b|aaron|arthur|oliver|rishi|lee\b|matthew|joey|justin|brian|eric|christopher|roger|steffan|thomas|google uk english male/i;

let voices: SpeechSynthesisVoice[] = [];
function refresh() {
  if (!synth) return;
  try {
    voices = synth.getVoices();
  } catch {
    voices = [];
  }
}
refresh();
synth?.addEventListener?.('voiceschanged', refresh);

export const speechAvailable = () => !!synth && voices.length > 0;
export const englishVoices = () => {
  refresh();
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  return (en.length ? en : voices).slice().sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
};

/** voice chosen in the panel (by name), per gender */
export function chosenVoice(g: Gender) {
  try {
    return localStorage.getItem(`${VOICE_KEY}:${g}`) || '';
  } catch {
    return '';
  }
}
export function chooseVoice(g: Gender, name: string) {
  try {
    localStorage.setItem(`${VOICE_KEY}:${g}`, name);
  } catch {
    // ignore
  }
}

function pick(g: Gender): SpeechSynthesisVoice | null {
  const list = englishVoices();
  if (!list.length) return null;
  const want = chosenVoice(g);
  const named = want && list.find((v) => v.name === want);
  if (named) return named;
  const re = g === 'f' ? FEMALE : MALE;
  const us = (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang);
  return (
    list.find((v) => re.test(v.name) && us(v) && /natural|neural|online/i.test(v.name)) ??
    list.find((v) => re.test(v.name) && us(v)) ??
    list.find((v) => re.test(v.name)) ??
    list.find(us) ??
    list[0]
  );
}

// keep a reference to the utterance that is speaking: Chrome may garbage-collect it and never fire onend
let speaking: SpeechSynthesisUtterance | null = null;
let cancelled = 0;

/** split into short sentences (keeps Chrome from cutting long lines off) */
export function sentences(text: string): string[] {
  const out: string[] = [];
  // never split after a title ("Ms. Ngan", "Mr. Minh"): keep the space as a marker, restore it after splitting
  const KEEP = '\u0007';
  const prepared = text.replace(/\s+/g, ' ').trim().replace(/\b(Mr|Ms|Mrs|Dr|St)\. /g, `$1.${KEEP}`);
  // split after . ! ? followed by a space. No regex lookbehind here: iPhones before iOS 16.4 reject it and the whole script would fail
  for (let part of prepared.replace(/([.!?]) +/g, `$1${KEEP}${KEEP}`).split(KEEP + KEEP)) {
    part = part.split(KEEP).join(' ');
    if (part.length <= 180) {
      if (part) out.push(part);
      continue;
    }
    let rest = part;
    while (rest.length > 180) {
      let cut = rest.lastIndexOf(', ', 180);
      if (cut < 60) cut = rest.lastIndexOf(' ', 180);
      if (cut < 30) cut = 180;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  // join short sentences back together (fewer gaps between utterances), up to ~160 characters each
  const merged: string[] = [];
  for (const p of out) {
    const last = merged[merged.length - 1];
    if (last && last.length + p.length < 160) merged[merged.length - 1] = `${last} ${p}`;
    else merged.push(p);
  }
  return merged;
}

/** rough reading time of a line at a given rate (used when there is no voice and as a watchdog) */
export const estimateMs = (text: string, rate: number) => Math.max(600, (text.length / 15) * 1000 / Math.max(0.5, rate));

/** Speak one line. Resolves when it is done (or cut by stop()). */
export async function speak(text: string, opts: { gender: Gender; rate: number; volume: number; hype?: boolean; onStart?: () => void }) {
  const myCancel = cancelled;
  const clean = text.replace(/\[[^\]]*\]\s*/g, '').trim();
  if (!clean) return;
  opts.onStart?.();
  const voice = pick(opts.gender);
  if (!synth || !voice || opts.volume <= 0) {
    // silent mode: wait about as long as reading would take, so the show keeps its rhythm
    await new Promise((r) => setTimeout(r, estimateMs(clean, opts.rate) * 0.8));
    return;
  }
  for (const s of sentences(clean)) {
    if (cancelled !== myCancel) return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(s);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = Math.min(2, Math.max(0.5, opts.rate * (opts.hype ? 1.06 : 1)));
      u.pitch = opts.hype ? 1.15 : opts.gender === 'f' ? 1.05 : 0.95;
      u.volume = Math.min(1, Math.max(0, opts.volume));
      let over = false;
      const finish = () => {
        if (over) return;
        over = true;
        clearTimeout(guard);
        clearTimeout(startGuard);
        if (speaking === u) speaking = null;
        resolve();
      };
      // watchdogs: never started (blocked) -> skip after 4 s; started -> cut at 2x the expected length
      const guard = setTimeout(finish, estimateMs(s, u.rate) * 2.2 + 4000);
      const startGuard = setTimeout(() => {
        if (!synth.speaking && !synth.pending) finish();
      }, 4000);
      u.onend = finish;
      u.onerror = finish;
      speaking = u;
      try {
        synth.speak(u);
        // Chrome sometimes leaves the queue paused after a tab switch
        if (synth.paused) synth.resume();
      } catch {
        finish();
      }
    });
  }
}

export function stopSpeech() {
  cancelled++;
  speaking = null;
  try {
    synth?.cancel();
  } catch {
    // ignore
  }
}

/** Call inside a click handler: unlocks speech on browsers that need a user gesture (iOS, Chrome) */
export function unlockSpeech() {
  if (!synth) return;
  try {
    refresh();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  } catch {
    // ignore
  }
}
