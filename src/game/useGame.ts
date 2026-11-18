import { useEffect, useRef, useState } from 'react';
import { useLiveEvents } from '../live/useLiveEvents';
import type { GiftEvent, LiveStatus } from '../live/types';
import { voice, speakableName } from '../live/voice';
import { containsBanned } from '../live/bannedWords';
import { NameBatcher } from '../live/scoreboard';
import { GiftThanker, OncePerPerson } from '../live/chatter';
import { IS_STAGE } from '../live/page';
import { GAME, shownTeacherName, type RoomCfg } from './config';
import { QUESTIONS, SHOW_BANK } from './bank';
import { Classroom, plain, type ClassView, type RecessGame, type Say } from './quiz';
import type { ShowKind } from './show';
import { sfx } from './sfx';
import { api } from '../live/api';
import { STANDALONE } from '../live/env';

// ?view=stage&mute=1: preview the stage page without sound
const MUTED = new URLSearchParams(window.location.search).get('mute') === '1';

/** the running classroom (single-file build: the simulated classmates read it) */
export const liveRoom: { current: Classroom | null } = { current: null };

export type WeekRow = { username: string; nickname: string; points: number };
export type StageView = ClassView & { weekTop: WeekRow[]; todayTop: WeekRow[]; talkTop: WeekRow[]; cfg: RoomCfg };

/** Top 5 today: points the server has saved + points just scored and not sent yet (board updates at once, no 20 s wait) */
function dayBoard(saved: WeekRow[], pending: Map<string, { nickname: string; points: number }>): WeekRow[] {
  const all = new Map(saved.map((r) => [r.username, { ...r }]));
  for (const [username, p] of pending) {
    const cur = all.get(username) ?? { username, nickname: p.nickname, points: 0 };
    cur.points += p.points;
    cur.nickname = p.nickname || cur.nickname;
    all.set(username, cur);
  }
  return [...all.values()].sort((a, b) => b.points - a.points).slice(0, 5);
}

/**
 * The stage page runs the real game (core in quiz.ts), reads/writes the class book on the server and posts snapshots.
 * The control page never runs the game itself, it only redraws that snapshot, so the preview always matches the live.
 */
