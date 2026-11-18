/**
 * Shared server for the TikTok live games. A game normally does NOT need to change this file,
 * unless it needs a new API (add it at the end, under "Game-specific API").
 *
 * - Connects to a TikTok live room (tiktok-live-connector 2.x, proto v3)
 * - Pushes events to the browser over SSE: /api/tiktok/events
 * - Commands from the control page -> stage page: /api/control
 * - Teacher voice: /api/tts (Edge TTS, Google as backup)
 * - Simulated events for testing without going live: /api/test/emit
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3006; // LIVE-CLASS's own port

// Default voice: the teacher's female voice for every line, including lines the owner types for her (owner's call 2026-11-04).
// For a male voice set the environment variable TTS_VOICE=en-US-GuyNeural
// English edition: Microsoft Edge English voices (female Jenny, male Guy). Override with TTS_VOICE=...
const TTS_VOICE = process.env.TTS_VOICE || 'en-US-JennyNeural';
// Teacher voice: a touch higher so it sounds bright
const TTS_PITCH = process.env.TTS_PITCH || '+2%';

// Blocks DNS rebinding: a foreign site pointing its domain at 127.0.0.1 sends a Host/Origin that is not in this list
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'lvh.me']);
const hostOk = (h?: string) => !!h && LOCAL_HOSTS.has(h.replace(/:\d+$/, '').toLowerCase());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!hostOk(req.headers.host) || (origin && !hostOk(origin.replace(/^https?:\/\//, '')))) return res.status(403).end();
  next();
});

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ---------- SSE ----------
interface LiveStats {
  isConnected: boolean;
  isConnecting: boolean;
  username: string;
  roomId: string;
  viewerCount: number;
  totalLikes: number;
  error?: string;
}

const emptyStats = (): LiveStats => ({
  isConnected: false,
  isConnecting: false,
  username: '',
  roomId: '',
  viewerCount: 0,
  totalLikes: 0,
  error: '',
});

let liveStats = emptyStats();
let sseClients: express.Response[] = [];
// Open stage pages (in opening order). Only the LAST one opened plays sound, so two voices never talk over each other
// when LIVE Studio has 2 link sources by mistake or ?view=stage is also open in another browser.
let stageIds: string[] = [];
const announceSpeaker = () => broadcast('speaker', { id: stageIds[stageIds.length - 1] ?? null, count: stageIds.length });
let activeConn: InstanceType<typeof TikTokLiveConnection> | null = null;
let lastRateControl: { action: string; text: string } | null = null;

// Channel name (voice + title) is kept in settings.json next to this file, so it survives a server restart
// SETTINGS_FILE: test runs use another file (e.g. data-test/settings.json) so they never auto-connect to real TikTok or touch the real class settings
const SETTINGS_FILE = process.env.SETTINGS_FILE || path.join(__dirname, 'settings.json');
let lastNameControl: { action: string; text: string } | null = null;
// TikTok account to keep connected: reconnect after a drop, and reconnect on server restart too
let wantUser = '';
// class settings from the control page: teacher name + voice, red banner text, the 2 big shows on/off, own background (missing fields use GAME.defaultRoom)
type RoomSettings = {
  teacherName?: string;
  teacherVoice?: 'nu' | 'nam';
  motto?: string;
  everest?: boolean;
  chuong?: boolean;
  bg?: string;
  teacher?: 'co' | 'thay';
  supervisor?: boolean;
  supervisorMin?: number;
  dance?: 'off' | 'mix' | 'always';
  danceText?: string;
  danceSec?: number;
  birthdayText?: string;
  standWrong?: boolean;
};
let settings: { channelName?: string; tiktokUser?: string; room?: RoomSettings } = {};
try {
  settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  if (typeof settings.channelName === 'string' && settings.channelName.trim()) {
    lastNameControl = { action: 'setName', text: settings.channelName.trim() };
  }
  if (typeof settings.tiktokUser === 'string') wantUser = settings.tiktokUser;
} catch {
  // no name saved yet: use the default name in config.ts
}
const saveSettings = (patch: typeof settings) => {
  settings = { ...settings, ...patch };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Could not save settings.json:', err);
  }
};

function broadcast(eventType: string, data: unknown) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      // browser closed
    }
  }
}

app.get('/api/tiktok/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: status\ndata: ${JSON.stringify(liveStats)}\n\n`);
  if (lastRateControl) res.write(`event: control\ndata: ${JSON.stringify(lastRateControl)}\n\n`);
  if (lastNameControl) res.write(`event: control\ndata: ${JSON.stringify(lastNameControl)}\n\n`);
  res.write(`event: roomCfg\ndata: ${JSON.stringify(settings.room ?? {})}\n\n`);
  sseClients.push(res);
  const stageId = typeof req.query.stage === 'string' ? req.query.stage.slice(0, 40) : '';
  if (stageId) {
    stageIds = [...stageIds.filter((x) => x !== stageId), stageId];
    announceSpeaker();
  } else res.write(`event: speaker\ndata: ${JSON.stringify({ id: stageIds[stageIds.length - 1] ?? null, count: stageIds.length })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c !== res);
    if (stageId) {
      stageIds = stageIds.filter((x) => x !== stageId);
      announceSpeaker();
    }
  });
});

app.get('/api/tiktok/status', (_req, res) => res.json({ success: true, data: liveStats }));

// ---------- Reading TikTok data (proto v3) ----------
const userOf = (data: any) => data?.user?.displayId || data?.user?.uniqueId || data?.uniqueId || 'viewer';
const nickOf = (data: any) => data?.user?.nickname || data?.nickname || data?.uniqueId || 'Friend';
const avatarOf = (data: any) => data?.user?.avatarThumb?.urlList?.[0] || '';

// ---------- Auto reconnect (for all-day lives) ----------
// Dropped / live ended / not live yet: retry after 15 s, then 30, 60, at most every 2 minutes, until it works.
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTries = 0;
function scheduleReconnect(why: string) {
  if (!wantUser || reconnectTimer) return;
  const delay = Math.min(120_000, 15_000 * 2 ** reconnectTries);
  reconnectTries++;
  console.log(`[TikTok] ${why}. Reconnecting @${wantUser} in ${delay / 1000} s`);
  liveStats = { ...liveStats, isConnected: false, isConnecting: false, error: `${why}. Reconnecting in ${delay / 1000} s` };
  broadcast('status', liveStats);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectTikTok(wantUser).catch((err) => scheduleReconnect(`Could not reconnect (${err instanceof Error ? err.message : err})`));
  }, delay);
}
const stopReconnect = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  reconnectTries = 0;
};

app.post('/api/tiktok/connect', async (req, res) => {
  const cleanUser = String(req.body?.username || '').replace(/^@/, '').trim();
  if (!cleanUser) return res.status(400).json({ success: false, error: 'Type a TikTok username first' });
  stopReconnect();
  wantUser = cleanUser;
  saveSettings({ tiktokUser: cleanUser });
  try {
    const state = await connectTikTok(cleanUser);
    return res.json({ success: true, roomId: state?.roomId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    scheduleReconnect(`Could not connect: ${msg}`);
    return res.status(400).json({
      success: false,
      error: `Could not connect to @${cleanUser}: ${msg}. The account must be LIVE on TikTok. The server will keep retrying.`,
    });
  }
});

async function connectTikTok(cleanUser: string) {
  if (activeConn) {
    try {
      activeConn.disconnect();
    } catch {
      // ignore
    }
    activeConn = null;
  }

  liveStats = { ...emptyStats(), isConnecting: true, username: cleanUser };
  broadcast('status', liveStats);

  const conn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    // Fetching the gift list needs a paid Euler Stream plan; gift events already carry the name and diamonds
    enableExtendedGiftInfo: false,
  });

  conn.on(ControlEvent.CONNECTED, (state: { roomId?: string }) => {
    console.log(`[TikTok] Connected to @${cleanUser}, room ${state?.roomId}`);
    liveStats = { ...liveStats, isConnected: true, isConnecting: false, roomId: state?.roomId || '', error: '' };
    newLiveRoom(state?.roomId || '');
    broadcast('status', liveStats);
    reconnectTries = 0;
  });

  // an old connection replaced by a new one does not reconnect (activeConn has changed)
  conn.on(ControlEvent.DISCONNECTED, () => {
    console.log(`[TikTok] Lost connection to @${cleanUser}`);
    if (activeConn !== conn) return;
    liveStats = { ...liveStats, isConnected: false, isConnecting: false };
    broadcast('status', liveStats);
    scheduleReconnect('Lost the TikTok connection');
  });

  conn.on(WebcastEvent.STREAM_END, () => {
    if (activeConn !== conn) return;
    liveStats = { ...liveStats, isConnected: false, isConnecting: false, error: 'The live has ended' };
    broadcast('status', liveStats);
    scheduleReconnect('The live has ended');
  });

  conn.on(WebcastEvent.CHAT, (data: any) => {
    broadcast('chat', {
      username: userOf(data),
      nickname: nickOf(data),
      comment: data?.content || data?.comment || '', // proto v3: the text is in `content`
      avatar: avatarOf(data),
      timestamp: Date.now(),
      // TikTok timestamp of when the viewer sent it (ms): the fastest answer is ranked by this, not by when the bot received it
      // no TikTok timestamp: leave it empty (the stage page uses its own clock and does not measure clock skew from this comment)
      createTime: Number(data?.common?.createTime) || undefined,
    });
  });

  // TikTok resends combo gifts with a growing repeatCount; only pass on the new part
  const streakCounts = new Map<string, number>();
  conn.on(WebcastEvent.GIFT, (data: any) => {
    const username = userOf(data);
    const giftId = data?.giftId || 0;
    const key = `${username}_${giftId}`;
    const total = data?.repeatCount || 1;
    const delta = total - (streakCounts.get(key) || 0);
    const isStreakable = (data?.gift?.type ?? data?.giftDetails?.giftType ?? data?.giftType) === 1;
    if (isStreakable && !data?.repeatEnd) streakCounts.set(key, total);
    else streakCounts.delete(key);
    if (delta <= 0) return;

    broadcast('gift', {
      username,
      nickname: nickOf(data),
      giftName: data?.gift?.name || data?.giftDetails?.giftName || data?.giftName || 'Gift',
      giftId,
      diamondCount: data?.gift?.diamondCount || data?.diamondCount || data?.giftDetails?.diamondCount || 1,
      repeatCount: delta,
      avatar: avatarOf(data),
      timestamp: Date.now(),
    });
  });

  conn.on(WebcastEvent.MEMBER, (data: any) => {
    broadcast('member', { username: userOf(data), nickname: nickOf(data), avatar: avatarOf(data), timestamp: Date.now() });
  });

  conn.on(WebcastEvent.FOLLOW, (data: any) => {
    broadcast('follow', { username: userOf(data), nickname: nickOf(data), avatar: avatarOf(data), timestamp: Date.now() });
  });

  conn.on(WebcastEvent.SHARE, (data: any) => {
    broadcast('share', { username: userOf(data), nickname: nickOf(data), avatar: avatarOf(data), timestamp: Date.now() });
  });

  conn.on(WebcastEvent.ROOM_USER, (data: any) => {
    if (typeof data?.viewerCount === 'number') {
      liveStats.viewerCount = data.viewerCount;
      broadcast('roomUser', { viewerCount: data.viewerCount });
    }
  });

  conn.on(WebcastEvent.LIKE, (data: any) => {
    if (typeof data?.totalLikeCount === 'number') liveStats.totalLikes = data.totalLikeCount;
    broadcast('like', {
      username: userOf(data),
      nickname: nickOf(data),
      likeCount: data?.likeCount || 1,
      totalLikes: liveStats.totalLikes,
    });
  });

  conn.on(ControlEvent.ERROR, (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TikTok] Error @${cleanUser}:`, msg);
    liveStats.error = msg;
    broadcast('status', liveStats);
  });

  activeConn = conn;

  try {
    // Before going LIVE the library can hang on "Connecting" forever: ask TikTok first and report the error at once
    const live = await conn.fetchIsLive().catch(() => true); // the check itself failed: just try to connect
    if (!live) throw new Error('TikTok says this account is NOT live yet. Press Go LIVE in LIVE Studio first, then connect');
    return await Promise.race([
      conn.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('could not enter the live room within 30 seconds')), 30_000)),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    liveStats = { ...liveStats, isConnected: false, isConnecting: false, error: msg };
    broadcast('status', liveStats);
    if (activeConn === conn) {
      try {
        conn.disconnect();
      } catch {
        // ignore
      }
      activeConn = null;
    }
    throw err;
  }
}

app.post('/api/tiktok/disconnect', (_req, res) => {
  // the owner disconnected on purpose: stop reconnecting, also after a server restart
  stopReconnect();
  wantUser = '';
  saveSettings({ tiktokUser: '' });
  try {
    activeConn?.disconnect();
  } catch {
    // ignore
  }
  activeConn = null;
  liveStats = emptyStats();
  broadcast('status', liveStats);
  res.json({ success: true });
});

// ---------- Commands from the control page (only the stage page acts on them) ----------
const CONTROL_ACTIONS = ['speak', 'setRate', 'reset', 'setName', 'custom'];
app.post('/api/control', (req, res) => {
  const { action, text } = req.body || {};
  if (!CONTROL_ACTIONS.includes(action)) return res.status(400).json({ success: false, error: 'Invalid command' });
  if (action === 'speak' && (typeof text !== 'string' || !text.trim())) {
    return res.status(400).json({ success: false, error: 'Type something to read first' });
  }
  const payload = { action, text: typeof text === 'string' ? text.trim().slice(0, 1000) : undefined };
  if (action === 'setRate' && payload.text) lastRateControl = { action, text: payload.text };
  if (action === 'setName') {
    // Plain text only, at most 40 characters
    const name = (payload.text || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false, error: 'Type a class name first' });
    payload.text = name;
    lastNameControl = { action, text: name };
    saveSettings({ channelName: name });
  }
  broadcast('control', payload);
  res.json({ success: true, pages: sseClients.length });
});

// ---------- Simulated events (testing without going live) ----------
const TEST_EVENTS = ['chat', 'gift', 'member', 'follow', 'share', 'like'];
app.post('/api/test/emit', (req, res) => {
  const { type, data } = req.body || {};
  if (!TEST_EVENTS.includes(type)) return res.status(400).json({ success: false, error: 'Invalid event type' });
  const event = { timestamp: Date.now(), avatar: '', ...(data || {}), test: true };
  if (type === 'like') {
    liveStats.totalLikes += Number(event.likeCount) || 1;
    event.totalLikes = liveStats.totalLikes;
  }
  broadcast(type, event);
  res.json({ success: true });
});

// ---------- Voice ----------
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function splitText(text: string, max = 190): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const win = rest.slice(0, max + 1);
    let cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
    if (cut < max / 2) cut = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '));
    if (cut < max / 2) cut = win.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// hype = a host shout ("Hooray!", "Oh my!"): only louder, same pitch (a different pitch sounds like another person)
// Edge blocks (error 429) many connections at once: send one line at a time, share a line that is already being made,
// when blocked wait and retry, and only then fall back to the backup voice.
let edgeChain: Promise<unknown> = Promise.resolve();
const edgeInflight = new Map<string, Promise<Buffer>>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function edgeTts(text: string, rate: number, hype = false, voiceName = TTS_VOICE): Promise<Buffer> {
  const key = `${voiceName}|${rate}|${hype}|${text}`;
  const running = edgeInflight.get(key);
  if (running) return running;
  const job = edgeChain.then(async () => {
    let last: unknown;
    for (const wait of [0, 2000, 5000, 10000]) {
      if (wait) await sleep(wait);
      try {
        return await edgeTtsOnce(text, rate, hype, voiceName);
      } catch (err) {
        last = err;
      }
    }
    throw last;
  });
  edgeChain = job.catch(() => {});
  edgeInflight.set(key, job);
  job.finally(() => edgeInflight.delete(key)).catch(() => {});
  return job;
}

async function edgeTtsOnce(text: string, rate: number, hype = false, voiceName = TTS_VOICE): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), {
      rate: `${rate >= 1 ? '+' : ''}${Math.round((rate - 1) * 100)}%`,
      pitch: TTS_PITCH,
      volume: hype ? '+40%' : '+0%',
    });
    const chunks: Buffer[] = [];
    const read = (async () => {
      for await (const c of audioStream) chunks.push(c as Buffer);
    })();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Edge TTS timeout')), 20000));
    await Promise.race([read, timeout]);
    if (chunks.length === 0) throw new Error('Edge TTS returned no audio');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

async function googleTts(text: string, lang = 'vi'): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const chunk of splitText(text)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });
    if (!r.ok) throw new Error(`Google TTS error ${r.status}`);
    parts.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

const ttsCache = new Map<string, Buffer>();

// The Vietnamese edition had a local "VieNeu-TTS" voice pack here. It only speaks Vietnamese, so the
// English edition always uses the Microsoft Edge voices (Jenny female / Guy male) with Google as backup.
// These two routes stay so the control page can switch between the female and male voice.
const voiceStatus = () => ({ state: 'unavailable' as const, voice: settings.room?.teacherVoice === 'nam' ? '__edge_m__' : '__edge_f__', voices: [] });
app.get('/api/tts/status', (_req, res) => res.json(voiceStatus()));
app.post('/api/tts/voice', (req, res) => {
  const v = typeof req.body?.voice === 'string' ? req.body.voice.trim() : '';
  if (v !== '__edge_f__' && v !== '__edge_m__') return res.status(400).json({ success: false, error: 'Unknown voice' });
  saveSettings({ room: { ...settings.room, teacherVoice: v === '__edge_m__' ? 'nam' : 'nu' } });
  broadcast('roomCfg', settings.room);
  res.json({ success: true, ...voiceStatus(), room: settings.room });
});

app.get('/api/tts', async (req, res) => {
  try {
    const raw = String(req.query.text || '').trim().slice(0, 1500);
    if (!raw) return res.status(400).send('Missing text');
    const rate = Math.min(1.5, Math.max(0.5, Number(req.query.rate) || 1));
    const hype = req.query.hype === '1';
    // Edge / Google do not understand emotion tags [laughs] [sighs]...: strip them so they are not read out
    const text = raw.replace(/\[[^\]]*\]\s*/g, '').trim();
    if (!text) return res.status(204).end();
    // Female and male voice (picked on the control page), plus an English voice for English words.
    // Only these voices are accepted; arbitrary voice names cannot be passed in.
    const voiceName = req.query.v === 'f' ? 'en-US-JennyNeural' : req.query.v === 'm' ? 'en-US-GuyNeural' : req.query.v === 'en' ? 'en-US-JennyNeural' : req.query.v === 'enm' ? 'en-US-GuyNeural' : TTS_VOICE;
    const key = `${voiceName}|${rate}|${hype}|${text}`;
    let audio = ttsCache.get(key);
    let fallback = false;
    if (!audio) {
      try {
        audio = await edgeTts(text, rate, hype, voiceName); // already retried 4 times inside
      } catch (err) {
        // the backup voice must speak the RIGHT language: Google English; if Google fails too the line is skipped (never read wrong)
        console.warn(`[backup voice] Edge failed 4 times (${voiceName}), reading with Google English: "${text.slice(0, 60)}"`, err instanceof Error ? err.message : err);
        audio = await googleTts(text, 'en');
        fallback = true;
      }
      // the backup voice is not cached: next time this line tries Edge first again
      if (!fallback) ttsCache.set(key, audio);
      if (ttsCache.size > 200) ttsCache.delete(ttsCache.keys().next().value!);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', fallback ? 'no-store' : 'public, max-age=86400');
    res.send(audio);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ---------- Game-specific API: add below ----------

// The stage page (where the real game runs) posts state snapshots; the control page previews exactly that
app.post('/api/game/state', (req, res) => {
  broadcast('gamestate', req.body);
  if (typeof req.body?.phase === 'string') stagePhase = req.body.phase.slice(0, 20);
  res.json({ success: true });
});

// The class book is saved to a file (survives a restart): when each question was asked + the weekly honour roll
// DATA_DIR: test runs use another folder so fake names never end up in the real class book
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Class settings (control page): saved in settings.json and sent to the stage page at once. Custom backgrounds go to data/backgrounds/ (not in git)
const BG_DIR = path.join(DATA_DIR, 'backgrounds');
app.use('/room-bg', express.static(BG_DIR));
const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max);
const saveRoom = (patch: RoomSettings) => {
  saveSettings({ room: { ...settings.room, ...patch } });
  broadcast('roomCfg', settings.room);
};
const removeRoomBg = () => {
  if (!settings.room?.bg) return;
  fs.rm(path.join(BG_DIR, path.basename(settings.room.bg)), { force: true }, () => {});
};
app.get('/api/room-settings', (_req, res) => res.json(settings.room ?? {}));
app.post('/api/room-settings', (req, res) => {
  const b = req.body || {};
  const patch: RoomSettings = {};
  if (typeof b.teacherName === 'string') {
    const name = cleanText(b.teacherName, 24);
    if (!name) return res.status(400).json({ success: false, error: 'Type the teacher name first' });
    patch.teacherName = name;
  }
  if (b.teacherVoice === 'nu' || b.teacherVoice === 'nam') patch.teacherVoice = b.teacherVoice;
  if (typeof b.motto === 'string') {
    const motto = cleanText(b.motto, 40);
    if (!motto) return res.status(400).json({ success: false, error: 'Type the red banner text first' });
    patch.motto = motto;
  }
  if (typeof b.everest === 'boolean') patch.everest = b.everest;
  if (typeof b.chuong === 'boolean') patch.chuong = b.chuong;
  if (b.teacher === 'co' || b.teacher === 'thay') patch.teacher = b.teacher;
  if (typeof b.supervisor === 'boolean') patch.supervisor = b.supervisor;
  if (typeof b.standWrong === 'boolean') patch.standWrong = b.standWrong;
  if (b.supervisorMin !== undefined) patch.supervisorMin = Math.min(60, Math.max(1, Math.round(Number(b.supervisorMin)) || 4));
  if (b.dance === 'off' || b.dance === 'mix' || b.dance === 'always') patch.dance = b.dance;
  if (b.danceSec !== undefined) patch.danceSec = Math.min(120, Math.max(10, Math.round(Number(b.danceSec)) || 30));
  if (typeof b.danceText === 'string') {
    const t = cleanText(b.danceText, 80);
    if (!t) return res.status(400).json({ success: false, error: 'Type the dance message first' });
    patch.danceText = t;
  }
  if (typeof b.birthdayText === 'string') {
    const t = cleanText(b.birthdayText, 60);
    if (!t) return res.status(400).json({ success: false, error: 'Type the birthday banner text first' });
    patch.birthdayText = t;
  }
  saveRoom(patch);
  res.json({ success: true, room: settings.room });
});
// Background upload: only PNG, JPG, WEBP (the file content is checked too); the server picks the file name
const imageExt = (b: Buffer) => {
  if (b.length > 12 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return '';
};
app.post('/api/room-bg', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '12mb' }), (req, res) => {
  const body = req.body as Buffer;
  const ext = Buffer.isBuffer(body) ? imageExt(body) : '';
  if (!ext) return res.status(400).json({ success: false, error: 'PNG, JPG or WEBP images only' });
  try {
    fs.mkdirSync(BG_DIR, { recursive: true });
    const file = `nen-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(BG_DIR, file), body);
    removeRoomBg();
    saveRoom({ bg: file });
    res.json({ success: true, room: settings.room });
  } catch (err) {
    console.error('Could not save the background:', err);
    res.status(500).json({ success: false, error: 'Could not save the background' });
  }
});
app.delete('/api/room-bg', (_req, res) => {
  removeRoomBg();
  saveRoom({ bg: '' });
  res.json({ success: true, room: settings.room });
});
const SAVE_FILE = path.join(DATA_DIR, 'class-book.json');
interface SoLop {
  used: Record<string, number>; // question id -> last time asked (ms)
  week: string; // current week, e.g. "2026-W45"
  scores: Record<string, { nickname: string; points: number }>;
  // questions the owner dropped with "Drop this question": never asked again. Editing the question (new answer) makes it a new question
  banned: Record<string, { answer: string; clue: string; at: number }>;
  // attendance: last day in class, day streak, total days
  attend: Record<string, { nickname: string; last: string; streak: number; total: number }>;
  // today's points (for the session report) + today's chat activity (Top chatters board)
  today: { date: string; scores: Record<string, { nickname: string; points: number }>; talk?: Record<string, { nickname: string; points: number }>; flowers?: number; talkRoom?: string };
  // lifetime report card: points that keep adding up (grades) + right answers per kind (badges)
  life: Record<string, LifeRow>;
}
type LifeRow = { nickname: string; points: number; total: number; toan: number; su: number; meo: number; anh: number };
const LIFE_KEYS = ['points', 'total', 'toan', 'su', 'meo', 'anh'] as const;
// day in the PC's local time, e.g. "2026-11-04"
const dayKey = (d = new Date()) => d.toLocaleDateString('sv');
const weekKey = (d = new Date()) => {
  // ISO week (starts on Monday)
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
};
let soLop: SoLop = { used: {}, week: weekKey(), scores: {}, banned: {}, attend: {}, today: { date: dayKey(), scores: {} }, life: {} };
try {
  soLop = { ...soLop, ...JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')) };
} catch {
  // no class book yet: start fresh
}
const weekTop = () => {
  if (soLop.week !== weekKey()) soLop = { ...soLop, week: weekKey(), scores: {} }; // new week: clear last week's points
  return Object.entries(soLop.scores)
    .map(([username, v]) => ({ username, ...v }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
};
// a TikTok name may be "__proto__": never use it as a key, it would break the class book object
const safeKey = (k: string) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const writeSoLop = () => {
  try {
    fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
    fs.writeFileSync(SAVE_FILE, JSON.stringify(soLop));
  } catch (err) {
    console.error('Could not save the class book:', err);
  }
};
// many students joining at once: batch for 2 s, then write the file once
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const saveSoon = () => {
  saveTimer ??= setTimeout(() => {
    saveTimer = null;
    writeSoLop();
  }, 2000);
};
const todayScores = () => {
  if (soLop.today.date !== dayKey()) soLop.today = { date: dayKey(), scores: {}, talk: {}, flowers: 0 };
  return soLop.today.scores;
};
// Top chatters restart with every new live session (owner's call 2026-11-05): each TikTok live has its own room id,
// a new room id clears the chat points. Reconnecting to the same live after a drop (same room id) keeps them.
function newLiveRoom(roomId: string) {
  if (!roomId) return;
  todayScores();
  if (soLop.today.talkRoom === roomId) return;
  soLop.today.talkRoom = roomId;
  soLop.today.talk = {};
  console.log(`[Top chatters] new live session ${roomId}: board reset`);
  writeSoLop();
}
const todayTalk = () => {
  todayScores(); // new day: clear the chat points too
  return (soLop.today.talk ??= {});
};
const addScore = (book: Record<string, { nickname: string; points: number }>, key: string, nickname: unknown, points: number) => {
  const cur = Object.hasOwn(book, key) ? book[key] : { nickname: '', points: 0 };
  cur.nickname = String(nickname || cur.nickname).slice(0, 60);
  cur.points += points;
  book[key] = cur;
};

// Session report: one file per day, data/reports/<day>.json, with every question asked
const REPORT_DIR = path.join(DATA_DIR, 'reports');
type ReportRow = { id: string; answer: string; category: string; attempts: number; correct: number; at: number };
const readReport = (day: string): ReportRow[] => {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPORT_DIR, `${day}.json`), 'utf8'));
  } catch {
    return [];
  }
};

// today's top points (Top students board in the stage's top-left corner)
const topOf = (book: Record<string, { nickname: string; points: number }>) =>
  Object.entries(book)
    .map(([username, v]) => ({ username, ...v }))
    .sort((x, y) => y.points - x.points)
    .slice(0, 10);
const todayTop = () => topOf(todayScores());
// today's top chatters (Top chatters board on the right of the stage)
const talkTop = () => topOf(todayTalk());
// the teacher's flower fund today (flowers, one per gift coin)
const flowersToday = () => {
  todayScores();
  return soLop.today.flowers ?? 0;
};
const lifeOf = (key: string): LifeRow => (Object.hasOwn(soLop.life, key) ? soLop.life[key] : { nickname: '', points: 0, total: 0, toan: 0, su: 0, meo: 0, anh: 0 });
app.get('/api/game/save', (_req, res) =>
  res.json({ used: soLop.used, banned: Object.keys(soLop.banned), weekTop: weekTop(), todayTop: todayTop(), talkTop: talkTop(), flowersToday: flowersToday() }),
);
app.post('/api/game/save', (req, res) => {
  const { used, week, banned, report, life, talk, flowers } = req.body || {};
  if (typeof flowers === 'number' && Number.isFinite(flowers) && flowers > 0) {
    todayScores();
    soLop.today.flowers = (soLop.today.flowers ?? 0) + Math.min(1_000_000, Math.round(flowers));
  }
  // lifetime report card: add the new part
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
  // today's chat activity
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
    for (const b of banned.slice(0, 50)) {
      if (!b || typeof b.id !== 'string' || !safeKey(b.id)) continue;
      soLop.banned[b.id.slice(0, 200)] = { answer: String(b.answer ?? '').slice(0, 60), clue: String(b.clue ?? '').slice(0, 300), at: Date.now() };
    }
  }
  if (Array.isArray(report) && report.length) {
    const rows: ReportRow[] = report
      .slice(0, 200)
      .filter((r) => r && typeof r.id === 'string')
      .map((r) => ({
        id: r.id.slice(0, 200),
        answer: String(r.answer ?? '').slice(0, 60),
        category: String(r.category ?? '').slice(0, 80),
        attempts: Math.max(0, Number(r.attempts) || 0),
        correct: Math.max(0, Number(r.correct) || 0),
        at: Number(r.at) || Date.now(),
      }));
    try {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(REPORT_DIR, `${dayKey()}.json`), JSON.stringify([...readReport(dayKey()), ...rows]));
    } catch (err) {
      console.error('Could not save the report:', err);
    }
  }
  writeSoLop();
  res.json({ weekTop: weekTop(), todayTop: todayTop(), talkTop: talkTop(), flowersToday: flowersToday() });
});

// Attendance: the stage page reports each student's first comment of the session, the server answers with the day streak
app.post('/api/game/attend', (req, res) => {
  const { username, nickname } = req.body || {};
  if (typeof username !== 'string' || !safeKey(username.slice(0, 100))) return res.status(400).json({ days: 0 });
  const key = username.slice(0, 100);
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const cur = Object.hasOwn(soLop.attend, key) ? soLop.attend[key] : { nickname: '', last: '', streak: 0, total: 0 };
  if (cur.last !== today) {
    cur.streak = cur.last === yesterday ? cur.streak + 1 : 1;
    cur.total++;
    cur.last = today;
  }
  cur.nickname = String(nickname || cur.nickname).slice(0, 60);
  soLop.attend[key] = cur;
  saveSoon();
  // includes the lifetime report card so the game knows which grade this student is in
  const { nickname: _n, ...life } = lifeOf(key);
  res.json({ days: cur.streak, total: cur.total, life });
});

// Viewers per part of the game: every 15 s write (time, current part, viewer count) to data/reports/<day>-viewers.json.
// The report page works out how many viewers each part gains or loses per minute, to see which part makes people leave.
let stagePhase = '';
type ViewSample = { at: number; phase: string; viewers: number };
const viewFile = (day: string) => path.join(REPORT_DIR, `${day}-viewers.json`);
const readViews = (day: string): ViewSample[] => {
  try {
    return JSON.parse(fs.readFileSync(viewFile(day), 'utf8'));
  } catch {
    return [];
  }
};
let viewSamples: { day: string; rows: ViewSample[] } = { day: '', rows: [] };
setInterval(() => {
  if (!stagePhase || liveStats.viewerCount <= 0) return;
  const day = dayKey();
  if (viewSamples.day !== day) viewSamples = { day, rows: readViews(day) };
  viewSamples.rows.push({ at: Date.now(), phase: stagePhase, viewers: liveStats.viewerCount });
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(viewFile(day), JSON.stringify(viewSamples.rows));
  } catch (err) {
    console.error('Could not save viewer counts:', err);
  }
}, 15_000);
const PHASE_NAME: Record<string, string> = {
  team: 'Team picking', intro: 'Class intro', question: 'Answering', bonus: 'Extra time (letter revealed)', reveal: 'Answer shown',
  praise: 'Mid-class shout-out', results: 'Class summary', recess: 'Recess', vote: 'Topic vote', show: 'Big show',
};
/** per part: total time, average viewers, viewer change per minute (negative = people leaving) */
const viewStats = (rows: ViewSample[]) => {
  const by = new Map<string, { n: number; sum: number; delta: number; ms: number }>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const b = by.get(r.phase) ?? { n: 0, sum: 0, delta: 0, ms: 0 };
    b.n++;
    b.sum += r.viewers;
    const next = rows[i + 1];
    // only count back-to-back samples (under 1 minute apart); a live stopped and restarted is skipped
    if (next && next.at - r.at < 60_000) {
      b.delta += next.viewers - r.viewers;
      b.ms += next.at - r.at;
    }
    by.set(r.phase, b);
  }
  return [...by].map(([phase, b]) => ({ phase, minutes: b.ms / 60_000, avg: b.sum / b.n, perMin: b.ms ? (b.delta / b.ms) * 60_000 : 0 })).sort((a, b) => a.perMin - b.perMin);
};

// Report page after the live: http://localhost:3006/report (add ?day=2026-11-04 for another day)
app.get('/report', (req, res) => {
  const day = typeof req.query.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day) ? req.query.day : dayKey();
  const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const rows = readReport(day);
  const words = rows.filter((r) => r.category !== 'Mental math');
  // at least 3 students tried and nobody got it (skipped questions where nobody typed do not count)
  const hard = words.filter((r) => r.correct === 0 && r.attempts >= 3).sort((a, b) => b.attempts - a.attempts);
  const easy = words.filter((r) => r.attempts >= 5 && r.correct / r.attempts >= 0.9);
  const attended = Object.entries(soLop.attend).filter(([, a]) => a.last === day);
  const top = day === soLop.today.date ? Object.entries(soLop.today.scores).sort((a, b) => b[1].points - a[1].points).slice(0, 15) : [];
  const loyal = attended.sort((a, b) => b[1].streak - a[1].streak).slice(0, 15);
  const banned = Object.entries(soLop.banned).sort((a, b) => b[1].at - a[1].at);
  const views = viewStats(day === viewSamples.day ? viewSamples.rows : readViews(day));
  const list = (items: string[], empty: string) => (items.length ? `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>` : `<p class="muted">${empty}</p>`);
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LIVE-CLASS report ${esc(day)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:16px;background:#fdf8ec;color:#3b2a14}
h1{margin:0 0 4px}h2{margin-top:28px;border-bottom:2px solid #e9d8a6;padding-bottom:4px}.muted{color:#8a7350}
.stats{display:flex;gap:12px;flex-wrap:wrap}.stat{background:#fff;border-radius:12px;padding:10px 16px;box-shadow:0 1px 3px #0002}
.stat b{display:block;font-size:28px}li{margin:4px 0}code{background:#f3e9cf;padding:1px 5px;border-radius:4px}</style></head><body>
<h1>📊 Live session report</h1><div class="muted">Date ${esc(day)} · other day: add <code>?day=YYYY-MM-DD</code> to the link</div>
<div class="stats" style="margin-top:12px">
<div class="stat"><b>${rows.length}</b>questions asked</div>
<div class="stat"><b>${attended.length}</b>students</div>
<div class="stat"><b>${hard.length}</b>nobody got right</div>
<div class="stat"><b>${easy.length}</b>too easy</div></div>
<h2>👀 Viewers per segment</h2><p class="muted">Average viewers gained (+) or lost (−) per minute in each segment. The biggest loss is on top: that is where people leave the live. Sampled every 15 seconds, only while connected to TikTok.</p>
${views.length ? `<table style="border-collapse:collapse;width:100%;background:#fff;border-radius:12px"><tr style="text-align:left"><th style="padding:6px">Segment</th><th>Time</th><th>Avg viewers</th><th>Change / min</th></tr>${views
  .map((r) => `<tr style="border-top:1px solid #eee"><td style="padding:6px">${esc(PHASE_NAME[r.phase] ?? r.phase)}</td><td>${r.minutes.toFixed(0)} min</td><td>${r.avg.toFixed(0)}</td><td style="color:${r.perMin < 0 ? '#b91c1c' : '#15803d'};font-weight:700">${r.perMin > 0 ? '+' : ''}${r.perMin.toFixed(1)}</td></tr>`)
  .join('')}</table>` : '<p class="muted">No data yet (not connected to TikTok today).</p>'}
<h2>❌ Questions nobody got right</h2><p class="muted">Several people tried and still missed: the question may be too hard or the clue unclear, worth reviewing.</p>
${list(hard.map((r) => `<b>${esc(r.answer)}</b> · ${esc(r.category)} · ${r.attempts} tries <code>${esc(r.id)}</code>`), 'None.')}
<h2>✅ Too easy (90%+ correct)</h2>
${list(easy.map((r) => `<b>${esc(r.answer)}</b> · ${esc(r.category)} · ${r.correct}/${r.attempts} correct`), 'None.')}
<h2>🏆 Top scores today</h2>
${list(top.map(([, s]) => `${esc(s.nickname)} · ${s.points} points`), 'No scores yet (or not today).')}
<h2>🎒 Attendance streaks</h2>
${list(loyal.map(([, a]) => `${esc(a.nickname)} · ${a.streak} days in a row · ${a.total} days total`), 'Nobody yet.')}
<h2>🚫 Dropped questions</h2><p class="muted">Fix them in <code>src/game/word-bank/</code> (change the answer or delete the line). A changed answer counts as a new question.</p>
${list(banned.map(([id, b]) => `<b>${esc(b.answer)}</b> · ${esc(b.clue)} <code>${esc(id)}</code>`), 'No dropped questions.')}
</body></html>`);
});

