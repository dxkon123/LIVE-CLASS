/**
 * In-browser stand-in for server.ts, used by the single-file HTML build (no Node server, no TikTok).
 * Same routes and the same answers as server.ts, but the "class book" lives in localStorage:
 *   - which questions were asked and when (so a new class does not repeat them soon)
 *   - weekly / daily scores, attendance streaks, lifetime report card, flower fund
 * Events (chat, gift, like, control, roomCfg...) go through a tiny in-page bus.
 */
import { setLocalServer } from '../live/api';
import { GAME } from '../game/config';

type Book = Record<string, { nickname: string; points: number }>;
type LifeRow = { nickname: string; points: number; total: number; toan: number; su: number; meo: number; anh: number };
const LIFE_KEYS = ['points', 'total', 'toan', 'su', 'meo', 'anh'] as const;
interface SoLop {
  used: Record<string, number>;
  week: string;
  scores: Book;
  banned: Record<string, { answer: string; clue: string; at: number }>;
  attend: Record<string, { nickname: string; last: string; streak: number; total: number }>;
  today: { date: string; scores: Book; talk?: Book; flowers?: number };
  life: Record<string, LifeRow>;
}

const KEY = 'live-class-en:book';
const SETTINGS_KEY = 'live-class-en:settings';
const BG_KEY = 'live-class-en:bg';

const dayKey = (d = new Date()) => d.toLocaleDateString('sv');
const weekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
};
const safeKey = (k: string) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked (private mode): keep playing, just do not remember
  }
}

let soLop: SoLop = load<SoLop>(KEY, { used: {}, week: weekKey(), scores: {}, banned: {}, attend: {}, today: { date: dayKey(), scores: {} }, life: {} });
// keep the book small: forget questions asked more than 60 days ago
{
  const cut = Date.now() - 60 * 86_400_000;
  for (const [id, at] of Object.entries(soLop.used)) if (at < cut) delete soLop.used[id];
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const saveSoon = () => {
  saveTimer ??= setTimeout(() => {
    saveTimer = null;
    store(KEY, soLop);
  }, 1500);
};

interface Settings {
  channelName?: string;
  rate?: string;
  room?: Record<string, unknown>;
}
let settings: Settings = load<Settings>(SETTINGS_KEY, {});
const saveSettings = (patch: Settings) => {
  settings = { ...settings, ...patch };
  store(SETTINGS_KEY, settings);
};
// custom classroom background (data URL) is kept separately: it can be big
let roomBg = '';
try {
  roomBg = localStorage.getItem(BG_KEY) || '';
} catch {
  roomBg = '';
}

const weekTop = () => {
  if (soLop.week !== weekKey()) soLop = { ...soLop, week: weekKey(), scores: {} };
  return topOf(soLop.scores);
};
const todayScores = () => {
  if (soLop.today.date !== dayKey()) soLop.today = { date: dayKey(), scores: {}, talk: {}, flowers: 0 };
  return soLop.today.scores;
};
const todayTalk = () => {
  todayScores();
  return (soLop.today.talk ??= {});
};
const topOf = (book: Book) =>
  Object.entries(book)
    .map(([username, v]) => ({ username, ...v }))
    .sort((x, y) => y.points - x.points)
    .slice(0, 10);
const addScore = (book: Book, key: string, nickname: unknown, points: number) => {
  const cur = has(book, key) ? book[key] : { nickname: '', points: 0 };
  cur.nickname = String(nickname || cur.nickname).slice(0, 60);
  cur.points += points;
  book[key] = cur;
};
const flowersToday = () => {
  todayScores();
  return soLop.today.flowers ?? 0;
};
const lifeOf = (key: string): LifeRow => (has(soLop.life, key) ? soLop.life[key] : { nickname: '', points: 0, total: 0, toan: 0, su: 0, meo: 0, anh: 0 });
const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max);

// ---------- event bus (what server.ts broadcasts over SSE) ----------
type Emit = (name: string, data: unknown) => void;
const clients = new Set<Emit>();
let totalLikes = 0;
const status = () => ({ isConnected: false, isConnecting: false, username: '', roomId: '', viewerCount: 0, totalLikes, offline: true });
export function broadcast(name: string, data: unknown) {
  // asynchronous like a real event stream (handlers never run inside the caller)
  setTimeout(() => {
    for (const c of clients) c(name, data);
  }, 0);
}
const roomCfg = () => ({ ...(settings.room ?? {}), bg: roomBg ? 'local' : '' });