export function useGame() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [view, setView] = useState<StageView | null>(null);
  const [lastGift, setLastGift] = useState<(GiftEvent & { at: number }) | null>(null);
  const [stageCount, setStageCount] = useState(0);
  const [channelName, setChannelName] = useState(GAME.defaultChannelName);

  const roomRef = useRef<Classroom | null>(null);
  const cfg = useRef<RoomCfg>(GAME.defaultRoom); // class settings (control page)
  const applyCfg = (room: Classroom | null) => {
    const c = cfg.current;
    const thay = c.teacher === 'thay';
    // male teacher: male voice for everything (English words too); a name still starting with "Ms." uses the default male teacher name
    voice.teacher = thay || c.teacherVoice === 'nam' ? 'm' : 'f';
    if (!room) return;
    room.thay = thay;
    room.teacherName = shownTeacherName(c);
    room.supervisorOn = c.supervisor;
    room.supervisorIdleMs = Math.max(1, Number(c.supervisorMin) || GAME.defaultRoom.supervisorMin) * 60_000;
    room.dance = c.dance;
    room.setStandWrong(!!c.standWrong);
    room.danceSec = Math.min(120, Math.max(10, Number(c.danceSec) || GAME.defaultRoom.danceSec));
    room.showsOn = { everest: cfg.current.everest, chuong: cfg.current.chuong };
  };
  const weekTop = useRef<WeekRow[]>([]);
  const todayTop = useRef<WeekRow[]>([]); // points for the whole day (server), for the Top students today board
  const talkTop = useRef<WeekRow[]>([]); // interactions for the whole day (server), for the Top chatters board
  const likeBase = useRef<number | null>(null);
  const dirty = useRef(true);

  const [talk] = useState(() => ({
    greeter: new NameBatcher(
      GAME.greetEveryMs,
      GAME.namesPerGreeting,
      (names) => roomRef.current && say([roomRef.current.greet(joinNames(names))]),
      () => chatter.current.length >= 2, // extra lines still waiting: group the names into the next turn
    ),
    gifts: new GiftThanker(GAME.giftThanksCooldownMs, GAME.bigGiftCoins),
    follows: new OncePerPerson(),
  }));

  // The voice follows the show:
  // - Main lines (question, answer, summary, recess) are read at once; while the teacher reads, that part's clock stops.
  // - Extra lines (greetings, thanks, teasing) wait here and are only said while waiting for answers with more than 5 s left.
  const mainSpeaking = useRef(0);
  const chatter = useRef<{ text: string; priority: boolean; until: number }[]>([]);
  function say(lines: Say[]) {
    const now = Date.now();
    for (const l of lines) {
      if (l.main) {
        mainSpeaking.current++;
        // the "go" line: the letter board appears as soon as the teacher starts saying it
        const onStart = l.go
          ? () => {
              roomRef.current?.showBoard();
              dirty.current = true;
            }
          : undefined;
        // quick mode: the letter board appears and answers count only after the question has been read
        const onDone = l.showAfter
          ? () => {
              mainSpeaking.current--;
              roomRef.current?.showBoard();
              dirty.current = true;
            }
          : () => mainSpeaking.current--;
        voice.say(l.text, true, onDone, false, onStart);
      } else if (l.warn) {
        voice.say(l.text, true); // "time is almost up": jumps the queue and is read at once, the clock keeps running
      } else {
        const ttl = l.ttl ?? (l.priority ? GAME.giftLineMaxWaitMs : GAME.chatterMaxWaitMs);
        chatter.current.push({ text: l.text, priority: !!l.priority, until: now + ttl });
      }
    }
    dirty.current = true;
  }
  /** Release one extra line if it is the right moment (called every game tick) */
  function flushChatter(room: Classroom, now: number) {
    chatter.current = chatter.current.filter((c) => c.until > now);
    if (voice.busy || mainSpeaking.current > 0 || !room.chatterWindow(now)) return;
    // gift thanks first; ordinary lines are capped at GAME.chatterPerPhase per part, the rest wait for the next part or expire
    const p = chatter.current.findIndex((c) => c.priority);
    const i = p >= 0 ? p : room.chatterAllowed(false) ? 0 : -1;
    if (i < 0) return;
    const next = chatter.current.splice(i, 1)[0];
    if (!next) return;
    if (!next.priority) room.chatterUsed++;
    voice.say(next.text);
  }

  // Safe name to show/read: a name with a banned word falls back to the username
  const person = (e: { nickname: string; username: string; avatar: string }) => {
    const nickname = containsBanned(e.nickname) ? e.username : e.nickname;
    return { username: e.username, nickname, spoken: speakableName(nickname), avatar: e.avatar };
  };

  useLiveEvents({
    onStatus: setStatus,
    onSpeaker: (d) => setStageCount(d.count),
    onGameState: (s) => {
      if (!IS_STAGE) setView(s as StageView);
    },
    onRoomCfg: (c) => {
      cfg.current = { ...GAME.defaultRoom, ...(c as Partial<RoomCfg>) };
      applyCfg(roomRef.current);
      dirty.current = true;
    },

    onChat: (e) => {
      const room = roomRef.current;
      if (!room) return;
      const p = person(e);
      const isNew = !room.students.has(e.username);
      // realTime: only a real TikTok timestamp (server sends createTime) is used to measure clock skew
      say(room.chat({ ...p, comment: e.comment, createTime: e.createTime ?? e.timestamp, realTime: e.createTime != null && !e.test, safe: !containsBanned(e.comment) }, Date.now()));
      if (isNew && p.spoken !== 'friend' && GAME.joinKeywords.includes(plain(e.comment))) talk.greeter.add(e.username, p.spoken);
      // attendance: first comment of the session is reported to the server, which answers with the day streak
      if (isNew && IS_STAGE) {
        api('/api/game/attend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: e.username, nickname: p.nickname }) })
          .then((r) => r.json())
          .then((d) => roomRef.current && say(roomRef.current.attendance(p, Number(d.days) || 0, Date.now(), d.life)))
          .catch(() => {});
      }
    },

    onGift: (e) => {
      const room = roomRef.current;
      if (!room) return;
      const p = person(e);
      const coins = e.diamondCount * e.repeatCount;
      setLastGift({ ...e, nickname: p.nickname, at: Date.now() });
      const hint = room.gift(p, coins, Date.now(), e.repeatCount, e.giftName);
      say(hint); // a student walks up with flowers: the teacher thanks them at once; a gift that hits a flower-fund milestone: she thanks the whole class
      // combos / back-to-back gifts are thanked once per 30 s; big gifts are always thanked
      if (!hint.length && talk.gifts.shouldThank(e.username, coins, chatter.current.filter((c) => c.priority).length)) say([room.thank(p, e.giftName, coins)]);
    },

    onFollow: (e) => {
      const room = roomRef.current;
      if (room && talk.follows.first(e.username)) say([room.follow(person(e))]);
    },

    onLike: (e) => {
      const room = roomRef.current;
      if (!room) return;
      if (likeBase.current === null) likeBase.current = e.totalLikes - e.likeCount;
      // real hearts x GAME.heartBoost: every 300 hearts (60 real ones) the whole class claps
      const reached = (e.totalLikes - likeBase.current) * GAME.heartBoost >= GAME.likesPerClap;
      if (reached) likeBase.current = e.totalLikes;
      say(room.like(e.likeCount, Date.now(), reached, person({ ...e, avatar: '' })));
    },

    onControl: (c) => {
      if (c.action === 'setName' && c.text) setChannelName(c.text);
      const room = roomRef.current;
      if (!room) return;
      if (c.action === 'speak' && c.text) voice.say(c.text, true);
      if (c.action === 'setRate' && c.text) voice.rate = Number(c.text) || 1;
      if (c.action === 'reset' || (c.action === 'custom' && c.text === 'newRound')) {
        voice.stop();
        chatter.current = [];
        say(room.newRound(Date.now()));
      }
      if (c.action === 'custom' && c.text === 'skip') say(room.skip(Date.now()));
      if (c.action === 'custom' && c.text === 'ban') say(room.banCurrent(Date.now()));
      // the owner sends a birthday wish by hand: if the name matches a student in class, the cake goes on their desk
      if (c.action === 'custom' && c.text?.startsWith('birthday:')) {
        const name = c.text.slice(9).trim().slice(0, 40);
        const s = [...room.students.values()].find((x) => x.nickname.toLowerCase() === name.toLowerCase());
        if (name) say(room.celebrate(s ?? person({ username: `kenh:${name}`, nickname: name, avatar: '' }), Date.now()));
      }
      if (c.action === 'custom' && c.text === 'goodbye') say(room.goodbye(Date.now()));
      if (c.action === 'custom' && c.text === 'escort') say(room.forceEscort(Date.now()));
      if (c.action === 'custom' && c.text?.startsWith('recess:')) say(room.forceRecess(c.text.slice(7) as RecessGame, Date.now()));
      if (c.action === 'custom' && c.text?.startsWith('show:')) say(room.forceShow(c.text.slice(5) as ShowKind, Date.now()));
      if (c.action === 'custom' && c.text?.startsWith('vong:')) {
        voice.stop();
        chatter.current = [];
        say(room.jumpToStage(Number(c.text.slice(5)) || 0, Date.now()));
      }
    },
  });

  // Stage page opens: read the class book (asked questions, weekly honour roll) before class starts
  useEffect(() => {
    if (!IS_STAGE) return;
    if (MUTED) {
      voice.volume = 0;
      sfx.volume = 0;
    }
    if (!STANDALONE) sfx.loadFiles(); // single-file build: no sound files to load, effects are synthesized
    let prevView: StageView | null = null;
    let stop = false;
    const timers: ReturnType<typeof setInterval>[] = [];

    const save = async () => {
      const room = roomRef.current;
      if (!room) return;
      const used = room.usedLog.splice(0);
      const week = [...room.weekDelta].map(([username, v]) => ({ username, ...v }));
      room.weekDelta.clear();
      const banned = room.banLog.splice(0);
      const report = room.reportLog.splice(0);
      const life = [...room.lifeDelta].map(([username, v]) => ({ username, ...v }));
      room.lifeDelta.clear();
      const talk = [...room.talkDelta].map(([username, v]) => ({ username, ...v }));
      room.talkDelta.clear();
      const flowers = room.flowerDelta;
      room.flowerDelta = 0;
      try {
        const r = await api('/api/game/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ used, week, banned, report, life, talk, flowers }) });
        const d = await r.json();
        weekTop.current = d.weekTop ?? [];
        todayTop.current = d.todayTop ?? [];
        talkTop.current = d.talkTop ?? [];
        if (typeof d.flowersToday === 'number') roomRef.current?.setFlowersSaved(d.flowersToday);
        room.weekLeader = weekTop.current[0] ? speakableName(weekTop.current[0].nickname) : '';
      } catch {
        room.usedLog.unshift(...used); // server down: keep it and send next time
        for (const w of week) room.weekDelta.set(w.username, w);
        room.banLog.unshift(...banned);
        room.reportLog.unshift(...report);
        for (const l of life) room.lifeDelta.set(l.username, l);
        for (const w of talk) room.talkDelta.set(w.username, w);
        room.flowerDelta += flowers;
      }
    };

    (async () => {
      let used: Record<string, number> = {};
      let banned: string[] = [];
      let flowersSaved = 0;
      try {
        const d = await (await api('/api/game/save')).json();
        used = d.used ?? {};
        banned = d.banned ?? [];
        weekTop.current = d.weekTop ?? [];
        todayTop.current = d.todayTop ?? [];
        talkTop.current = d.talkTop ?? [];
        flowersSaved = Number(d.flowersToday) || 0; // today's flower fund (survives a page reload)
      } catch {
        // old server without a class book: play normally, asked questions are just not remembered
      }
      // class settings (teacher name, male teacher, hall monitor...) are read BEFORE the first class: the first line used to say the default
      // teacher name because the settings arrived from the server later (fixed 2026-11-07)
      try {
        const rc = await (await api('/api/room-settings')).json();
        cfg.current = { ...GAME.defaultRoom, ...rc };
      } catch {
        // old server: use the default settings, switch when the server sends them
      }
      if (stop) return;
      const room = new Classroom(QUESTIONS, Date.now(), Math.random, used, banned);
      room.setFlowersSaved(flowersSaved);
      room.showBank = SHOW_BANK;
      room.weekLeader = weekTop.current[0] ? speakableName(weekTop.current[0].nickname) : '';
      roomRef.current = room;
      liveRoom.current = room;
      applyCfg(room);
      say(room.newRound(Date.now()));

      // Game loop: 5 ticks a second move the clock; on any change redraw and send a snapshot to the control page
      let lastSent = 0;
      let lastTick = Date.now();
      timers.push(
        setInterval(() => {
          const now = Date.now();
          // the teacher is reading a main line: hold the clock (e.g. the 20 s only start after the question is read)
          if (mainSpeaking.current > 0) {
            room.hold(now - lastTick);
            dirty.current = true;
          }
          lastTick = now;
          say(room.tick(now));
          flushChatter(room, now);
          // big shows: tick in the last 5 seconds, like class questions
          sfx.clock(room.showAsking() ? 'question' : room.phase, room.boardShown, room.phaseEndsAt, now);
          // big-show EDM music: backs off while the teacher reads; full beat while waiting for answers, rushing in the last 5 s
          const sh = room.show;
          const step = sh?.steps[sh.i]?.k;
          const busy = mainSpeaking.current > 0;
          // dance break at recess: dance music, backs off while the teacher talks
          const dancing = room.phase === 'recess' && room.recess?.game === 'dance' && room.recess.stage === 'play';
          if (dancing) sfx.music('nhay', busy ? 0 : room.phaseEndsAt - now <= 5000 ? 2 : 1);
          else sfx.music(sh?.kind ?? null, !sh || busy ? 0 : room.showAsking() ? (room.phaseEndsAt - now <= 5000 ? 2 : 1) : step === 'gather' || step === 'honor' ? 1 : 0);
          if (!dirty.current && now - lastSent < 1000) return;
          dirty.current = false;
          const v = { ...room.view(now), cfg: cfg.current, weekTop: weekTop.current, todayTop: dayBoard(todayTop.current, room.weekDelta), talkTop: dayBoard(talkTop.current, room.talkDelta) };
          sfx.watch(prevView, v);
          prevView = v;
          setView(v);
          if (now - lastSent >= 400) {
            lastSent = now;
            api('/api/game/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }).catch(() => {});
          }
        }, 200),
        setInterval(() => say([room.share()]), GAME.shareReminderEveryMs),
        setInterval(save, 20_000),
      );
    })();

    window.addEventListener('beforeunload', save);
    return () => {
      stop = true;
      timers.forEach(clearInterval);
      window.removeEventListener('beforeunload', save);
    };
  }, []);

  return { status, view, lastGift, stageCount, channelName };
}

export type GameState = ReturnType<typeof useGame>;

// ['Mia', 'Leo', 'Sam'] -> 'Mia, Leo and Sam'
function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
}