// ---------- Startup ----------
async function start() {
  const distDir = path.join(__dirname, 'dist');
  const distIndex = path.join(distDir, 'index.html');
  if (process.env.NODE_ENV !== 'production' || !fs.existsSync(distIndex)) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      // LIVE_MODE=1 (START-LIVE.bat): no auto reload, so editing code never resets the stage page during a live
      // Live: the reload channel (ws) is fully off so it never clashes with port 24678 of another game that is running.
      // While editing code: own port 24682 for the reload channel (other games use 24678 and 24680).
      server:
        process.env.LIVE_MODE === '1'
          ? { middlewareMode: true, hmr: false, ws: false }
          : { middlewareMode: true, hmr: { port: 24682 } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(distIndex));
  }

  // Listen on this PC only: the API has no login, so people on the same Wi-Fi cannot control the voice
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://localhost:${PORT}  |  LIVE Studio link: http://lvh.me:${PORT}/?view=stage`);
    // server was stopped / restarted while connected: reconnect that account
    if (wantUser && !process.env.DATA_DIR) {
      console.log(`[TikTok] Reconnecting @${wantUser} (was connected last time)`);
      connectTikTok(wantUser).catch((err) => scheduleReconnect(`Could not connect (${err instanceof Error ? err.message : err})`));
    }
  });
}

start();