// ---------- routes ----------
async function route(path: string, method: string, body: any): Promise<unknown> {
  const url = new URL(path, 'http://local');
  const p = url.pathname;
  const b = body ?? {};

  if (p === '/api/control' && method === 'POST') {
    const action = String(b.action || '');
    if (!['speak', 'setRate', 'reset', 'setName', 'custom'].includes(action)) return { success: false, error: 'Invalid command' };
    const payload: { action: string; text?: string } = { action, text: typeof b.text === 'string' ? b.text.trim().slice(0, 1000) : undefined };
    if (action === 'speak' && !payload.text) return { success: false, error: 'Type something to read first' };
    if (action === 'setRate' && payload.text) saveSettings({ rate: payload.text });
    if (action === 'setName') {
      const name = cleanText(payload.text, 40);
      if (!name) return { success: false, error: 'Type a channel name first' };
      payload.text = name;
      saveSettings({ channelName: name });
    }
    broadcast('control', payload);
    return { success: true, pages: 1 };
  }

  if (p === '/api/test/emit' && method === 'POST') {
    const type = String(b.type || '');
    if (!['chat', 'gift', 'member', 'follow', 'share', 'like'].includes(type)) return { success: false, error: 'Invalid event type' };
    const event: Record<string, unknown> = { timestamp: Date.now(), avatar: '', ...(b.data || {}) };
    if (event.test === undefined) event.test = true;
    if (type === 'like') {
      totalLikes += Number(event.likeCount) || 1;
      event.totalLikes = totalLikes;
    }
    broadcast(type, event);
    return { success: true };
  }

  if (p === '/api/game/state') return { success: true };
  if (p === '/api/tiktok/status') return { success: true, data: status() };

  if (p === '/api/room-settings' && method === 'GET') return roomCfg();
  if (p === '/api/room-settings' && method === 'POST') {
    const patch: Record<string, unknown> = {};
    if (typeof b.teacherName === 'string') {
      const name = cleanText(b.teacherName, 24);
      if (!name) return { success: false, error: 'Type the teacher name first' };
      patch.teacherName = name;
    }
    if (b.teacherVoice === 'nu' || b.teacherVoice === 'nam') patch.teacherVoice = b.teacherVoice;
    if (typeof b.motto === 'string') {
      const motto = cleanText(b.motto, 40);
      if (!motto) return { success: false, error: 'Type the red banner text first' };
      patch.motto = motto;
    }
    for (const k of ['everest', 'chuong', 'supervisor', 'standWrong'] as const) if (typeof b[k] === 'boolean') patch[k] = b[k];
    if (b.teacher === 'co' || b.teacher === 'thay') patch.teacher = b.teacher;
    if (b.supervisorMin !== undefined) patch.supervisorMin = Math.min(60, Math.max(1, Math.round(Number(b.supervisorMin)) || 4));
    if (b.dance === 'off' || b.dance === 'mix' || b.dance === 'always') patch.dance = b.dance;
    if (b.danceSec !== undefined) patch.danceSec = Math.min(120, Math.max(10, Math.round(Number(b.danceSec)) || 30));
    if (typeof b.danceText === 'string') {
      const t = cleanText(b.danceText, 80);
      if (!t) return { success: false, error: 'Type the dance message first' };
      patch.danceText = t;
    }
    if (typeof b.birthdayText === 'string') {
      const t = cleanText(b.birthdayText, 60);
      if (!t) return { success: false, error: 'Type the birthday banner text first' };
      patch.birthdayText = t;
    }
    saveSettings({ room: { ...(settings.room ?? {}), ...patch } });
    broadcast('roomCfg', roomCfg());
    return { success: true, room: roomCfg() };
  }

  if (p === '/api/room-bg' && method === 'POST') {
    const file = body as Blob;
    if (!(file instanceof Blob) || !/^image\/(png|jpeg|webp)$/.test(file.type)) return { success: false, error: 'PNG, JPG or WEBP images only' };
    const dataUrl = await new Promise<string>((ok, bad) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = () => bad(fr.error);
      fr.readAsDataURL(file);
    });
    roomBg = dataUrl;
    try {
      localStorage.setItem(BG_KEY, dataUrl);
    } catch {
      // too big for storage: works until the page is closed
    }
    broadcast('roomCfg', roomCfg());
    return { success: true, room: roomCfg() };
  }
  if (p === '/api/room-bg' && method === 'DELETE') {
    roomBg = '';
    try {
      localStorage.removeItem(BG_KEY);
    } catch {
      // ignore
    }
    broadcast('roomCfg', roomCfg());
    return { success: true, room: roomCfg() };
  }

  if (p === '/api/game/save' && method === 'GET') {
    return { used: soLop.used, banned: Object.keys(soLop.banned), weekTop: weekTop(), todayTop: topOf(todayScores()), talkTop: topOf(todayTalk()), flowersToday: flowersToday() };
  }
  if (p === '/api/game/save' && method === 'POST') {
    const { used, week, banned, life, talk, flowers } = b;
    if (typeof flowers === 'number' && Number.isFinite(flowers) && flowers > 0) {
      todayScores();
      soLop.today.flowers = (soLop.today.flowers ?? 0) + Math.min(1_000_000, Math.round(flowers));
    }
    if (Array.isArray(life)) {
      for (const e of life.slice(0, 2000)) {
        if (!e || typeof e.username !== 'string') continue;
        const key = e.username.slice(0, 100);
        if (!safeKey(key)) continue;
        const cur = lifeOf(key);
        cur.nickname = String(e.nickname || cur.nickname).slice(0, 60);
        for (const k of LIFE_KEYS) cur[k] += Math.max(0, Math.min(5000, Math.round(Number(e[k]) || 0)));
        soLop.life[key] = cur;
      }
    }
    if (Array.isArray(talk)) {
      for (const e of talk.slice(0, 5000)) {
        if (!e || typeof e.username !== 'string' || !safeKey(e.username.slice(0, 100))) continue;
        addScore(todayTalk(), e.username.slice(0, 100), e.nickname, Math.max(0, Math.min(10_000, Math.round(Number(e.points) || 0))));
      }
    }
    weekTop();
    if (Array.isArray(used)) for (const id of used.slice(0, 500)) if (typeof id === 'string' && safeKey(id)) soLop.used[id.slice(0, 200)] = Date.now();
    if (Array.isArray(week)) {
      for (const e of week.slice(0, 2000)) {
        if (!e || typeof e.username !== 'string' || typeof e.points !== 'number' || !Number.isFinite(e.points)) continue;
        const key = e.username.slice(0, 100);
        if (!safeKey(key)) continue;
        const pts = Math.max(0, Math.min(1000, Math.round(e.points)));
        addScore(soLop.scores, key, e.nickname, pts);
        addScore(todayScores(), key, e.nickname, pts);
      }
    }
    if (Array.isArray(banned)) {
      for (const x of banned.slice(0, 50)) {
        if (!x || typeof x.id !== 'string' || !safeKey(x.id)) continue;
        soLop.banned[x.id.slice(0, 200)] = { answer: String(x.answer ?? '').slice(0, 60), clue: String(x.clue ?? '').slice(0, 300), at: Date.now() };
      }
    }
    // keep the stored book from growing without end: only the 400 most active players of all time
    const lifeKeys = Object.keys(soLop.life);
    if (lifeKeys.length > 400) {
      lifeKeys.sort((a, c) => soLop.life[c].points - soLop.life[a].points);
      for (const k of lifeKeys.slice(400)) delete soLop.life[k];
    }
    store(KEY, soLop);
    return { weekTop: weekTop(), todayTop: topOf(todayScores()), talkTop: topOf(todayTalk()), flowersToday: flowersToday() };
  }

  if (p === '/api/game/attend' && method === 'POST') {
    const username = typeof b.username === 'string' ? b.username.slice(0, 100) : '';
    if (!username || !safeKey(username)) return { days: 0 };
    const today = dayKey();
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    const cur = has(soLop.attend, username) ? soLop.attend[username] : { nickname: '', last: '', streak: 0, total: 0 };
    if (cur.last !== today) {
      cur.streak = cur.last === yesterday ? cur.streak + 1 : 1;
      cur.total++;
      cur.last = today;
    }
    cur.nickname = String(b.nickname || cur.nickname).slice(0, 60);
    soLop.attend[username] = cur;
    saveSoon();
    const { nickname: _n, ...life } = lifeOf(username);
    return { days: cur.streak, total: cur.total, life };
  }

  return { success: false, error: `No such route in offline mode: ${p}` };
}

/** custom background image chosen in the teacher panel (data URL), '' = default classroom */
export const roomBgUrl = () => roomBg;

/** Forget everything stored on this device (scores, asked questions, settings) */
export function clearBook() {
  soLop = { used: {}, week: weekKey(), scores: {}, banned: {}, attend: {}, today: { date: dayKey(), scores: {} }, life: {} };
  store(KEY, soLop);
}

export function installLocalServer() {
  setLocalServer(route, {
    open: (url, emit) => {
      clients.add(emit);
      const isStage = url.includes('stage=');
      // what the real server sends to a page that just connected
      setTimeout(() => {
        emit('status', status());
        if (settings.rate) emit('control', { action: 'setRate', text: settings.rate });
        emit('control', { action: 'setName', text: settings.channelName || GAME.defaultChannelName });
        emit('roomCfg', roomCfg());
        emit('speaker', { id: isStage ? url.split('stage=')[1] : null, count: 1 });
      }, 0);
      return () => clients.delete(emit);
    },
  });
}
