import { GAME, type RoomCfg } from './config';
import { teacherText } from './teacher-swap';
import { LINES, PICK_TOPICS, POLLS, REWARDS, type Poll } from './lines';
import { SLOTS, type Question, type Slot } from './questions';
import { makeMath, type MathLevel } from './math';
import { LETTERS, choiceOf, type CodeQ, type McLevel, type McQ, type ShowBank, type ShowKind } from './show';

// ---------- The 2 big shows ----------
type ShowTag = 'warm' | 'storm' | 'peak' | 'hold' | 'rescue' | 'final' | 'bell' | 'tie';
type ShowStep =
  | { k: 'gather' }
  | { k: 'section'; key: SectionKey }
  | { k: 'mc'; level: McLevel; sec: number; pts: number; tag: ShowTag }
  | { k: 'stake' }
  | { k: 'code'; hint: number } // 0..2 clues, 3 = rescue
  | { k: 'codeReveal' }
  | { k: 'honor' };
type SectionKey = 'evWarm' | 'evCode' | 'evStorm' | 'evPeak' | 'chWarm' | 'chHold' | 'chRescue' | 'chFinal' | 'chBell' | 'showTie';
/** name of the part shown on the board */
export const SECTION_TITLE: Record<SectionKey, string> = {
  evWarm: '👣 First Steps',
  evCode: '🔐 Base Camp Password',
  evStorm: '🌪️ Speed Storm',
  evPeak: '🏔️ The Summit',
  chWarm: '🔥 Warm-up',
  chHold: '💪 Hold Steady',
  chRescue: '🤝 Rescue for Everyone',
  chFinal: '⚡ Final Challenge',
  chBell: '🔔 Golden Bell Question',
  showTie: '⚖️ Tiebreaker',
};
export const SHOW_NAME: Record<ShowKind, string> = { everest: 'Road to Everest', chuong: 'Golden Bell' };
/** titles after the show: [winner, top 10, rescuer] */
const SHOW_TITLES: Record<ShowKind, [string, string, string]> = {
  everest: ['🚩 Everest Conqueror', '⛰️ Climbing Team', '🧭 The Guide'],
  chuong: ['🔔 Bell Keeper', '💪 Iron Player', '🤝 The Helper'],
};
interface ShowState {
  kind: ShowKind;
  steps: ShowStep[];
  i: number;
  stage: 'ask' | 'reveal';
  qNo: number;
  scores: Map<string, number>;
  tieWin: Set<string>; // right on the tiebreaker: ranked above players with the same points
  players: Set<string>;
  mc: { q: McQ; opts: string[]; ans: number; tag: ShowTag; pts: number } | null;
  answers: Map<string, number>;
  removed: number[]; // hint ticket: 2 wrong options removed
  ticketUser: string;
  stakes: Map<string, number>;
  tickets: Set<string>;
  code: CodeQ | null;
  codeTried: Set<string>;
  codeSolvers: { username: string; pts: number; hint: number }[];
  tied: string[];
  bellRingers: string[];
  helpers: string[];
  honors: { username: string; nickname: string; score: number; title: string }[];
  used: Set<string>;
  lastRight: number; // students right on the last question
}

/**
 * LIVE-CLASS game core: no React, no voice, runs on the clock it is given.
 * The stage page calls chat/gift/like/tick and reads the lines they return; tests in quiz.check.ts.
 *
 * One round: intro → 20 questions, 4 of them math (question → [bonus] → reveal) → results → recess → intro ...
 */

export type Phase = 'team' | 'intro' | 'question' | 'bonus' | 'reveal' | 'praise' | 'results' | 'recess' | 'show' | 'vote';

/** "team 2", "team2", "t2", "2", "team two" -> 2; anything else 0 */
const TEAM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
export function teamOf(comment: string): number {
  const m = /^(?:team|t)?(\d|one|two|three|four)$/.exec(plain(comment));
  const n = m ? (TEAM_WORDS[m[1]] ?? Number(m[1])) : 0;
  return n >= 1 && n <= GAME.teamCount ? n : 0;
}

/** "an 8-letter word", "an 11-letter word", "a 7-letter word" */
const anOf = (n: number) => n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90);

/** Number of ordinary word questions in a class (not math, not the questions with their own slot) */
const PLAIN_SLOTS = GAME.roundPlan.filter((d) => !d.startsWith('math') && !(SLOTS as readonly string[]).includes(d)).length;

/** Bunch size by the gift's coins (GAME.giftTiers): 0 single flower, 1 small bunch, 2 big bunch, 3 flower cart */
/** Gifts listed on the "For Teacher" board (GAME.giftMenu) get their own spoken name + icon, otherwise null */
export function giftOf(giftName = '') {
  const n = giftName.toLowerCase();
  return GAME.giftMenu.find((g) => g.match.some((m) => n.includes(m))) ?? null;
}

export function tierOf(coins: number) {
  let t = 0;
  GAME.giftTiers.forEach((g, i) => {
    if (coins >= g.min) t = i;
  });
  return t;
}

/** Lifetime report card (saved by the server): points, right answers per kind -> grades, badges */
export interface Life {
  points: number;
  total: number; // total right answers
  toan: number;
  su: number;
  meo: number;
  anh: number;
}
export const emptyLife = (): Life => ({ points: 0, total: 0, toan: 0, su: 0, meo: 0, anh: 0 });
/** Grade from lifetime points: 1..12, 13 = graduated (thresholds in GAME.gradePoints) */
export function gradeOf(points: number) {
  let g = 1;
  GAME.gradePoints.forEach((p, i) => {
    if (points >= p) g = i + 1;
  });
  return g;
}
export const gradeLabel = (g: number) => (g > 12 ? 'graduated' : `grade ${g}`);
/** Badges: enough right answers of each kind */
export const BADGES = [
  { key: 'toan', need: 50, icon: '🧮', name: 'Math Whiz' },
  { key: 'su', need: 30, icon: '📜', name: 'Little Historian' },
  { key: 'meo', need: 30, icon: '🤪', name: 'Riddle King' },
  { key: 'anh', need: 30, icon: '🔤', name: 'Spelling Star' },
  { key: 'total', need: 300, icon: '⭐', name: 'Hard Worker' },
] as const;
export const badgesOf = (l: Life) => BADGES.filter((b) => l[b.key] >= b.need);

/** One line of the session report: which question was too hard / too easy */
export interface ReportRow {
  id: string;
  answer: string;
  category: string;
  attempts: number; // students who answered (right + wrong)
  correct: number;
  at: number;
}
export type RecessGame = 'rps' | 'callup' | 'pick' | 'roll' | 'heart' | 'dance';
type RecessStage = 'play' | 'result' | 'board';

export interface Student {
  username: string;
  nickname: string; // banned words filtered
  spoken: string; // name to read out
  avatar: string;
  girl: boolean;
  score: number; // points this class (seating, cleared every class)
  session: number; // points this whole live (class monitor, vice monitor)
  reachedAt: number; // when the current score was reached (ties: whoever got there first ranks higher)
  streak: number;
  lastActive: number;
  joinedAt: number;
  desk: DeskGift[]; // teacher's prizes on the desk (cleared every class)
  days: number; // attendance: day streak (reported by the server, 0 = unknown)
  bubble?: { text: string; at: number }; // latest comment, shown as a bubble above the head
  standLeft: number; // wrong answer = stand up front (when that switch is on): questions left standing
  team: number; // team 1..4 (0 = no team yet, only while teams are being picked)
  life: Life; // lifetime report card (sent by the server on joining, adds up during the session)
  lastTalkAt?: number; // last time a comment counted as interaction (anti-spam)
  /** walked out by the hall monitor for being quiet too long: no seat until they comment again */
  out?: boolean;
  /** place in the seat queue (same points: lower value sits first); joining = join time, walked out and back = return time */
  seatAt: number;
  /** interactions this session (comments, gifts): the hall monitor brings in the most active student */
  talk: number;
  /** brought in by the hall monitor: on equal points sits before students who were not */
  prio: number;
}

export interface DeskGift {
  icon: string;
  at: number; // when the teacher gave it (to draw the gift flying to the desk)
}

export interface Answerer {
  username: string;
  nickname: string;
  avatar: string;
  createTime: number; // TikTok timestamp of when the viewer sent the comment
  seq: number; // order the bot received it (tie-breaker)
  points: number;
}

export interface Say {
  text: string;
  priority?: boolean;
  /** main line (question, answer, summary, recess): jumps ahead, waiting extra lines are dropped */
  main?: boolean;
  /** extra line: dropped if its moment has not come within this many ms (default GAME.chatterMaxWaitMs) */
  ttl?: number;
  /** "time is almost up": said at once but does NOT hold the clock */
  warn?: boolean;
  /** the "go" line: the letter board appears when this line starts (calls showBoard) */
  go?: boolean;
  /** quick mode: the letter board appears when this line (the question) has FINISHED */
  showAfter?: boolean;
}

export interface ChatIn {
  username: string;
  nickname: string;
  spoken: string;
  avatar: string;
  comment: string;
  createTime: number;
  /** false: the comment has a banned word, no bubble */
  safe?: boolean;
  /** false: the comment has no real TikTok timestamp (test button on the control page, TikTok left it out): createTime is the PC clock,
   * NOT used to measure clock skew (before 2026-11-07 it pulled the skew to 0, so right answers were treated as "sent early" and dropped) */
  realTime?: boolean;
}

type Person = Pick<ChatIn, 'username' | 'nickname' | 'spoken' | 'avatar'>;

// Old and new tone-mark placement in Vietnamese count as the same: move the mark to the newer position at the end of a word
const OLD_OA = /o([̣̀́̃̉])([ae])(?!\p{L})/gu;
const OLD_UY = /u([̣̀́̃̉])y(?!\p{L})/gu;
export const normVi = (s: string) =>
  s.normalize('NFD').toLowerCase().replace(OLD_OA, 'o$2$1').replace(OLD_UY, 'uy$1').normalize('NFC');
// Normalise: Unicode NFC, lowercase, no spaces or punctuation, accents KEPT
export const compactVi = (s: string) => normVi(s).replace(/[^\p{L}\p{N}]/gu, '');
// Strip accents too: "Join Class" -> "joinclass"
export const plain = (s: string) =>
  compactVi(s).normalize('NFD').replace(/\p{M}/gu, '').replace(/\u0111/g, 'd');

/** Part of the day by the PC clock: morning 5-10, noon 10-13, afternoon 13-17, evening 17-22, late night 22-5 */
export type DayPeriod = 'sang' | 'trua' | 'chieu' | 'toi' | 'khuya';
export function dayPeriod(now: number): DayPeriod {
  const h = new Date(now).getHours();
  return h >= 5 && h < 10 ? 'sang' : h >= 10 && h < 13 ? 'trua' : h >= 13 && h < 17 ? 'chieu' : h >= 17 && h < 22 ? 'toi' : 'khuya';
}
const PERIOD_LINES = { sang: 'timeMorning', trua: 'timeNoon', chieu: 'timeAfternoon', toi: 'timeEvening', khuya: 'timeNight' } as const;

/** Short topic name to show and read: drop the part in brackets, e.g. "Idioms (fill the gap)" -> "Idioms" */
export const topicName = (category: string) => category.replace(/\s*\(.*\)\s*$/, '');

/** A comment announcing their own birthday ("today is my birthday"), not wishing someone else ("happy birthday") */
export function isBirthday(comment: string) {
  const p = plain(comment);
  return p.includes('birthday') && !p.includes('happy') && !p.includes('wish') && !p.includes('congrat');
}

/** Points by rank among the right answers (0 = fastest) */
export function pointsForRank(rank: number) {
  return GAME.rankPoints[rank] ?? GAME.latePoints;
}

/** Shuffle the letters of the answer (spaces removed), always different from the original order when possible */
export function scramble(answer: string, rand = Math.random): string[] {
  const letters = [...answer.normalize('NFC').toUpperCase().replace(/\s+/g, '')];
  if (new Set(letters).size < 2) return letters;
  let out = letters;
  for (let tries = 0; tries < 10 && out.join('') === letters.join(''); tries++) {
    out = [...letters];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};

/** Draw a line like dealing cards: the whole group is used before repeating, and never the line just read */
export class LineBag {
  private left = new Map<string, number[]>();
  private last = new Map<string, number>();
  constructor(private rand = Math.random) {}
  pick<T>(key: string, list: T[]): T {
    let pool = this.left.get(key);
    if (!pool || pool.length === 0) {
      pool = list.map((_, i) => i);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      if (pool.length > 1 && pool[pool.length - 1] === this.last.get(key)) pool.unshift(pool.pop()!);
      this.left.set(key, pool);
    }
    const i = pool.pop()!;
    this.last.set(key, i);
    return list[i];
  }
}

const RPS = { rock: 'rock', scissors: 'scissors', paper: 'paper' } as const;
type Rps = keyof typeof RPS;
const BEATS: Record<Rps, Rps> = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
const RECESS_GAMES: RecessGame[] = ['rps', 'callup', 'pick', 'roll', 'heart'];

interface Recess {
  game: RecessGame;
  stage: RecessStage;
  rps: Map<string, Rps>;
  teacher: Rps | null;
  callTarget: Student | null;
  callQ: Question | null;
  callTiles: string[];
  callResult: '' | 'right' | 'wrong' | 'silent';
  pick: [string, string];
  votes: Map<string, 1 | 2>;
  roll: Answerer[];
  hearts: number;
  /** dance break: real hearts per student (thank the top sender), mid-break update said or not */
  likers: Map<string, number>;
  cheered: boolean;
}

export class Classroom {
  phase: Phase = 'intro';
  round = 0; // call newRound() to start class 1
  qNo = 0; // question number in this class (1..questionsPerRound)
  phaseStartedAt: number;
  phaseEndsAt: number;
  students = new Map<string, Student>();

  private roundQs: Question[] = [];
  q: Question | null = null;
  tiles: string[] = [];
  revealed = new Set<number>(); // positions of letters already revealed (on the answer without spaces)
  private bonusUsed = false;
  private quietSaid = false;
  correct: Answerer[] = [];
  private tried = new Set<string>(); // who answered this question (right or wrong)
  private wrong = new Set<string>();
  private seq = 0;
  /** current question: received by the bot / answers / answers sent while she was still reading (ignored) / right letters but missing accents (not counted yet, can retype) */
  stats = { received: 0, attempts: 0, early: 0, noMarks: 0 };
  flowers = 0;
  lastFlowerAt = 0;
  clapUntil = 0;
  private lastChatAt: number;
  /** last time a viewer did anything (comment, gift, hearts): too long ago means the class is empty */
  private lastSeenAt: number;
  /** review class: the room is empty, so ask old questions again and save the new ones */
  review = false;
  private lastPeriod = '';
  private lastIdleAt = 0;
  private monitor = ''; // current class monitor: highest points this class (contested again every class)
  /** class monitors of finished classes (newest first), shown on the recess board */
  champions: { round: number; username: string; nickname: string; score: number }[] = [];
  recess: Recess | null = null;
  private lastRecess: RecessGame | null = null;

  /** ids of questions just used; the stage page sends them to the server so they are not asked again soon */
  usedLog: string[] = [];
  /** extra points for the weekly honour roll; the stage page sends them to the server, then clears them */
  weekDelta = new Map<string, { nickname: string; points: number }>();
  /** name of the weekly leader (reported by the server), mentioned now and then */
  weekLeader = '';
  /** questions the owner dropped with "Drop this question": never asked again; banLog is sent to the server, then cleared */
  private banned: Set<string>;
  banLog: { id: string; answer: string; clue: string }[] = [];
  /** report for every question asked, sent to the server, then cleared */
  reportLog: ReportRow[] = [];
  /** vote for the next class's topic (phase 'vote') and the topic the class picked for this class */
  vote: { topics: [string, string]; votes: Map<string, 1 | 2> } | null = null;
  topic = '';
  private lastTopics: string[] = [];
  /** happy birthday: who has been wished already (once per person per session) and the banner showing */
  private birthdayDone = new Set<string>();
  private lastBirthdayAt = -Infinity;
  birthday: { nickname: string; at: number } | null = null;
  /** the owner pressed "Say goodbye" before ending the live */
  goodbyeAt = 0;
  /** "Love the teacher? Type 1": counting who types it (within GAME.loveWindowMs) */
  love: { at: number; fans: string[] } | null = null;
  /** fun poll ("type A or B"): counting votes */
  poll: { at: number; opts: Poll['opts']; votes: Map<string, string> } | null = null;
  private lastLoveAt: number;
  private engageNo = 0;
  /** student walking up with flowers (one at a time), tier = bunch size (0 flower, 1 small bunch, 2 big bunch, 3 flower cart) */
  walk: { username: string; at: number; tier: number; icon: string } | null = null;
  /** today's flower fund (flowers, see flowersToday) and the new part not yet sent to the server */
  private flowerBase = 0;
  flowerDelta = 0;
  /** flower fund milestone just reached (banner + fireworks) */
  fundParty: { goal: number; at: number } | null = null;
  /** gifts the teacher got this session, on the table behind her: tier of each (keeps the newest GAME.giftPileMax) */
  giftPile: { tier: number; icon: string }[] = [];
  /** classes won per team (race flags), index 0 = team 1 */
  teamWins: number[] = Array(GAME.teamCount).fill(0);
  /** team that won the class just finished (shown on the summary board) */
  lastTeamWin: number[] = [];
  private teamReminded = false;
  /** question sets of the 2 big shows (useGame loads them from show-bank/) and the show being played */
  showBank: ShowBank = { mc: [], codes: [] };
  show: ShowState | null = null;
  private showNo = 0;
  /** Ms. Ngan's outfit this class (random change after 20 questions); during a big show she wears the show outfit */
  outfit: (typeof GAME.outfits)[number] = 'trang';
  /** titles earned this session in the 2 big shows (icon on the name tag) */
  titles = new Map<string, string[]>();
  /** lifetime report card: additions waiting to be sent to the server (points, right answers per kind) */
  lifeDelta = new Map<string, { nickname: string } & Life>();
  /** today's chat activity (1 comment = 1, 1 gift = 10, never shown): waiting to be sent to the server */
  talkDelta = new Map<string, { nickname: string; points: number }>();
  /** grade-up / new badge congratulations: said on the next tick */
  private announce: Say[] = [];
  private cardAt = new Map<string, number>();
  private lastCardAt = -Infinity;

  readonly lines: LineBag;

  constructor(
    private bank: Question[],
    now: number,
    private rand = Math.random,
    private history: Record<string, number> = {}, // question id -> last time asked (ms)
    banned: Iterable<string> = [],
  ) {
    this.banned = new Set(banned);
    this.lines = new LineBag(rand);
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + GAME.introSec * 1000;
    this.lastChatAt = now;
    this.lastSeenAt = now;
    this.lastLoveAt = now;
  }

  /** Empty class: nobody commented, sent a gift or hearts for GAME.emptyRoomMs */
  isEmpty(now: number) {
    return now - this.lastSeenAt > GAME.emptyRoomMs;
  }

  /** One teacher line (female voice) */
  private t(text: string, priority = false): Say {
    // the teacher's name can be changed on the control page: lines written with "Ms. Ngan" use the new name
    return { text: `F: ${teacherText(text, this.teacherName, this.thay)}`, priority };
  }
  teacherName = GAME.defaultRoom.teacherName;
  /** a male teacher is teaching: lines say "Mr." instead of "Ms." */
  thay = false;
  /** hall monitor (class settings): on/off, how long a student may stay quiet before being walked out */
  supervisorOn = false;
  supervisorIdleMs = GAME.defaultRoom.supervisorMin * 60_000;
  /** dance break with hearts at recess (class settings) */
  dance: RoomCfg['dance'] = 'off';
  danceSec = GAME.defaultRoom.danceSec;
  /** wrong answer = stand up front (switch in Class settings) */
  standWrong = GAME.standWrong;
  /** stand-up switch: turned off mid-class, everyone standing goes back to their seat */
  setStandWrong(on: boolean) {
    this.standWrong = on;
    if (!on) for (const s of this.students.values()) s.standLeft = 0;
  }
  /** the hall monitor is walking one student out and another one in */
  escort: { at: number; out: Student; seat: number; in: Student | null } | null = null;
  private lastEscortAt = -Infinity;
  private lastEscortSayAt = -Infinity;
  /** the 2 big shows that are switched on (control page) */
  showsOn: Record<ShowKind, boolean> = { everest: true, chuong: true };
  /** next big show: alternating, skipping a show that is off; both off = null (recess instead) */
  private nextKind(): ShowKind | null {
    const first: ShowKind = this.showNo % 2 === 0 ? 'everest' : 'chuong';
    const other: ShowKind = first === 'everest' ? 'chuong' : 'everest';
    return this.showsOn[first] ? first : this.showsOn[other] ? other : null;
  }
  /** mark as a main line */
  private mainOf(lines: Say[]): Say[] {
    return lines.map((l) => ({ ...l, main: true }));
  }
  private line0(key: keyof typeof LINES) {
    return this.t(this.lines.pick(key, LINES[key] as string[]));
  }
  private line(key: keyof typeof LINES, ...args: string[]) {
    const fn = this.lines.pick(key, LINES[key] as ((...a: string[]) => string)[]);
    return fn(...args);
  }

  // ---------- players ----------
  private touch(e: Person, now: number) {
    this.lastSeenAt = now;
    this.clock = Math.max(this.clock, now);
    let s = this.students.get(e.username);
    if (!s) {
      s = { ...e, girl: hash(e.username) % 2 === 0, score: 0, session: 0, reachedAt: 0, streak: 0, lastActive: now, joinedAt: now, desk: [], days: 0, standLeft: 0, team: 0, life: emptyLife(), seatAt: now, talk: 0, prio: 0 };
      // joined mid-class: put straight into the smallest team (while teams are being picked they choose themselves, at the end the teacher assigns)
      if (GAME.teamPickSec > 0 && this.phase !== 'team') s.team = this.smallestTeam(now);
      this.students.set(e.username, s);
    } else {
      s.nickname = e.nickname;
      s.spoken = e.spoken;
      if (e.avatar) s.avatar = e.avatar;
      s.lastActive = now;
      // walked out by the hall monitor and back again: end of the seat queue
      if (s.out) {
        s.out = false;
        s.seatAt = now;
        s.prio = 0;
      }
    }
    return s;
  }

  /** Add points: `inClass` = class points (seating); every point also goes to the session + the weekly board */
  private award(s: Student, points: number, now: number, inClass: boolean) {
    if (inClass) {
      s.score += points;
      s.reachedAt = now;
    }
    s.session += points;
    const w = this.weekDelta.get(s.username) ?? { nickname: s.nickname, points: 0 };
    w.nickname = s.nickname;
    w.points += points;
    this.weekDelta.set(s.username, w);
    // lifetime report card: enough points means a new grade, the teacher congratulates + a graduation cap 🎓 on the desk
    const before = gradeOf(s.life.points);
    this.addLife(s, { points });
    const after = gradeOf(s.life.points);
    if (after > before && s.spoken !== 'friend') {
      s.desk = [...s.desk, { icon: '🎓', at: now }].slice(-GAME.deskGifts);
      this.clapUntil = now + GAME.clapSec * 1000;
      this.announce.push({ ...this.t(this.line('gradeUp', s.spoken, gradeLabel(after)), true), ttl: 60_000 });
    }
  }

  /** Add to the report card (the student in class and the part waiting for the server) */
  private addLife(s: Student, add: Partial<Life>) {
    const d = this.lifeDelta.get(s.username) ?? { nickname: s.nickname, ...emptyLife() };
    d.nickname = s.nickname;
    for (const k of Object.keys(add) as (keyof Life)[]) {
      s.life[k] += add[k]!;
      d[k] += add[k]!;
    }
    this.lifeDelta.set(s.username, d);
  }

  /** One right answer: counted in the report card by kind, enough of them earns a new badge */
  private countCorrect(s: Student, q: Question) {
    const kind: keyof Life | null = q.math ? 'toan' : q.slot === 'su' || q.slot === 'meo' || q.slot === 'anh' ? q.slot : null;
    const had = new Set(badgesOf(s.life).map((b) => b.key));
    this.addLife(s, kind ? { total: 1, [kind]: 1 } : { total: 1 });
    for (const b of badgesOf(s.life)) {
      if (!had.has(b.key) && s.spoken !== 'friend') this.announce.push({ ...this.t(this.line('badgeNew', s.spoken, `${b.icon} ${b.name}`), true), ttl: 60_000 });
    }
  }

  /** Typing "reportcard": the teacher reads the grade, points, right answers, badges (each student once per 5 min, whole class once per 15 s) */
  private reportCard(s: Student, now: number): Say[] {
    if (now - (this.cardAt.get(s.username) ?? -Infinity) < 5 * 60_000 || now - this.lastCardAt < 15_000 || s.spoken === 'friend') return [];
    this.cardAt.set(s.username, now);
    this.lastCardAt = now;
    const l = s.life;
    const badges = badgesOf(l).map((b) => b.name);
    const days = s.days >= 2 ? ` ${s.days} days in a row at school.` : '';
    const text =
      `Here is ${s.spoken}'s report card: ${gradeLabel(gradeOf(l.points))}, ${l.points} points, ${l.total} correct answers.` +
      days +
      (badges.length ? ` Badges: ${badges.join(', ')}.` : ' No badges yet, keep going!');
    return [{ ...this.t(text, true), ttl: 30_000 }];
  }

  /** The teacher gives a gift: placed on the student's desk, returns the gift name for her to read */
  private giveGift(s: Student, now: number): string {
    const g = REWARDS[Math.floor(this.rand() * REWARDS.length)];
    s.desk = [...s.desk, { icon: g.icon, at: now }].slice(-GAME.deskGifts);
    return g.name;
  }

  private monitorSaidQ = -99;
  /** The teacher announces a new class monitor */
  private checkMonitor(): Say[] {
    const top = this.seats(1)[0];
    if (!top || top.score <= 0 || top.username === this.monitor) return [];
    const first = this.monitor === '';
    this.monitor = top.username;
    // the first student to score this class is not announced (she just praised them), only later changes are;
    // when it keeps changing, at most once every GAME.monitorEveryQ questions (less talking)
    if (first || this.qNo - this.monitorSaidQ < GAME.monitorEveryQ) return [];
    this.monitorSaidQ = this.qNo;
    return [this.t(this.line('newMonitor', top.spoken))];
  }


  /**
   * seats: high class points sit at the front; on equal points, students still active (a comment within 10 minutes) sit before long-quiet ones
   * (who usually left the live), then whoever got there first, then session points, then join order (so seats do not jump around)
   */
  seats(n = GAME.seats): Student[] {
    const away = (s: Student) => (this.clock - s.lastActive > GAME.seatActiveMs ? 1 : 0);
    return [...this.students.values()]
      .filter((s) => !s.out)
      .sort((a, b) => b.score - a.score || away(a) - away(b) || b.prio - a.prio || a.reachedAt - b.reachedAt || b.session - a.session || a.seatAt - b.seatAt)
      .slice(0, n);
  }
  /** time of the latest tick (so seating knows who has been quiet for long) */
  private clock = 0;

  // ---------- teams ----------
  /** Active players per team (a comment within 10 minutes; students who left the live do not count when balancing) */
  private teamSizes(now: number) {
    const n = Array(GAME.teamCount).fill(0);
    for (const s of this.students.values()) if (s.team && now - s.lastActive <= GAME.seatActiveMs) n[s.team - 1]++;
    return n;
  }
  /** Smallest team (ties are drawn at random) */
  private smallestTeam(now: number) {
    const n = this.teamSizes(now);
    const min = Math.min(...n);
    const ties = n.flatMap((x, i) => (x === min ? [i + 1] : []));
    return ties[Math.floor(this.rand() * ties.length)];
  }
  /** Team race: this class's points of the whole team (sum of each student), team size, flags won */
  teamStats(now: number) {
    const sizes = this.teamSizes(now);
    const score = Array(GAME.teamCount).fill(0);
    for (const s of this.students.values()) if (s.team) score[s.team - 1] += s.score;
    return score.map((sc, i) => ({ no: i + 1, score: sc, members: sizes[i], wins: this.teamWins[i] }));
  }
  private teamCountsText(now: number) {
    return this.teamSizes(now).map((n, i) => `Team ${i + 1}, ${n} ${n === 1 ? 'student' : 'students'}.`).join(' ');
  }
  private teamChat(s: Student, e: ChatIn): Say[] {
    const n = teamOf(e.comment);
    if (n) s.team = n; // changing your mind while teams are picked: the last pick counts
    return [];
  }
  /** Team pick time over: sweep the whole class, everyone without a team goes to the smallest team (nobody left out), then class starts */
  private closeTeams(now: number): Say[] {
    let auto = 0;
    // place active players first so the teams are even, then the long-quiet ones
    const left = [...this.students.values()].filter((s) => !s.team).sort((a, b) => b.lastActive - a.lastActive);
    for (const s of left) {
      s.team = this.smallestTeam(now);
      auto++;
    }
    const b = auto ? `I put ${auto} ${auto === 1 ? 'student' : 'students'} without a team into the smallest teams.` : 'Everyone has a team.';
    this.setPhase('intro', now, GAME.introSec);
    return this.mainOf([this.t(this.line('teamClose', this.teamCountsText(now), b)), this.review ? this.line0('reviewIntro') : this.line0('intro'), ...this.showSoon()]);
  }
  /** End of class: the team with the most points wins a race flag (tied teams all win) */
  private teamResult(now: number): Say[] {
    if (GAME.teamPickSec <= 0) return [];
    const st = this.teamStats(now);
    const best = Math.max(...st.map((t) => t.score));
    this.lastTeamWin = best > 0 ? st.filter((t) => t.score === best).map((t) => t.no) : [];
    for (const no of this.lastTeamWin) this.teamWins[no - 1]++;
    if (!this.lastTeamWin.length) return [this.line0('teamNobody')];
    return [this.t(this.line('teamWin', this.lastTeamWin.map((n) => `team ${n}`).join(' and '), String(best)))];
  }

  sessionTop(n: number): Student[] {
    return [...this.students.values()].filter((s) => s.session > 0).sort((a, b) => b.session - a.session || a.joinedAt - b.joinedAt).slice(0, n);
  }

  // ---------- picking questions ----------
  /** Pick the longest-unasked question for the difficulty, avoiding 2 questions in a row on one topic and more than 2 per topic per class */
  /** `difficulty` = 'meo' / 'su': draw a riddle / history question; otherwise an ordinary word question (never one with its own slot) */
  private pickOne(difficulty: Question['difficulty'] | Slot, taken: Question[], now: number, topic = ''): Question | null {
    const used = new Set(taken.map((q) => q.id));
    const perCat = (c: string) => taken.filter((q) => q.category === c).length;
    const prev = taken[taken.length - 1]?.category;
    const slot = (SLOTS as readonly string[]).includes(difficulty) ? difficulty : undefined;
    const kind = (q: Question) => q.slot === slot && !this.banned.has(q.id) && !used.has(q.id);
    let pool = this.bank.filter((q) => kind(q) && (slot || q.difficulty === difficulty));
    // topic the class voted for: take from that topic first (same difficulty, then any difficulty)
    const fav = topic ? pool.filter((q) => q.category === topic) : [];
    const favAny = topic && !fav.length ? this.bank.filter((q) => kind(q) && q.category === topic) : [];
    if (fav.length || favAny.length) pool = fav.length ? fav : favAny;
    else {
      const nice = pool.filter((q) => q.category !== prev && perCat(q.category) < 2);
      if (nice.length) pool = nice;
    }
    if (!pool.length) pool = this.bank.filter((q) => kind(q));
    if (!pool.length) return null;
    // shuffle first, then sort by last time asked: never-asked questions first, the order in the file does not matter
    const at = (q: Question) => this.history[q.id] ?? 0;
    pool = [...pool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => at(a) - at(b));
    let q = pool[0];
    // this edition: most word questions come from the Gen Z / office / food-and-love sets, but only among the
    // longest-unasked questions (same last-asked time as pool[0]): when the hot sets run out of new questions take new ones from other sets, never repeat old ones
    if (!slot && !fav.length && !favAny.length && this.rand() < GAME.hotShare) {
      const hot = pool.find((x) => at(x) === at(pool[0]) && (GAME.hotTopics as readonly string[]).includes(x.id.split(':')[0]));
      if (hot) q = hot;
    }
    this.history[q.id] = now;
    this.usedLog.push(q.id);
    return q;
  }

  /** Empty class: ask a question asked before (random), not written to the book, saving new questions for when people are here */
  private pickReview(difficulty: Question['difficulty'] | Slot, taken: Question[]): Question | null {
    const used = new Set(taken.map((q) => q.id));
    const slot = (SLOTS as readonly string[]).includes(difficulty) ? difficulty : undefined;
    const pool = this.bank.filter(
      (q) => q.slot === slot && (slot || q.difficulty === difficulty) && (this.history[q.id] ?? 0) > 0 && !this.banned.has(q.id) && !used.has(q.id),
    );
    return pool.length ? pool[Math.floor(this.rand() * pool.length)] : null;
  }

  /** Draw the questions for a class. `from`: keep the questions before this position (review class and someone joins: the rest become new questions) */
  private pickRound(now: number, from = 0) {
    const out: Question[] = this.roundQs.slice(0, from);
    let plain = 0; // order of word questions in the class
    let fav = 0; // questions taken from the topic the class voted for
    for (const [i, d] of GAME.roundPlan.entries()) {
      if (i < from) {
        if (!d.startsWith('math') && !(SLOTS as readonly string[]).includes(d)) plain++;
        continue;
      }
      let q: Question | null;
      // empty class: review with old questions (math is still generated); no old questions yet means new ones as usual
      const old = this.review && !d.startsWith('math') ? this.pickReview(d as Question['difficulty'] | Slot, out) : null;
      if (old) {
        out.push(old);
        if (!(SLOTS as readonly string[]).includes(d)) plain++;
        continue;
      }
      // generated math, not counted as a topic, so the word questions before and after it still differ in topic
      if (d.startsWith('math')) q = makeMath(Number(d.slice(4)) as MathLevel, this.rand);
      else if ((SLOTS as readonly string[]).includes(d)) q = this.pickOne(d as Slot, out.filter((x) => !x.math), now);
      else {
        // topic the class voted for: at most GAME.voteTopicQuestions from it; with many word questions take every other one,
        // with few (this edition has only 5 ordinary word questions) take them in a row
        const step = PLAIN_SLOTS >= 2 * GAME.voteTopicQuestions ? 2 : 1;
        const useTopic = this.topic && plain % step === 0 && fav < GAME.voteTopicQuestions ? this.topic : '';
        q = this.pickOne(d as Question['difficulty'], out.filter((x) => !x.math), now, useTopic);
        if (useTopic && q?.category === useTopic) fav++;
        plain++;
      }
      if (q) out.push(q);
    }
    this.roundQs = out;
  }

  get golden() {
    return this.qNo > 0 && this.qNo === this.roundQs.length && this.roundQs.length >= GAME.questionsPerRound;
  }

  private lettersOf(q: Question | null) {
    return q ? [...q.answer.normalize('NFC').toUpperCase().replace(/\s+/g, '')] : [];
  }
  get answerLetters() {
    return this.lettersOf(this.q);
  }

  /** Answer boxes per letter: null = not revealed, ' ' = gap between two words */
  slotsOf(q: Question | null, revealed: Set<number>, showAll: boolean): (string | null)[] {
    if (!q) return [];
    const out: (string | null)[] = [];
    let i = 0;
    for (const ch of q.answer.normalize('NFC').toUpperCase().trim()) {
      if (/\s/.test(ch)) {
        if (out[out.length - 1] !== ' ') out.push(' ');
        continue;
      }
      out.push(showAll || revealed.has(i) ? ch : null);
      i++;
    }
    return out;
  }
  slots(showAll = false) {
    return this.slotsOf(this.q, this.revealed, showAll);
  }

  /** Reveal one more letter (never more than letters - 2). Returns false if no letter can be revealed */
  revealOne(): boolean {
    const n = this.answerLetters.length;
    if (this.revealed.size >= Math.max(0, n - GAME.keepHiddenLetters)) return false;
    const hidden = [...Array(n).keys()].filter((i) => !this.revealed.has(i));
    this.revealed.add(hidden[Math.floor(this.rand() * hidden.length)]);
    return true;
  }

  private setPhase(p: Phase, now: number, sec: number) {
    this.phase = p;
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + sec * 1000;
    this.heldMs = 0;
    this.warned = false;
    if (p !== 'bonus') this.chatterUsed = 0; // extra time shares the line quota of the current question
  }

  /** extra (non-priority) lines the teacher said in this part; GAME.chatterPerPhase is the cap */
  chatterUsed = 0;
  /** may she still say an extra line: priority lines (gift thanks, birthday, grade up) always may, ordinary ones up to the cap */
  chatterAllowed(priority: boolean) {
    return priority || this.chatterUsed < GAME.chatterPerPhase;
  }

  private warned = false; // has "time is almost up" been said in this part

  private heldMs = 0;
  /** The teacher is reading a main line: hold this part's clock (the answer time only starts after the question). Capped so it never gets stuck. */
  hold(ms: number) {
    const add = Math.max(0, Math.min(ms, GAME.maxHoldMs - this.heldMs));
    this.heldMs += add;
    this.phaseStartedAt += add;
    this.phaseEndsAt += add;
    if (this.phase === 'question') this.answerStartAt += add; // the answer time only starts after the question has been read
  }

  /** when the answer time of the current question started (after she said go), PC clock */
  private answerStartAt = 0;
  /** PC clock minus TikTok clock (PC receive time - TikTok send time), moving average */
  private clockSkew = 0;
  private skewSamples = 0;

  /** Is the letter board (shuffled letters / sum) showing: after the question is read and she says go */
  boardShown = false;
  showBoard(now = this.clock) {
    if (!this.boardShown) this.boardShownAt = now;
    this.boardShown = true;
  }
  /** when the letter board appeared (PC clock): answers SENT before this were typed while she was still reading, they do not count */
  private boardShownAt = 0;

  /** Time for an extra line (greeting, thanks, teasing): waiting for answers (or a mid-class break) with enough time left */
  chatterWindow(now: number) {
    const left = this.phaseEndsAt - now;
    const answering =
      this.phase === 'question' ||
      this.phase === 'bonus' ||
      this.phase === 'praise' ||
      this.phase === 'vote' ||
      this.phase === 'team' ||
      this.showAsking() ||
      (this.phase === 'recess' && this.recess?.stage === 'play');
    return answering && left > GAME.chatterMinLeftMs;
  }

  /** What the teacher says before the clue: "A 5-letter word. It's a food." (the letters appear on the board after go) */
  intro(q: Question) {
    if (q.math) return q.kind;
    // quick mode (reading approved by the owner 2026-11-05): "A 7-letter word." then the clue, without the set's general intro.
    // Spelling: "Spelling! A 5-letter word." History and emoji puzzles keep their own wording
    // ("A king, 11 letters.", "Emoji puzzle! An idiom, 14 letters.")
    if (GAME.quickRead) {
      const n = this.lettersOf(q).length;
      const A = anOf(n) ? 'An' : 'A';
      const named = /^This is\s+/i.test(q.kind) ? `${q.kind.replace(/[.!\s]+$/, '')}, ${n} letters.` : `${A} ${n}-letter word.`;
      if (q.slot === 'dh') return `Emoji puzzle! ${named}`;
      if (q.slot === 'su') return named;
      if (q.slot === 'anh') return `Spelling! ${A} ${n}-letter word.`;
      return `${A} ${n}-letter word.`;
    }
    const n = this.lettersOf(q).length;
    const a = anOf(n) ? 'an' : 'a';
    const word = q.slot === 'anh' ? `${a} ${n}-letter spelling word` : `${a} ${n}-letter word`;
    const kind = /^This is\s+/i.exec(q.kind);
    // emoji puzzle: "Emoji puzzle! A 12-letter word, an idiom."
    const dh = q.slot === 'dh' ? 'Emoji puzzle! ' : '';
    // "It's a food." -> "A 5-letter word. It's a food."
    if (kind) return `${dh}This is ${word}: ${q.kind.slice(kind[0].length)}`;
    // "History time." -> "History time. An 8-letter word."
    return `${dh}${q.kind} It is ${word}.`;
  }

  private startQuestion(now: number): Say[] {
    this.qNo++;
    // review class and someone joins: the rest of the class switches to new questions
    const back: Say[] = [];
    if (this.review && !this.isEmpty(now) && this.roundQs.length === GAME.roundPlan.length) {
      this.review = false;
      this.pickRound(now, this.qNo - 1);
      back.push(this.line0('reviewEnd'));
    }
    this.q = this.roundQs[this.qNo - 1] ?? null;
    if (!this.q) return this.startResults(now, true);
    // Outfit changes with the 4 stages (Term 1: Q1-5 -> white, Term 2: Q6-10 -> shirt, Terms 3 & 4: Q11-20 -> jade ao dai)
    if (this.qNo <= 5) this.outfit = 'trang';
    else if (this.qNo <= 10) this.outfit = 'so-mi';
    else this.outfit = 'ao-dai-xanh-ngoc';
    // math shows the sum, emoji puzzles show emoji: no shuffled letters
    this.tiles = this.q.math || this.q.slot === 'dh' ? [] : scramble(this.q.answer, this.rand);
    this.boardShown = false;
    this.revealed = new Set();
    // emoji puzzle: the first letter of each word is shown in the answer boxes so players have something to hold on to (owner 2026-11-05)
    if (this.q.slot === 'dh' && GAME.dhFirstLetters) {
      let i = 0;
      for (const w of this.q.answer.trim().split(/\s+/)) {
        this.revealed.add(i);
        i += [...w.normalize('NFC')].length;
      }
    }
    this.bonusUsed = false;
    this.quietSaid = false;
    this.correct = [];
    this.tried = new Set();
    this.wrong = new Set();
    this.stats = { received: 0, attempts: 0, early: 0, noMarks: 0 };
    this.setPhase('question', now, GAME.questionSec);
    this.answerStartAt = now;
    const out: Say[] = [...back];
    if (this.golden) out.push(this.line0('goldenIntro'));
    else if (this.q.math && !GAME.quickRead) out.push(this.line0('mathIntro'));
    // emoji puzzle: the emoji are not read out, she just asks everyone to look
    const clue = this.q.slot === 'dh' ? (GAME.quickRead ? 'Look at the picture and guess!' : 'Look at the picture and guess the word, class.') : this.q.clue;
    // riddle segment (2 riddles in a row mid-class): a funny intro before the first, a short "riddle number two" before the second
    const prevSlot = this.roundQs[this.qNo - 2]?.slot;
    if (this.q.slot === 'meo' && prevSlot !== 'meo') {
      out.push(this.line0('riddleSegment'));
      out.push(this.t(`Question ${this.qNo}. ${clue}`));
    } else if (this.q.slot === 'meo') {
      out.push(this.t(`Question ${this.qNo}. ${this.line0('riddleSecond').text.slice(3)} ${clue}`));
    } else out.push(this.t(`Question ${this.qNo}. ${this.intro(this.q)} ${clue}`));
    // quick mode: short question, no "go"; when she finishes reading the letter board shows, answers count, the clock runs
    // (owner 2026-11-04: showing the board while she is still reading lets players guess early, which is unfair)
    if (GAME.quickRead) {
      out[out.length - 1] = { ...out[out.length - 1], showAfter: true };
      return this.mainOf(out);
    }
    // after the question she says go (only then the letter board shows); the clock is held while she talks, so it starts after go
    out.push({ ...this.line0('go'), go: true });
    return this.mainOf(out);
  }

  private matches(q: Question | null, comment: string) {
    if (!q) return false;
    const key = GAME.requireDiacritics ? compactVi : plain;
    const typed = key(comment);
    return [q.answer, ...(q.acceptedAnswers ?? [])].some((a) => key(a) === typed);
  }

  /** typed the right letters WITHOUT any accents. Wrong accents do not count here: still a wrong answer */
  private matchesPlain(q: Question | null, comment: string) {
    if (!q) return false;
    const typed = plain(comment);
    if (compactVi(comment) !== typed) return false; // has accents (even wrong ones)
    return [q.answer, ...(q.acceptedAnswers ?? [])].some((a) => plain(a) === typed);
  }

  /** Is the comment an answer: same length as the answer (spaces ignored). Ordinary chat never counts as wrong */
  private isAttempt(q: Question | null, comment: string) {
    const n = compactVi(comment).length;
    return !!q && [q.answer, ...(q.acceptedAnswers ?? [])].some((a) => compactVi(a).length === n);
  }

  // ---------- events ----------
  chat(e: ChatIn, now: number): Say[] {
    const s = this.touch(e, now);
    this.lastChatAt = now;
    // TikTok clock vs PC clock: take the smallest recent value (least network delay), creeping up slowly to follow clock drift
    const sample = now - e.createTime;
    if (e.realTime !== false && Number.isFinite(sample) && Math.abs(sample) < 10 * 60_000) {
      this.clockSkew = this.skewSamples++ === 0 ? sample : Math.min(sample, this.clockSkew + 5);
    }
    // chat bubble: never show an answer (it would give it away) or a comment with a banned word
    const asking = this.phase === 'question' || this.phase === 'bonus';
    const answering =
      (asking && this.isAttempt(this.q, e.comment)) ||
      (this.recess?.game === 'callup' && this.isAttempt(this.recess.callQ, e.comment)) ||
      (this.phase === 'show' && this.isShowAnswer(e.comment));
    if (e.safe !== false && !answering && e.comment.trim()) s.bubble = { text: e.comment.trim().slice(0, 28), at: now };
    // interaction: 1 comment = 1 (each student at most once per 2 s, so spamming does not climb the board)
    if (now - (s.lastTalkAt ?? -Infinity) >= GAME.talkGapMs) {
      s.lastTalkAt = now;
      this.addTalk(s, 1);
    }
    // answering a question whose answer is "birthday": grade it, it is not a birthday announcement
    if (!answering && isBirthday(e.comment)) return this.celebrate(s, now);
    if (!answering && plain(e.comment) === 'reportcard') return this.reportCard(s, now);
    // "Love the teacher? Type 1" is running: note the name (no clash with word answers, which are never 1 letter long)
    if (this.love && now - this.love.at < GAME.loveWindowMs && plain(e.comment) === '1' && !this.love.fans.includes(s.username)) {
      this.love.fans.push(s.username);
    }
    // fun poll running: typing exactly the 1-letter option (word answers are at least 2 letters, so no mix-up)
    const key = plain(e.comment);
    if (this.poll && now - this.poll.at < GAME.loveWindowMs && this.poll.opts.some((o) => o.key === key) && !this.poll.votes.has(s.username)) {
      this.poll.votes.set(s.username, key);
    }
    if (this.phase === 'team') return this.teamChat(s, e);
    if (this.phase === 'show') return this.showChat(s, e, now);
    if (this.phase === 'vote') return this.voteChat(s, e);
    if (this.phase === 'recess') return this.recessChat(s, e, now);
    if (this.phase !== 'question' && this.phase !== 'bonus') return [];
    this.stats.received++;
    // she has not finished reading (no letter board yet): early answers do not count and do not use up the turn
    if (GAME.quickRead && !this.boardShown) return [];
    // sent while she was still reading but arrived late (after the board showed): judged by the TikTok send time (converted to the PC clock), does not count,
    // does not use up the turn. Real viewers see the board a few seconds later on their phone, so they always send after this point (owner 2026-11-05)
    // Only comments arriving in the first few seconds after the board shows are checked (earlier ones are only late because of the network):
    // if the clock skew is measured wrong it only affects those first seconds, never the whole question (fixed 2026-11-07)
    if (
      GAME.quickRead &&
      this.phase === 'question' &&
      e.realTime !== false &&
      this.skewSamples > 1 &&
      now - this.boardShownAt < GAME.earlyCheckWindowMs &&
      e.createTime + this.clockSkew < this.boardShownAt - GAME.earlySendGraceMs
    ) {
      if (this.isAttempt(this.q, e.comment)) this.stats.early++;
      return [];
    }
    if (!this.isAttempt(this.q, e.comment) || this.tried.has(e.username)) return [];
    // right letters but missing accents: not counted yet, does NOT use up the turn, retyping with accents works (2026-11-07: it used to use up the turn,
    // so viewers thought they were right but got nothing)
    if (GAME.requireDiacritics && !this.matches(this.q, e.comment) && this.matchesPlain(this.q, e.comment)) {
      this.stats.noMarks++;
      return [];
    }
    this.tried.add(e.username);
    this.stats.attempts++;
    if (!this.matches(this.q, e.comment)) {
      this.wrong.add(e.username);
      return [];
    }
    this.correct.push({ username: e.username, nickname: e.nickname, avatar: e.avatar, createTime: e.createTime, seq: ++this.seq, points: 0 });
    // ranked by the TikTok timestamp, not by when the bot received it (comments can arrive out of order)
    this.correct.sort((a, b) => a.createTime - b.createTime || a.seq - b.seq);
    const mult = this.golden ? 2 : 1;
    this.correct.forEach((a, i) => (a.points = pointsForRank(i) * mult));
    // enough top-N right answers (the high-scoring ranks): close the question a few seconds later instead of waiting the full 20 s
    if (GAME.closeAfterTopN > 0 && this.correct.length === GAME.closeAfterTopN) {
      this.phaseEndsAt = Math.min(this.phaseEndsAt, now + GAME.closeAfterTopSec * 1000);
    }
    if (this.correct.length === 1) {
      // quiet room (few active players): someone got it right, close early instead of waiting the full 20 s
      const endAfter = this.activePlayers(now) < GAME.smallRoomPlayers ? GAME.smallRoomEndAfterSec : GAME.endAfterFirstSec;
      if (endAfter > 0) this.phaseEndsAt = Math.min(this.phaseEndsAt, now + endAfter * 1000);
      const fast = now - this.phaseStartedAt < GAME.superFastSec * 1000;
      if (!fast && this.rand() < GAME.giftChance) {
        return [{ ...this.t(this.line('firstCorrectGift', e.spoken, this.giveGift(s, now))), ttl: 6000 }];
      }
      // super fast: over-the-top praise by question kind (math: math genius, spelling: word king/queen), priority so it is always said
      if (fast) {
        const key = this.q?.math ? 'superFastMath' : this.q?.slot === 'anh' ? 'superFastEnglish' : 'superFast';
        return [{ ...this.t(this.line(key, e.spoken), true), ttl: 8000 }];
      }
      return [{ ...this.t(this.line('firstCorrect', e.spoken)), ttl: 6000 }];
    }
    return [];
  }

  /** Active players: commented in the last 2 minutes */
  activePlayers(now: number) {
    let n = 0;
    for (const s of this.students.values()) if (now - s.lastActive < GAME.activeWindowMs) n++;
    return n;
  }

  /** Happy birthday: cake on the desk, the class claps, banner. Once per student per session, at least 1 minute apart */
  /** "Say goodbye" button (control page): the teacher says goodbye, thanks this class's leader (if any), end-of-class banner + applause */
  goodbye(now: number): Say[] {
    this.goodbyeAt = now;
    this.clapUntil = now + GAME.clapSec * 1000;
    const top = this.seats(1)[0];
    const line = top && top.score > 0 && top.spoken !== 'friend' ? this.line('goodbyeTop', top.spoken) : this.line0('goodbye').text.slice(3);
    return this.mainOf([this.t(line)]);
  }

  celebrate(s: Person, now: number): Say[] {
    const st = this.touch(s, now);
    if (this.birthdayDone.has(st.username) || now - this.lastBirthdayAt < GAME.birthdayCooldownMs) return [];
    this.birthdayDone.add(st.username);
    this.lastBirthdayAt = now;
    this.birthday = { nickname: st.nickname, at: now };
    st.desk = [...st.desk, { icon: '🎂', at: now }].slice(-GAME.deskGifts);
    this.clapUntil = now + GAME.clapSec * 1000;
    // said while waiting for answers (extra line), priority like gift thanks, never interrupts a question
    return [this.t(this.line('birthday', st.spoken), true)];
  }

  /** Attendance: the server reports this student's day streak. From day 2 the teacher recognises them, nice milestones get a gift */
  attendance(e: Person, days: number, now: number, life?: Life): Say[] {
    const s = this.touch(e, now);
    s.days = days;
    // lifetime report card from the server (plus what was added this session and the server has not got yet)
    if (life) {
      const pending = this.lifeDelta.get(s.username);
      for (const k of Object.keys(s.life) as (keyof Life)[]) s.life[k] = (Number(life[k]) || 0) + (pending?.[k] ?? 0);
    }
    if (days < 2 || s.spoken === 'friend') return [];
    if (GAME.attendMilestones.includes(days) || (days > 30 && days % 10 === 0)) {
      return [{ ...this.t(this.line('attendMilestone', s.spoken, String(days), this.giveGift(s, now)), true), ttl: 60_000 }];
    }
    return [{ ...this.t(this.line('attendBack', s.spoken, String(days))), ttl: 30_000 }];
  }

  /** "Drop this question" button: a broken question is dropped, written to the book so it is never asked again, next question with no points */
  banCurrent(now: number): Say[] {
    const asking = this.phase === 'question' || this.phase === 'bonus' || this.phase === 'reveal';
    if (!asking || !this.q || this.q.math) return [];
    this.banned.add(this.q.id);
    this.banLog.push({ id: this.q.id, answer: this.q.answer, clue: this.q.clue });
    this.correct = [];
    this.wrong = new Set();
    return [...this.mainOf([this.line0('banned')]), ...this.afterQuestion(now)];
  }

  /** Add today's chat activity (Top chatters board, how it is counted is not shown) */
  private addTalk(s: Student, n: number) {
    s.talk += n;
    const d = this.talkDelta.get(s.username) ?? { nickname: s.nickname, points: 0 };
    d.nickname = s.nickname;
    d.points += n;
    this.talkDelta.set(s.username, d);
  }

  /** Gifts: always flowers for the teacher, each gift = 10 interaction points (never said). `count` = number of items (combo) */
  gift(e: Person, coins: number, now: number, count = 1, giftName = ''): Say[] {
    const s = this.touch(e, now);
    this.addTalk(s, GAME.talkPerGift * Math.max(1, count));
    this.flowers++;
    this.lastFlowerAt = now;
    // the teacher's flower fund today: 1 coin = 1 flower; passing a milestone she thanks the class + fireworks
    const bong = Math.max(1, coins);
    const before = this.flowersToday;
    this.flowerBase += bong;
    this.flowerDelta += bong;
    const out: Say[] = [];
    const reached = GAME.flowerGoals.filter((g) => before < g && this.flowersToday >= g).pop();
    if (reached) {
      this.fundParty = { goal: reached, at: now };
      this.clapUntil = now + GAME.clapSec * 1000;
      out.push({ ...this.t(this.line('fundGoal', String(reached))), warn: true });
    }
    // the student walks up with the flowers and she thanks them at once (if someone is already walking, skip, so combos do not crowd)
    const tier = tierOf(coins);
    // gifts on the "For Teacher" board: she thanks them by the gift's name, the student carries that very gift (rose, heart, donut)
    const known = giftOf(giftName);
    const icon = known?.icon ?? GAME.giftTiers[tier].icon;
    this.giftPile = [...this.giftPile, { tier, icon }].slice(-GAME.giftPileMax);
    if (!this.walk || now - this.walk.at > GAME.walkMs) {
      this.walk = { username: e.username, at: now, tier, icon };
      // gifts with their own reply (heart, rose, donut) get it; big gifts (higher tier) still get the tier thank-you
      const key = (['thankTier0', 'thankTier1', 'thankTier2', 'thankTier3'] as const)[tier];
      const text = known && tier < 2 ? this.line(known.thanks, s.spoken) : this.line(key, s.spoken, known?.say ?? GAME.giftTiers[tier].name);
      out.unshift({ ...this.t(text), warn: true });
    }
    const asking = this.phase === 'question' || this.phase === 'bonus';
    if (asking && GAME.hintGiftCoins > 0 && coins >= GAME.hintGiftCoins && this.correct.length === 0 && this.revealOne()) {
      out.push(...this.mainOf([this.t(this.line('giftHint', e.spoken), true)]));
    }
    return out;
  }

  /** Today's flower fund = flowers saved by the server + new ones not sent yet */
  get flowersToday() {
    return this.flowerBase;
  }
  /** The server reports today's saved flowers (0 on a new day); add the part not sent yet */
  setFlowersSaved(saved: number) {
    this.flowerBase = saved + this.flowerDelta;
  }

  /** Gift thank-you line (useGame decides whether to thank, to avoid repeating combos) */
  thank(e: Person, giftName: string, coins: number): Say {
    return this.t(coins >= GAME.bigGiftCoins ? this.line('bigGift', e.spoken) : this.line('thankGift', e.spoken, giftOf(giftName)?.say ?? giftName), true);
  }
  follow(e: Person): Say {
    return this.t(this.line('thankFollow', e.spoken));
  }
  greet(names: string): Say {
    return this.t(this.line('greeting', names));
  }
  share(): Say {
    return this.line0('share');
  }

  /** Hearts: counted during the heart-rain recess; otherwise every milestone makes the class clap */
  like(count: number, now: number, reachedClap: boolean, who?: Pick<Person, 'username' | 'spoken' | 'nickname'>): Say[] {
    this.lastSeenAt = now;
    // hearts count as interaction too: the hall monitor does not treat them as quiet, no dozing off (2026-11-07)
    const liker = who && this.students.get(who.username);
    if (liker) liker.lastActive = Math.max(liker.lastActive, now);
    // dance break / class heart rain: counts real hearts (no multiplier, no goal: every heart counts), remembers the top sender to thank
    if ((this.recess?.game === 'dance' || this.recess?.game === 'heart') && this.recess.stage === 'play') {
      this.recess.hearts += count;
      if (who) this.recess.likers.set(who.username, (this.recess.likers.get(who.username) ?? 0) + count);
      if (who) this.likerNames.set(who.username, { spoken: who.spoken, nickname: who.nickname });
      return [];
    }
    if (!reachedClap) return [];
    this.clapUntil = now + GAME.clapSec * 1000;
    return [this.line0('clap')];
  }

  /**
   * Praise streaks of right answers (GAME.streakMilestones): one student gets their own line; several at the same milestone share one line,
   * reading at most GAME.streakNamesRead names (owner 2026-11-04, reading every name made her talk too much). Points and gifts still go to everyone.
   */
  private streakLines(all: { s: Student; gift: string }[]): Say[] {
    const out: Say[] = [];
    for (const m of GAME.streakMilestones) out.push(...this.streakGroupLines(all.filter((x) => x.s.streak === m), String(m)));
    return out;
  }
  private streakGroupLines(list: { s: Student; gift: string }[], k: string): Say[] {
    if (list.length === 0) return [];
    if (list.length === 1) {
      const { s, gift } = list[0];
      return [this.t(gift ? this.line('streakGift', s.spoken, gift, k) : this.line('streak', s.spoken, k))];
    }
    const named = list.map((x) => x.s.spoken).filter((n) => n !== 'friend').slice(0, GAME.streakNamesRead);
    const more = list.length - named.length;
    const names = named.length === 0 ? `${more} students` : more > 0 ? `${named.join(', ')} and ${more} ${more === 1 ? 'other' : 'others'}` : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    const out = [this.t(this.line('streakGroup', names, k))];
    if (list.some((x) => x.gift)) out.push(this.line0('streakGroupGift'));
    return out;
  }

  private reveal(now: number): Say[] {
    this.setPhase('reveal', now, GAME.revealSec);
    const q = this.q!;
    this.reportLog.push({ id: q.id, answer: q.answer, category: q.category, attempts: this.stats.attempts, correct: this.correct.length, at: now });
    const out: Say[] = [];
    const winners = new Set(this.correct.map((a) => a.username));
    const streakers: { s: Student; gift: string }[] = [];
    for (const a of this.correct) {
      const s = this.students.get(a.username);
      if (!s) continue;
      this.countCorrect(s, this.q!);
      this.award(s, a.points, now + a.seq / 1e6, true);
      s.streak++;
      if ((GAME.streakMilestones as readonly number[]).includes(s.streak)) {
        this.award(s, GAME.streakBonus, now, true);
        streakers.push({ s, gift: this.rand() < GAME.giftChance ? this.giveGift(s, now) : '' });
      }
    }
    out.push(...this.streakLines(streakers));
    // closing at the same moment: whoever answered first ranks higher
    this.correct.forEach((a, i) => {
      const s = this.students.get(a.username);
      if (s) s.reachedAt = now + i / 1000;
    });
    for (const s of this.students.values()) if (!winners.has(s.username)) s.streak = 0;
    const math = this.q!.math;
    const riddle = this.q!.slot === 'meo';
    const eng = this.q!.slot === 'anh'; // spelling question: the reveal line reads the English word in the English voice
    // math reads the whole sum: "36 plus 47 equals 83"
    const answer = math ? `${math.say} equals ${this.q!.answer}` : this.q!.answer.toLowerCase();
    const top = this.correct[0] && this.students.get(this.correct[0].username);
    let main: string;
    if (top) {
      const rest = this.line('revealTop', top.spoken) + (this.correct.length > 1 ? ' ' + this.line('revealCount', String(this.correct.length)) : '');
      const slot = this.q!.slot;
      main = this.line(math ? 'mathReveal' : riddle ? 'riddleReveal' : eng ? 'englishReveal' : slot === 'dh' ? 'pictureReveal' : slot === 'su' ? 'historyReveal' : 'reveal', answer, rest);
      if (this.golden) out.unshift(this.t(this.rand() < 0.5 ? this.line('goldenGift', top.spoken, this.giveGift(top, now)) : this.line('goldenWinner', top.spoken)));
    } else main = this.line(math ? 'mathNobody' : riddle ? 'riddleNobody' : eng ? 'englishNobody' : 'revealNobody', answer);
    out.unshift({ ...this.t(main), main: true });
    // wrong answer: stand next to the teacher for GAME.standQuestions questions (owner 2026-11-05), at most GAME.standMax at once,
    // first wrong, first up. Students standing: one less each question, at 0 back to their seat
    for (const s of this.students.values()) if (s.standLeft > 0) s.standLeft--;
    let free = GAME.standMax - [...this.students.values()].filter((s) => s.standLeft > 0).length;
    const sentUp: Student[] = [];
    for (const u of this.standWrong ? this.wrong : []) {
      if (free <= 0) break;
      const s = this.students.get(u);
      if (!s || s.standLeft > 0) continue;
      s.standLeft = GAME.standQuestions;
      sentUp.push(s);
      free--;
    }
    const named = sentUp.filter((s) => s.spoken !== 'friend');
    if (named.length) out.push(this.t(this.line('roastStand', named[0].spoken)));
    else {
      // tease one student who answered wrong (name that can be read)
      const wrongs = [...this.wrong].map((u) => this.students.get(u)).filter((s): s is Student => !!s && s.spoken !== 'friend');
      if (wrongs.length && this.rand() < GAME.roastChance) {
        out.push(this.t(this.line(math ? 'mathWrong' : riddle ? 'riddleWrong' : 'roastWrong', wrongs[Math.floor(this.rand() * wrongs.length)].spoken)));
      }
    }
    return this.mainOf([...out, ...this.checkMonitor()]);
  }

  /** Mid-class break: the teacher names the top 3 students, gives gifts, asks the class to interact, then the next question */
  private startPraise(now: number): Say[] {
    const top = this.seats(3).filter((s) => s.score > 0);
    this.setPhase('praise', now, GAME.praiseSec);
    const keys = ['praiseFirst', 'praiseSecond', 'praiseThird'] as const;
    if (GAME.praiseShort) {
      // quick mode: one line reads the top 3, the gifts still go on the desks
      top.forEach((s) => this.giveGift(s, now));
      const names = top.map((s) => `${s.spoken} ${s.score} points`).join(', ');
      return this.mainOf([this.t(this.line('praiseQuick', names))]);
    }
    return this.mainOf([
      this.line0('praiseIntro'),
      ...top.map((s, i) => this.t(this.line(keys[i], s.spoken, String(s.score), this.giveGift(s, now)))),
      this.line0('praiseOutro'),
    ]);
  }

  private startResults(now: number, outOfQuestions = false): Say[] {
    this.setPhase('results', now, GAME.resultsSec);
    // standing up front only during class: at the end of a class everyone sits down, nobody stands during recess / big shows
    for (const s of this.students.values()) s.standLeft = 0;
    // after 20 questions: the teacher changes outfit (random, never the one she is wearing)
    const others = GAME.outfits.filter((o) => o !== this.outfit);
    this.outfit = others[Math.floor(this.rand() * others.length)];
    const best = this.seats(1)[0];
    const lines: Say[] = [];
    // write this class's monitor onto the board of previous classes
    if (best && best.score > 0) {
      this.champions = [{ round: this.round, username: best.username, nickname: best.nickname, score: best.score }, ...this.champions].slice(0, GAME.championsKept);
    }
    if (outOfQuestions) lines.push(this.t('We are out of questions, so here is the summary.'));
    lines.push(best && best.score > 0 ? this.t(this.line('results', best.spoken, String(best.score))) : this.line0('resultsNobody'));
    lines.push(...this.teamResult(now));
    if (this.weekLeader && this.round % 3 === 0) lines.push(this.t(this.line('weekBoard', this.weekLeader)));
    return this.mainOf(lines);
  }

  // ---------- recess ----------
  private startRecess(now: number, forced?: RecessGame): Say[] {
    // dance break with hearts (class settings): 'always' every recess, 'mix' drawn together with the other games
    const pool: RecessGame[] = this.dance === 'mix' ? [...RECESS_GAMES, 'dance'] : RECESS_GAMES;
    const choices = pool.filter((g) => g !== this.lastRecess);
    let game = forced ?? (this.dance === 'always' ? 'dance' : choices[Math.floor(this.rand() * choices.length)]);
    let callTarget: Student | null = null;
    let callQ: Question | null = null;
    if (game === 'callup') {
      // call on a seated student who was active in the last 3 minutes
      const active = this.seats().filter((s) => now - s.lastActive < 180_000 && s.spoken !== 'friend');
      callTarget = active[Math.floor(this.rand() * active.length)] ?? null;
      // an easy question not used in this class; if the set is too small just take any
      callQ = callTarget ? (this.pickOne('easy', this.roundQs, now) ?? this.bank[Math.floor(this.rand() * this.bank.length)] ?? null) : null;
      if (!callTarget || !callQ) game = 'roll';
    }
    this.lastRecess = game;
    this.recess = {
      game,
      stage: 'play',
      rps: new Map(),
      teacher: null,
      callTarget,
      callQ,
      callTiles: callQ ? scramble(callQ.answer, this.rand) : [],
      callResult: '',
      pick: PICK_TOPICS[Math.floor(this.rand() * PICK_TOPICS.length)],
      votes: new Map(),
      roll: [],
      hearts: 0,
      likers: new Map(),
      cheered: false,
    };
    this.setPhase('recess', now, game === 'dance' ? this.danceSec : GAME.recessPlaySec[game]);
    const out: Say[] = [this.line0('recessIntro')];
    const r = this.recess;
    if (game === 'rps') out.push(this.line0('rpsIntro'));
    if (game === 'callup') out.push(this.t(this.line('callUp', callTarget!.spoken)), this.t(`${callQ!.kind} ${callQ!.clue}`));
    if (game === 'pick') out.push(this.t(this.line('pickIntro', r.pick[0], r.pick[1])));
    if (game === 'roll') out.push(this.line0('rollIntro'));
    if (game === 'heart') out.push(this.line0('heartIntro'));
    if (game === 'dance') return this.mainOf([this.line0('danceIntro')]);
    return this.mainOf(out);
  }

  private recessChat(s: Student, e: ChatIn, now: number): Say[] {
    const r = this.recess;
    if (!r || r.stage !== 'play') return [];
    const word = plain(e.comment);
    if (r.game === 'rps' && word in RPS && !r.rps.has(s.username)) r.rps.set(s.username, word as Rps);
    if (r.game === 'pick' && (word === '1' || word === '2') && !r.votes.has(s.username)) r.votes.set(s.username, word === '1' ? 1 : 2);
    if (r.game === 'roll' && (word === 'here' || word === 'present') && !r.roll.some((a) => a.username === s.username)) {
      r.roll.push({ username: s.username, nickname: s.nickname, avatar: s.avatar, createTime: e.createTime, seq: ++this.seq, points: GAME.rollPoints });
      r.roll.sort((a, b) => a.createTime - b.createTime || a.seq - b.seq);
    }
    if (r.game === 'callup' && r.callTarget?.username === s.username && this.isAttempt(r.callQ, e.comment)) {
      r.callResult = this.matches(r.callQ, e.comment) ? 'right' : 'wrong';
      this.phaseEndsAt = now; // answered: close it right away
    }
    return [];
  }

  private recessResult(now: number): Say[] {
    const r = this.recess!;
    r.stage = 'result';
    this.setPhase('recess', now, GAME.recessResultSec);
    const out: Say[] = [];
    if (r.game === 'rps') {
      if (r.rps.size === 0) return this.mainOf([this.line0('rpsNobody')]);
      r.teacher = (Object.keys(RPS) as Rps[])[Math.floor(this.rand() * 3)];
      let win = 0;
      let lose = 0;
      for (const [u, p] of r.rps) {
        if (BEATS[p] === r.teacher) {
          win++;
          const s = this.students.get(u);
          if (s) this.award(s, GAME.rpsPoints, now, false);
        } else if (BEATS[r.teacher] === p) lose++;
      }
      const rest = win ? this.line('rpsWin', String(win)) : lose ? this.line('rpsLose', String(lose)) : 'Everyone tied with me.';
      out.push(this.t(this.line('rpsReveal', RPS[r.teacher], rest)));
    }
    if (r.game === 'callup') {
      const s = r.callTarget!;
      if (r.callResult === 'right') this.award(s, GAME.callUpPoints, now, false);
      if (r.callResult === '') r.callResult = 'silent';
      const key = r.callResult === 'right' ? 'callUpRight' : r.callResult === 'wrong' ? 'callUpWrong' : 'callUpSilent';
      out.push(this.t(this.line(key, s.spoken)));
      if (r.callResult !== 'right') out.push(this.t(`The answer is ${r.callQ!.answer.toLowerCase()}.`));
    }
    if (r.game === 'pick') {
      const one = [...r.votes.values()].filter((v) => v === 1).length;
      const two = r.votes.size - one;
      if (r.votes.size === 0) out.push(this.line0('pickNobody'));
      else if (one === two) out.push(this.line0('pickTie'));
      else {
        const [win, lose, n] = one > two ? [r.pick[0], r.pick[1], one] : [r.pick[1], r.pick[0], two];
        out.push(this.t(this.line('pickResult', win, String(Math.round((n / r.votes.size) * 100)))), this.t(this.line('pickRoast', lose)));
      }
    }
    if (r.game === 'roll') {
      const first = r.roll.slice(0, GAME.rollWinners);
      for (const a of first) {
        const s = this.students.get(a.username);
        if (s) this.award(s, GAME.rollPoints, now, false);
      }
      const names = first.slice(0, 3).map((a) => this.students.get(a.username)?.spoken ?? 'friend');
      out.push(first.length ? this.t(this.line('rollResult', names.join(', '))) : this.line0('rollNobody'));
    }
    // class heart rain (owner 2026-11-07): no 300 goal, just count; at the end read the total + thank the top sender
    if (r.game === 'heart') {
      if (r.hearts > 0) {
        out.push(this.t(this.line('heartDone', String(r.hearts), this.topLiker())));
        this.clapUntil = now + GAME.clapSec * 1000;
      } else out.push(this.line0('heartNobody'));
    }
    if (r.game === 'dance') {
      if (r.hearts > 0) {
        out.push(this.t(this.line('danceThanks', String(r.hearts), this.topLiker())));
        this.clapUntil = now + GAME.clapSec * 1000;
      } else out.push(this.line0('danceNobody'));
    }
    return this.mainOf([...out, ...this.checkMonitor()]);
  }

  /** End of recess: board of previous class monitors, the teacher mentions the student who was monitor most often */
  private recessBoard(now: number): Say[] {
    this.recess!.stage = 'board';
    this.setPhase('recess', now, GAME.recessBoardSec);
    const last = this.champions[0];
    const s = last && this.students.get(last.username);
    if (!s) return [];
    const times = this.champions.filter((c) => c.username === last.username).length;
    return this.mainOf([this.t(times > 1 ? this.line('championAgain', s.spoken, String(times)) : this.line('championBoard', s.spoken))]);
  }

  // ---------- The 2 big shows: Road to Everest / Golden Bell ----------
  // Same voice rhythm as class: her reading is a main line (clock held), answers count and the clock runs only after "go".
  // Everyone right within the time scores, speed does not matter; one answer per account per question.

  /** Scores + ranking of the current show (right on the tiebreaker ranks above equal scores) */
  private showRank() {
    const sh = this.show;
    if (!sh) return [];
    return [...sh.scores]
      .map(([username, score]) => ({ username, score, nickname: this.students.get(username)?.nickname ?? username, tie: sh.tieWin.has(username) ? 1 : 0 }))
      .sort((a, b) => b.score - a.score || b.tie - a.tie || a.nickname.localeCompare(b.nickname));
  }

  /** Waiting for viewers to answer in a big show (she has said go) */
  showAsking() {
    return this.phase === 'show' && this.show?.stage === 'ask' && this.boardShown && ['mc', 'stake', 'code'].includes(this.show.steps[this.show.i]?.k);
  }

  private showStepSec() {
    const st = this.show?.steps[this.show.i];
    return st?.k === 'mc' ? st.sec : 0;
  }

  /** This comment is an answer in a big show (no bubble, not counted as chat) */
  private isShowAnswer(comment: string) {
    const st = this.show?.steps[this.show.i];
    if (!st) return false;
    if (st.k === 'mc') return choiceOf(comment) >= 0 || plain(comment) === 'hint';
    if (st.k === 'stake') return /^(10|20)$/.test(plain(comment));
    if (st.k === 'code' && this.show!.code) return compactVi(comment).length === compactVi(this.show!.code.answer).length;
    return false;
  }

  /** Draw the longest-unasked multiple-choice question of the group (no repeats in a show), shuffle A B C D */
  private pickMc(level: McLevel, now: number) {
    const sh = this.show!;
    const at = (q: McQ) => this.history[q.id] ?? 0;
    let pool = this.showBank.mc.filter((q) => q.level === level && !sh.used.has(q.id));
    if (!pool.length) pool = this.showBank.mc.filter((q) => !sh.used.has(q.id));
    if (!pool.length) return null;
    pool = [...pool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => at(a) - at(b));
    const q = pool[0];
    sh.used.add(q.id);
    this.history[q.id] = now;
    this.usedLog.push(q.id);
    const opts = [q.right, ...q.wrong];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { q, opts, ans: opts.indexOf(q.right) };
  }

  private pickCode(now: number): CodeQ | null {
    const at = (c: CodeQ) => this.history[c.id] ?? 0;
    const pool = [...this.showBank.codes];
    if (!pool.length) return null;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => at(a) - at(b));
    this.history[pool[0].id] = now;
    this.usedLog.push(pool[0].id);
    return pool[0];
  }

  /**
   * Events board next to the channel name: which big show is next, after which class.
   * `now` = being played; `soon` = right after this class (the class in progress or its summary).
   */
  nextShow() {
    if (GAME.showEvery <= 0 || !this.showBank.mc.length) return null;
    if (this.show) return { kind: this.show.kind, name: SHOW_NAME[this.show.kind], afterRound: this.round, now: true, soon: false };
    // the current class is over (recess, topic vote): count from the next class
    const done = this.phase === 'recess' || this.phase === 'vote';
    const base = Math.max(1, done ? this.round + 1 : this.round);
    const afterRound = Math.ceil(base / GAME.showEvery) * GAME.showEvery;
    const kind = this.nextKind();
    if (!kind) return null;
    return { kind, name: SHOW_NAME[kind], afterRound, now: false, soon: !done && afterRound === this.round };
  }

  /** Start of a class that ends with a big show: the teacher warns the class to get ready */
  private showSoon(): Say[] {
    const n = this.nextShow();
    return n?.soon ? [this.t(this.line('showSoon', n.name))] : [];
  }

  /** "Big show" button on the control page: play one show now */
  forceShow(kind: ShowKind, now: number): Say[] {
    if (!this.showBank.mc.length) return [];
    return this.startShow(now, kind);
  }

  private startShow(now: number, forced?: ShowKind): Say[] {
    const kind: ShowKind = forced ?? this.nextKind() ?? 'everest';
    this.showNo++;
    this.recess = null;
    const E = GAME.show.everest;
    const C = GAME.show.chuong;
    const mc = (level: McLevel, x: { sec: number; pts: number }, tag: ShowTag): ShowStep => ({ k: 'mc', level, sec: x.sec, pts: x.pts, tag });
    const times = <T,>(n: number, f: () => T) => Array.from({ length: n }, f);
    const steps: ShowStep[] =
      kind === 'everest'
        ? [
            { k: 'gather' },
            { k: 'section', key: 'evWarm' },
            ...times(E.warm.n, () => mc('de', E.warm, 'warm')),
            { k: 'section', key: 'evCode' },
            { k: 'code', hint: 0 },
            { k: 'code', hint: 1 },
            { k: 'code', hint: 2 },
            { k: 'code', hint: 3 },
            { k: 'codeReveal' },
            { k: 'section', key: 'evStorm' },
            ...times(E.storm.n, () => mc('vua', E.storm, 'storm')),
            { k: 'section', key: 'evPeak' },
            ...times(E.peak.n, () => [{ k: 'stake' } as ShowStep, mc('kho', { sec: E.peak.sec, pts: 0 }, 'peak')]).flat(),
            { k: 'section', key: 'showTie' },
            { k: 'honor' },
          ]
        : [
            { k: 'gather' },
            { k: 'section', key: 'chWarm' },
            ...times(C.warm.n, () => mc('de', C.warm, 'warm')),
            { k: 'section', key: 'chHold' },
            ...times(C.hold.n, () => mc('vua', C.hold, 'hold')),
            { k: 'section', key: 'chRescue' },
            mc('vua', { sec: C.rescue.sec, pts: 0 }, 'rescue'),
            { k: 'section', key: 'chFinal' },
            ...times(C.final.n, () => mc('kho', C.final, 'final')),
            { k: 'section', key: 'chBell' },
            mc('chuong', C.bell, 'bell'),
            { k: 'section', key: 'showTie' },
            { k: 'honor' },
          ];
    this.show = {
      kind,
      steps,
      i: 0,
      stage: 'ask',
      qNo: 0,
      scores: new Map(),
      tieWin: new Set(),
      players: new Set(),
      mc: null,
      answers: new Map(),
      removed: [],
      ticketUser: '',
      stakes: new Map(),
      tickets: new Set(),
      code: null,
      codeTried: new Set(),
      codeSolvers: [],
      tied: [],
      bellRingers: [],
      helpers: [],
      honors: [],
      used: new Set(),
      lastRight: 0,
    };
    return this.showStep(now);
  }

  /** Enter the current step of the big show */
  private showStep(now: number): Say[] {
    const sh = this.show!;
    const st = sh.steps[sh.i];
    sh.stage = 'ask';
    this.boardShown = false;
    const go = (): Say => ({ ...this.line0('showGo'), go: true });
    switch (st.k) {
      case 'gather':
        this.setPhase('show', now, GAME.show.gatherSec);
        return this.mainOf([this.line0(sh.kind === 'everest' ? 'showIntroEverest' : 'showIntroChuong')]);
      case 'section': {
        // tiebreaker: only when the top players are tied (2 or more), otherwise skip
        if (st.key === 'showTie') {
          const rank = this.showRank();
          const top = rank[0]?.score ?? 0;
          sh.tied = top > 0 ? rank.filter((r) => r.score === top).map((r) => r.username) : [];
          if (sh.tied.length < 2) return this.showNext(now);
          sh.steps.splice(sh.i + 1, 0, { k: 'mc', level: 'phu', sec: GAME.show.tieSec, pts: 0, tag: 'tie' });
          const names = sh.tied.slice(0, 4).map((u) => this.students.get(u)?.spoken ?? 'friend').join(', ');
          this.setPhase('show', now, 2);
          return this.mainOf([this.t(this.line('showTie', names, String(top)))]);
        }
        this.setPhase('show', now, 2);
        return this.mainOf([this.line0(st.key)]);
      }
      case 'mc': {
        const p = this.pickMc(st.level, now);
        if (!p) return this.showNext(now);
        sh.qNo++;
        sh.mc = { ...p, tag: st.tag, pts: st.pts };
        sh.answers = new Map();
        sh.removed = [];
        sh.ticketUser = '';
        this.setPhase('show', now, st.sec);
        const opts = p.opts.map((o, i) => `${LETTERS[i]}, ${o}.`).join(' ');
        const head = st.tag === 'tie' ? 'Tiebreaker.' : st.tag === 'bell' ? 'Golden Bell question.' : `Question ${sh.qNo}.`;
        return this.mainOf([this.t(`${head} ${p.q.q}`), this.t(opts), go()]);
      }
      case 'stake':
        sh.stakes = new Map();
        this.setPhase('show', now, GAME.show.everest.peak.stakeSec);
        return this.mainOf([this.line0('evStake'), go()]);
      case 'code': {
        if (st.hint === 0) {
          sh.code = this.pickCode(now);
          sh.codeSolvers = [];
        }
        if (!sh.code) return this.showNext(now);
        // rescue: only when all 3 clues are used and nobody solved it
        if (st.hint === 3 && sh.codeSolvers.length) return this.showNext(now);
        sh.codeTried = new Set();
        const C = GAME.show.everest.code;
        this.setPhase('show', now, st.hint === 3 ? C.rescueSec : C.hintSec);
        const n = compactVi(sh.code.answer).length;
        const line =
          st.hint === 3
            ? this.t(this.line('codeRescue', sh.code.answer.trim()[0].toUpperCase(), String(n)))
            : this.t(`Clue ${st.hint + 1}, ${C.pts[st.hint]} points. ${sh.code.hints[st.hint]}`);
        return this.mainOf(st.hint === 0 ? [this.t(this.line('codeIntro', String(n))), line, go()] : [line, go()]);
      }
      case 'codeReveal': {
        sh.stage = 'reveal';
        this.setPhase('show', now, GAME.show.revealSec);
        const c = sh.code!;
        const names = sh.codeSolvers.slice(0, 3).map((x) => this.students.get(x.username)?.spoken ?? 'friend').join(', ');
        return this.mainOf([
          this.t(sh.codeSolvers.length ? this.line('codeReveal', c.answer.toLowerCase(), String(sh.codeSolvers.length), names) : this.line('codeNobody', c.answer.toLowerCase())),
        ]);
      }
      case 'honor':
        return this.showHonor(now);
    }
  }

  private showNext(now: number): Say[] {
    const sh = this.show!;
    sh.i++;
    if (sh.i >= sh.steps.length) return this.endShow(now);
    return this.showStep(now);
  }

  private showAdvance(now: number): Say[] {
    const sh = this.show;
    if (!sh) return this.startVote(now);
    const st = sh.steps[sh.i];
    if (st.k === 'mc' && sh.stage === 'ask') return this.showReveal(now);
    if (st.k === 'honor') return this.endShow(now);
    return this.showNext(now);
  }

  /** Grade a multiple-choice question, add points, the teacher reads the answer */
  private showReveal(now: number): Say[] {
    const sh = this.show!;
    const m = sh.mc!;
    sh.stage = 'reveal';
    this.setPhase('show', now, GAME.show.revealSec);
    const right = [...sh.answers].filter(([, a]) => a === m.ans).map(([u]) => u);
    sh.lastRight = right.length;
    const out: Say[] = [];
    for (const u of right) {
      const s = this.students.get(u);
      if (!s) continue;
      if (m.tag === 'tie') sh.tieWin.add(u);
      else if (m.tag === 'rescue') {
        sh.tickets.add(u);
        if (!sh.helpers.includes(u)) sh.helpers.push(u);
      } else {
        const pts = m.tag === 'peak' ? (sh.stakes.get(u) ?? GAME.show.everest.peak.stakes[0]) : m.pts;
        sh.scores.set(u, (sh.scores.get(u) ?? 0) + pts);
        this.award(s, pts, now, false);
        if (m.tag === 'bell') sh.bellRingers.push(u);
      }
    }
    const answer = `${LETTERS[m.ans]}, ${m.opts[m.ans]}`;
    out.push({ ...this.t(right.length ? this.line('showReveal', answer, String(right.length)) : this.line('showNobody', answer)), main: true });
    if (m.tag === 'rescue' && right.length) out.push({ ...this.t(this.line('ticketWin', String(right.length))), main: true });
    if (m.tag === 'bell' && right.length) {
      this.clapUntil = now + GAME.clapSec * 1000;
      out.push({ ...this.t(this.line('bellRing', String(right.length))), main: true });
    }
    return out;
  }

  private showChat(s: Student, e: ChatIn, now: number): Say[] {
    const sh = this.show;
    if (!sh || sh.stage !== 'ask' || !this.boardShown) return [];
    const st = sh.steps[sh.i];
    if (st.k === 'mc' && sh.mc) {
      // lifeline: in the final challenge, a ticket holder typing "hint" makes her remove 2 wrong options for everyone (once per question)
      if (plain(e.comment) === 'hint') {
        if (sh.mc.tag !== 'final' || sh.ticketUser || !sh.tickets.has(s.username)) return [];
        sh.tickets.delete(s.username);
        sh.ticketUser = s.username;
        const wrong = [0, 1, 2, 3].filter((i) => i !== sh.mc!.ans);
        for (let i = wrong.length - 1; i > 0; i--) {
          const j = Math.floor(this.rand() * (i + 1));
          [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
        }
        sh.removed = wrong.slice(0, 2);
        return [{ ...this.t(this.line('ticketUse', s.spoken)), warn: true }];
      }
      const c = choiceOf(e.comment);
      if (c < 0 || sh.answers.has(s.username) || sh.removed.includes(c)) return [];
      if (sh.mc.tag === 'tie' && !sh.tied.includes(s.username)) return [];
      sh.answers.set(s.username, c);
      sh.players.add(s.username);
      return [];
    }
    if (st.k === 'stake') {
      const p = plain(e.comment);
      if (p === '10' || p === '20') sh.stakes.set(s.username, Number(p));
      return [];
    }
    if (st.k === 'code' && sh.code) {
      // one guess per clue; once solved, done
      if (!this.isShowAnswer(e.comment) || sh.codeTried.has(s.username) || sh.codeSolvers.some((x) => x.username === s.username)) return [];
      sh.codeTried.add(s.username);
      sh.players.add(s.username);
      const key = GAME.requireDiacritics ? compactVi : plain;
      if (key(e.comment) !== key(sh.code.answer)) return [];
      const C = GAME.show.everest.code;
      const pts = st.hint === 3 ? C.rescuePts : C.pts[st.hint];
      sh.codeSolvers.push({ username: s.username, pts, hint: st.hint });
      sh.scores.set(s.username, (sh.scores.get(s.username) ?? 0) + pts);
      this.award(s, pts, now, false);
      if (st.hint === 3 && !sh.helpers.includes(s.username)) sh.helpers.push(s.username);
      return [];
    }
    return [];
  }

  /** Honours: winner, top 10, rescuer get a title (icon on the name tag for the whole session) */
  private showHonor(now: number): Say[] {
    const sh = this.show!;
    sh.stage = 'reveal';
    this.setPhase('show', now, GAME.show.honorSec);
    const [first, top, helper] = SHOW_TITLES[sh.kind];
    const rank = this.showRank().filter((r) => r.score > 0);
    const give = (u: string, title: string) => this.titles.set(u, [...new Set([...(this.titles.get(u) ?? []), title])]);
    const best = rank[0];
    const winners = best ? rank.filter((r) => r.score === best.score && r.tie === best.tie) : [];
    sh.honors = rank.slice(0, GAME.show.topShown).map((r) => ({ ...r, title: winners.includes(r) ? first : top }));
    for (const h of sh.honors) give(h.username, h.title);
    for (const u of sh.helpers) give(u, helper);
    if (winners.length) this.clapUntil = now + GAME.clapSec * 1000;
    const names = winners.slice(0, 3).map((w) => this.students.get(w.username)?.spoken ?? 'friend').join(', ');
    return this.mainOf([
      this.t(
        winners.length
          ? this.line(sh.kind === 'everest' ? 'honorEverest' : 'honorChuong', names, String(best.score))
          : this.line('honorNobody', SHOW_NAME[sh.kind]),
      ),
      ...(sh.players.size ? [this.t(this.line('honorThanks', String(sh.players.size)))] : []),
    ]);
  }

  private endShow(now: number): Say[] {
    this.show = null;
    return this.startVote(now);
  }

  /** Big-show snapshot for the screen */
  private showView() {
    const sh = this.show;
    if (!sh) return null;
    const st = sh.steps[sh.i];
    const reveal = sh.stage === 'reveal';
    const m = sh.mc;
    const rank = this.showRank();
    const C = GAME.show.everest;
    // max points (to draw the height on the mountain / the score bars)
    const maxScore =
      sh.kind === 'everest'
        ? C.warm.n * C.warm.pts + C.code.pts[0] + C.storm.n * C.storm.pts + C.peak.n * Math.max(...C.peak.stakes)
        : GAME.show.chuong.warm.n * GAME.show.chuong.warm.pts + GAME.show.chuong.hold.n * GAME.show.chuong.hold.pts + GAME.show.chuong.final.n * GAME.show.chuong.final.pts + GAME.show.chuong.bell.pts;
    const counts = m ? [0, 1, 2, 3].map((i) => [...sh.answers.values()].filter((a) => a === i).length) : [];
    const nameOf = (u: string) => this.students.get(u)?.nickname ?? u;
    const code = sh.code;
    const codeHint = st.k === 'code' ? st.hint : st.k === 'codeReveal' ? 3 : -1;
    return {
      kind: sh.kind,
      name: SHOW_NAME[sh.kind],
      step: st.k,
      section: st.k === 'section' ? SECTION_TITLE[st.key] : '',
      tag: st.k === 'mc' ? st.tag : '',
      stage: sh.stage,
      qNo: sh.qNo,
      question: st.k === 'mc' && m ? m.q.q : '',
      opts: st.k === 'mc' && m ? m.opts : [],
      removed: sh.removed,
      ans: reveal && m ? m.ans : -1,
      counts: reveal ? counts : [],
      answered: st.k === 'mc' ? sh.answers.size : st.k === 'stake' ? sh.stakes.size : st.k === 'code' ? sh.codeTried.size : 0,
      lastRight: sh.lastRight,
      ticketUser: sh.ticketUser ? nameOf(sh.ticketUser) : '',
      tickets: sh.tickets.size,
      stakes: [10, 20].map((v) => [...sh.stakes.values()].filter((x) => x === v).length),
      code: code && codeHint >= 0
        ? {
            hints: code.hints.slice(0, Math.min(3, codeHint + 1)),
            rescue: codeHint === 3,
            len: compactVi(code.answer).length,
            first: codeHint === 3 ? code.answer.trim()[0].toUpperCase() : '',
            answer: st.k === 'codeReveal' ? code.answer.toUpperCase() : '',
            solvers: sh.codeSolvers.slice(0, 5).map((x) => ({ nickname: nameOf(x.username), pts: x.pts })),
            solved: sh.codeSolvers.length,
            pts: codeHint < 3 ? C.code.pts[codeHint] : C.code.rescuePts,
          }
        : null,
      top: rank.slice(0, GAME.show.topShown).map((r) => ({ username: r.username, nickname: r.nickname, score: r.score })),
      maxScore,
      players: sh.players.size,
      tied: sh.tied.map(nameOf),
      bellRingers: sh.bellRingers.slice(0, 8).map(nameOf),
      honors: sh.honors,
      sectionNo: sh.steps.slice(0, sh.i + 1).filter((x) => x.k === 'section').length,
    };
  }

  newRound(now: number): Say[] {
    const voted = this.phase === 'vote' ? this.closeVote() : [];
    if (this.phase !== 'vote') this.topic = '';
    this.round++;
    this.monitor = ''; // new class: the race for class monitor starts over
    this.qNo = 0;
    this.q = null;
    this.correct = [];
    this.recess = null;
    for (const s of this.students.values()) {
      s.score = 0;
      s.streak = 0;
      s.standLeft = 0; // new class: everyone standing up front goes back to their seat
      s.reachedAt = 0;
      s.prio = 0; // seat priority from the hall monitor only lasts for that class
      s.desk = [];
      // built for thousands of viewers: students who left the live long ago (quiet longer than GAME.forgetAfterMs) are removed to keep it light.
      // Today's, weekly and report-card points are saved on the server; coming back joins as a new student, the report card comes back from the server
      if (now - s.lastActive > GAME.forgetAfterMs && !this.lifeDelta.has(s.username) && !this.weekDelta.has(s.username)) this.students.delete(s.username);
    }
    // class empty for a long time: this class reviews old questions (when someone joins, new questions from the next one)
    this.review = this.isEmpty(now);
    this.pickRound(now);
    this.lastTeamWin = [];
    // greeting by time of day: greet when the part of the day changes, otherwise now and then
    const period = dayPeriod(now);
    const greet = period !== this.lastPeriod || this.round % GAME.timeGreetEvery === 0 ? [this.line0(PERIOD_LINES[period])] : [];
    this.lastPeriod = period;
    // before every class 45 s to pick teams, then the class intro
    if (GAME.teamPickSec > 0 && (this.round - 1) % GAME.teamPickEvery === 0) {
      this.setPhase('team', now, GAME.teamPickSec);
      this.teamReminded = false;
      return this.mainOf([...voted, ...greet, this.line0('teamIntro')]);
    }
    this.setPhase('intro', now, GAME.introSec);
    return this.mainOf([...voted, ...greet, this.review ? this.line0('reviewIntro') : this.line0('intro'), ...this.showSoon()]);
  }

  /** Skip the current part ("Next part" button on the control page) */
  skip(now: number): Say[] {
    this.phaseEndsAt = now;
    return this.tick(now);
  }

  /** Jump to a term (0: Term 1 Q1, 1: Term 2 Q6, 2: Term 3 Q11, 3: Term 4 Q16) */
  jumpToStage(stageIdx: number, now: number): Say[] {
    const idx = Math.max(0, Math.min(3, Math.floor(stageIdx)));
    if (this.roundQs.length === 0) {
      this.round = Math.max(1, this.round);
      this.pickRound(now);
    }
    this.show = null;
    this.recess = null;
    this.qNo = idx * 5; // startQuestion adds 1, giving question 1, 6, 11, 16
    const stageNames = [
      'Term 1 begins: Elementary School, warm up!',
      'On to Term 2: Middle School, speed up!',
      'Into Term 3: High School, break through!',
      'Entering Term 4: the Graduation Arena, the final stretch!',
    ];
    return this.mainOf([this.t(stageNames[idx]), ...this.startQuestion(now)]);
  }

  /** "Recess now" button on the control page: play one game right away */
  /** Test button on the control page: the hall monitor comes in now and walks out the longest-quiet student (needs someone waiting for a seat) */
  forceEscort(now: number): Say[] {
    return this.supervisorTick(now, true);
  }

  forceRecess(game: RecessGame, now: number): Say[] {
    return this.startRecess(now, game);
  }

  tick(now: number): Say[] {
    this.clock = Math.max(this.clock, now);
    const extra: Say[] = [];
    // class quiet for too long: the teacher says something
    if (now - this.lastChatAt > GAME.idleAfterSec * 1000 && now - this.lastIdleAt > GAME.idleAfterSec * 1000) {
      this.lastIdleAt = now;
      extra.push({ ...this.line0('idle'), ttl: 15000 });
    }
    if (this.phase === 'question' && !this.quietSaid && this.correct.length === 0 && now - this.phaseStartedAt > GAME.questionSec * 500) {
      this.quietSaid = true;
      if (this.rand() < 0.5) extra.push({ ...this.line0('quietHalfway'), ttl: 5000 });
    }
    extra.push(...this.engageTick(now));
    extra.push(...this.supervisorTick(now));
    // dance break: half way she reads the heart count and praises the top sender (the clock keeps running)
    const rc = this.recess;
    if (this.phase === 'recess' && rc?.game === 'dance' && rc.stage === 'play' && !rc.cheered && now - this.phaseStartedAt >= this.danceSec * 500) {
      rc.cheered = true;
      extra.push({ ...this.t(this.line('danceCheer', String(rc.hearts), this.topLiker())), warn: true });
    }
    extra.push(...this.announce.splice(0)); // grade up / new badge congratulations
    // 5 seconds left: "time is almost up" (the clock keeps running)
    const asking = this.phase === 'question' || this.phase === 'bonus';
    if (asking && !this.warned && now < this.phaseEndsAt && this.phaseEndsAt - now <= GAME.warnLeftSec * 1000) {
      this.warned = true;
      extra.push({ ...this.line0('timeWarn'), warn: true });
    }
    // team pick: with 15 s left she reads the team sizes and reminds those who have not picked
    if (this.phase === 'team' && !this.teamReminded && now < this.phaseEndsAt && this.phaseEndsAt - now <= GAME.teamRemindLeftSec * 1000) {
      this.teamReminded = true;
      extra.push({ ...this.t(this.line('teamRemind', this.teamCountsText(now))), warn: true });
    }
    // big show: on long questions (12 s or more) she warns at 5 s left, the clock keeps running; 8 s questions are too short for it
    const showAsk = this.phase === 'show' && this.show?.stage === 'ask' && this.boardShown;
    if (showAsk && !this.warned && this.showStepSec() >= 12 && now < this.phaseEndsAt && this.phaseEndsAt - now <= GAME.warnLeftSec * 1000) {
      this.warned = true;
      extra.push({ ...this.line0('timeWarn'), warn: true });
    }
    // voice broken / muted: once the clock has run for more than 1 s (reading is over) show the letter board / accept answers anyway
    if ((asking || (this.phase === 'show' && this.show?.stage === 'ask')) && !this.boardShown && now - this.phaseStartedAt > 1000) this.showBoard(now);
    if (now < this.phaseEndsAt) return extra;
    return [...extra, ...this.advance(now)];
  }

  private advance(now: number): Say[] {
    switch (this.phase) {
      case 'team':
        return this.closeTeams(now);
      case 'intro':
        return this.startQuestion(now);
      case 'question':
        if (this.correct.length === 0 && !this.bonusUsed) {
          this.bonusUsed = true;
          // math never reveals digits, it only gets extra time
          if (!this.q?.math) this.revealOne();
          this.setPhase('bonus', now, GAME.bonusSec);
          return this.mainOf([this.line0(this.q?.math ? 'mathBonus' : 'bonus')]);
        }
        return this.reveal(now);
      case 'bonus':
        return this.reveal(now);
      case 'reveal':
        return this.afterQuestion(now);
      case 'praise':
        return this.startQuestion(now);
      case 'results':
        // every GAME.showEvery classes a big show replaces recess (alternating Everest / Golden Bell)
        if (GAME.showEvery > 0 && this.round % GAME.showEvery === 0 && this.showBank.mc.length && this.nextKind()) return this.startShow(now);
        return this.startRecess(now);
      case 'show':
        return this.showAdvance(now);
      case 'recess':
        if (this.recess?.stage === 'play') return this.recessResult(now);
        if (this.recess?.stage === 'result') return this.recessBoard(now);
        return this.startVote(now);
      case 'vote':
        return this.newRound(now);
    }
  }

  /** readable name of the top heart sender in the dance break (empty: nobody yet, or the name cannot be read) */
  private topLiker() {
    const top = [...(this.recess?.likers ?? [])].sort((a, b) => b[1] - a[1])[0];
    const name = top ? (this.likerNames.get(top[0])?.spoken ?? '') : '';
    return name === 'friend' ? '' : name;
  }
  private likerNames = new Map<string, { spoken: string; nickname: string }>();

  /**
   * Hall monitor (2026-11-07): a seated student quiet for longer than supervisorIdleMs (the owner sets the minutes) is walked out,
   * one at a time, the longest-quiet first. An active student waiting for a seat takes their place: highest class points, then most interaction.
   * Nobody waiting: nothing happens (no empty seats). A student who was walked out goes back to the queue when they comment again.
   */
  private supervisorTick(now: number, force = false): Say[] {
    if (this.escort && now - this.escort.at >= GAME.escortMs) this.escort = null;
    if (!force && (!this.supervisorOn || this.escort || now - this.lastEscortAt < GAME.escortGapMs)) return [];
    if (this.escort) return [];
    if (this.phase === 'show' || this.phase === 'team' || (this.phase === 'recess' && this.recess?.game === 'dance')) return [];
    const seated = this.seats();
    const idle = (s: Student) => now - s.lastActive;
    const busy = new Set([this.walk?.username, this.recess?.callTarget?.username]);
    const victim = seated
      .filter((s) => (force || idle(s) > this.supervisorIdleMs) && s.standLeft === 0 && !busy.has(s.username))
      .sort((a, b) => a.lastActive - b.lastActive)[0];
    if (!victim) return [];
    const inSeat = new Set(seated.map((s) => s.username));
    const waiting = [...this.students.values()].filter((s) => !s.out && !inSeat.has(s.username) && (force || idle(s) <= this.supervisorIdleMs));
    // automatic: nobody waiting means nothing happens (no empty seats). Test button on the control page: walks out anyway, the seat stays empty
    if (!waiting.length && !force) return [];
    const top = Math.max(...waiting.map((s) => s.score));
    const pick = waiting.filter((s) => s.score === top).sort((a, b) => b.talk - a.talk || b.lastActive - a.lastActive)[0];
    const seat = seated.indexOf(victim);
    victim.out = true;
    if (pick) {
      pick.prio = 1;
      pick.seatAt = Math.min(pick.seatAt, victim.seatAt);
    }
    const newcomer = this.seats().find((s) => !inSeat.has(s.username)) ?? null;
    this.escort = { at: now, out: victim, seat, in: newcomer };
    this.lastEscortAt = now;
    const text = newcomer ? this.line('escort', victim.spoken, newcomer.spoken) : this.line('escortAlone', victim.spoken);
    // test button: said at once (the clock keeps running). Automatic: in a busy room he may come every few dozen seconds, so she announces it
    // at most once every GAME.escortSayEveryMs, as an extra line when there is time (counts toward the extra-line cap); other times he works silently (2026-11-07)
    if (force) return [{ ...this.t(text, true), warn: true }];
    if (now - this.lastEscortSayAt < GAME.escortSayEveryMs) return [];
    this.lastEscortSayAt = now;
    return [{ ...this.t(text), ttl: 15_000 }];
  }

  /**
   * Fill the silence while waiting for answers to word questions (not math: typed numbers would count as answers).
   * Rotates: "Love the teacher? Type 1" / fun story, English tip / fun poll; after 15 s she thanks and reads the result.
   */
  private engageTick(now: number): Say[] {
    if (this.love && now - this.love.at >= GAME.loveWindowMs) {
      const fans = this.love.fans.map((u) => this.students.get(u)?.spoken).filter((n): n is string => !!n && n !== 'friend');
      const n = this.love.fans.length;
      this.love = null;
      if (n === 0) return [];
      const names = fans.slice(0, 3).join(', ') || 'everyone';
      return [{ ...this.t(this.line('loveThanks', String(n), names)), ttl: 12_000 }];
    }
    if (this.poll && now - this.poll.at >= GAME.loveWindowMs) {
      const p = this.poll;
      this.poll = null;
      if (p.votes.size === 0) return [];
      const counts = p.opts.map((o) => ({ ...o, n: [...p.votes.values()].filter((k) => k === o.key).length })).sort((a, b) => b.n - a.n);
      const tie = counts.length > 1 && counts[0].n === counts[1].n;
      return [{ ...this.t(tie ? this.line('pollTie', String(p.votes.size)) : this.line('pollResult', counts[0].label, String(counts[0].n))), ttl: 12_000 }];
    }
    const quiet = this.phase === 'question' && this.boardShown && !this.q?.math && this.phaseEndsAt - now > 12_000;
    if (this.love || this.poll || !quiet || now - this.lastLoveAt < GAME.engageEveryMs) return [];
    this.lastLoveAt = now;
    const kind = GAME.engageOrder[this.engageNo++ % GAME.engageOrder.length];
    if (kind === 'love') {
      this.love = { at: now, fans: [] };
      return [{ ...this.line0('loveCall'), ttl: 6000 }];
    }
    if (kind === 'sleep') {
      // wake up a seated student who dozed off; nobody asleep means a story instead
      const sleepy = this.seats().filter((s) => now - s.lastActive > GAME.sleepAfterMs && s.spoken !== 'friend');
      if (sleepy.length) return [{ ...this.t(this.line('wakeUp', sleepy[Math.floor(this.rand() * sleepy.length)].spoken)), ttl: 8000 }];
    }
    if (kind === 'poll') {
      const p = this.lines.pick('poll', POLLS);
      this.poll = { at: now, opts: p.opts, votes: new Map() };
      return [{ ...this.t(p.ask), ttl: 6000 }];
    }
    return [{ ...this.line0('funFact'), ttl: 8000 }];
  }

  /** One question done: class summary / mid-class break / next question */
  private afterQuestion(now: number): Say[] {
    if (this.qNo >= this.roundQs.length) return this.startResults(now);
    // every 5 questions stop and name the best students (skip if nobody has points yet)
    if (this.qNo % GAME.praiseEvery === 0 && this.seats(1)[0]?.score > 0) return this.startPraise(now);
    return this.startQuestion(now);
  }

  // ---------- next class's topic vote ----------
  private startVote(now: number): Say[] {
    this.recess = null;
    // 2 ordinary word topics, different from the recently picked ones
    const cats = [...new Set(this.bank.filter((q) => !q.slot).map((q) => q.category))];
    const fresh = cats.filter((c) => !this.lastTopics.includes(c));
    const pool = fresh.length >= 2 ? fresh : cats;
    if (pool.length < 2) return this.newRound(now);
    const a = pool[Math.floor(this.rand() * pool.length)];
    const rest = pool.filter((c) => c !== a);
    const b = rest[Math.floor(this.rand() * rest.length)];
    this.vote = { topics: [a, b], votes: new Map() };
    this.setPhase('vote', now, GAME.voteSec);
    return this.mainOf([this.t(this.line('voteIntro', topicName(a), topicName(b)))]);
  }

  private voteChat(s: Student, e: ChatIn): Say[] {
    const w = plain(e.comment);
    if (this.vote && (w === '1' || w === '2') && !this.vote.votes.has(s.username)) this.vote.votes.set(s.username, w === '1' ? 1 : 2);
    return [];
  }

  /** Count the votes: the winner becomes next class's topic (ties drawn at random, no votes means a normal class) */
  private closeVote(): Say[] {
    const v = this.vote;
    this.vote = null;
    this.topic = '';
    if (!v || v.votes.size === 0) return [this.line0('voteNobody')];
    const one = [...v.votes.values()].filter((x) => x === 1).length;
    const two = v.votes.size - one;
    this.topic = one > two ? v.topics[0] : two > one ? v.topics[1] : v.topics[Math.floor(this.rand() * 2)];
    this.lastTopics = [...this.lastTopics, this.topic].slice(-4);
    return [this.t(this.line('voteResult', topicName(this.topic)))];
  }

  /** State snapshot to draw (compact, can be sent over the network for the control-page preview) */
  view(now: number) {
    const showAnswer = this.phase === 'reveal';
    const asking = this.phase === 'question' || this.phase === 'bonus' || this.phase === 'reveal';
    const seated = this.seats(GAME.seats + GAME.standing);
    // class monitor, vice monitors: the 3 highest class scores (only this class's 20 questions); reuses the seat list, no re-sorting
    const titles = new Map(seated.slice(0, 3).filter((s) => s.score > 0).map((s, i) => [s.username, i === 0 ? 'lop-truong' : 'lop-pho']));
    const pub = ({ username, nickname, avatar, girl, score, session, lastActive, joinedAt, desk, days, bubble, standLeft, life, team }: Student) => ({
      team,
      desk,
      days,
      grade: gradeOf(life.points), // report card: grade (13 = graduated)
      bubble: bubble && now - bubble.at < GAME.bubbleMs ? bubble.text : '',
      standing: standLeft > 0, // standing up front for a wrong answer: empty seat
      sleeping: now - lastActive > GAME.sleepAfterMs,
      username,
      nickname,
      avatar,
      girl,
      score,
      session,
      lastActive,
      joinedAt,
      title: titles.get(username) ?? '',
      // titles from the 2 big shows: only the first icon of each title, to keep name tags tidy
      showIcons: (this.titles.get(username) ?? []).map((x) => x.split(' ')[0]).join(''),
      // current question: right / wrong / not yet (not shown outside question time)
      answered: !asking ? '' : this.correct.some((a) => a.username === username) ? 'right' : this.wrong.has(username) ? 'wrong' : '',
      // points just earned on this question: "+10" floats up above the student who got it right
      gain: asking ? (this.correct.find((a) => a.username === username)?.points ?? 0) : 0,
    });
    const r = this.recess;
    return {
      phase: this.phase,
      round: this.round,
      qNo: this.qNo,
      total: this.roundQs.length,
      golden: this.golden,
      endsAt: this.phaseEndsAt,
      // snapshot time: the screen never counts down from a clock older than this (stops the 20/21 flicker while the clock is held)
      at: now,
      clue: this.q?.clue ?? '',
      kind: this.q?.kind ?? '',
      slot: this.q?.slot ?? '', // 'meo' riddle, 'su' history: the board shows its own label
      // riddle segment: which of the 2 riddles in a row (1 = first; while she introduces it the board shows a "get ready" card)
      riddleNo: this.q?.slot === 'meo' ? (this.roundQs[this.qNo - 2]?.slot === 'meo' ? 2 : 1) : 0,
      math: this.q?.math?.show ?? '', // math question: the sum shows instead of shuffled letters
      category: this.q?.category ?? '',
      answer: this.phase === 'recess' ? (r?.callQ?.answer ?? '') : (this.q?.answer ?? ''),
      tiles: this.tiles,
      slots: this.slots(showAnswer),
      vote: this.vote && {
        topics: this.vote.topics.map(topicName) as [string, string],
        counts: [1, 2].map((k) => [...this.vote!.votes.values()].filter((x) => x === k).length),
      },
      topic: topicName(this.topic), // topic the class picked for this class
      review: this.review, // review class (empty room)
      // student walking up with flowers
      walk: (() => {
        const s = this.walk && now - this.walk.at < GAME.walkMs ? this.students.get(this.walk.username) : undefined;
        return s ? { username: s.username, nickname: s.nickname, girl: s.girl, at: this.walk!.at, tier: this.walk!.tier, icon: this.walk!.icon } : null;
      })(),
      // students standing up front (including students without a seat)
      punished: [...this.students.values()].filter((s) => s.standLeft > 0).map(({ username, nickname, girl, standLeft }) => ({ username, nickname, girl, left: standLeft })),
      loveFans: this.love?.fans.length ?? 0, // "Love the teacher? Type 1" running: how many typed it (hearts float up)
      // fun poll running: the options and the votes
      poll: this.poll && this.poll.opts.map((o) => ({ ...o, n: [...this.poll!.votes.values()].filter((k) => k === o.key).length })),
      birthday: this.birthday && now - this.birthday.at < GAME.birthdayBannerSec * 1000 ? this.birthday : null,
      goodbye: this.goodbyeAt && now - this.goodbyeAt < GAME.goodbyeBannerSec * 1000 ? { at: this.goodbyeAt } : null,
      players: this.activePlayers(now),
      // she is reading the question: no shuffled letters / sum / answer boxes until she says go
      boardShown: (this.phase !== 'question' && this.phase !== 'show') || this.boardShown, // big show: the clock runs and answers count only after go
      // mid-class break: top 3 students with the gifts on their desks
      praiseTop: this.phase === 'praise' ? this.seats(3).filter((s) => s.score > 0).map(({ username, nickname, score, desk }) => ({ username, nickname, score, desk })) : [],
      correctTop: this.correct.slice(0, 3).map(({ username, nickname, avatar, points }) => ({ username, nickname, avatar, points })),
      // Top 5 fastest board when the answer shows: name, time (ms), points; other right answers +1
      // answer time: TikTok send time converted to the PC clock (the same skew for everyone, so the ranking holds), counted from "go".
      // The measured skew includes the smallest network delay, so the seconds may be a few hundred ms too high
      fastest: this.correct.slice(0, GAME.fastestShown).map(({ username, nickname, points, createTime }) => ({
        username,
        nickname,
        points,
        ms: Math.max(0, Math.round(createTime + this.clockSkew - this.answerStartAt)),
      })),
      laterCount: Math.max(0, this.correct.length - GAME.fastestShown),
      laterPoints: GAME.latePoints * (this.golden ? 2 : 1),
      correctCount: this.correct.length,
      seats: seated.slice(0, GAME.seats).map(pub),
      standing: seated.slice(GAME.seats).map(pub), // no seat: watching from outside the door, still scores
      sessionTop: this.sessionTop(5).map(({ username, nickname, session }) => ({ username, nickname, session })),
      champions: this.champions.slice(0, 5).map((c) => ({ ...c, times: this.champions.filter((x) => x.username === c.username).length })),
      classSize: this.students.size,
      // Ms. Ngan's outfit: the class outfit, or the show outfit during a big show
      outfit: this.show ? this.show.kind : this.outfit,
      nextShow: this.nextShow(),
      show: this.showView(),
      // team race (empty when team picking is off)
      teams: GAME.teamPickSec > 0 ? this.teamStats(now) : [],
      teamWin: this.lastTeamWin,
      // team pick: students without a team (she assigns them at the end)
      noTeam: this.phase === 'team' ? [...this.students.values()].filter((s) => !s.team).length : 0,
      // head count: students seated / active students (10 min) without a seat, waiting to come in
      roster: (() => {
        const inClass = Math.min(GAME.seats, seated.length);
        let active = 0;
        for (const s of this.students.values()) if (now - s.lastActive <= GAME.seatActiveMs) active++;
        const activeSeated = seated.slice(0, GAME.seats).filter((s) => now - s.lastActive <= GAME.seatActiveMs).length;
        return { seated: inClass, seats: GAME.seats, waiting: Math.max(0, active - activeSeated) };
      })(),
      stats: this.stats,
      flowers: this.flowers,
      // today's flower fund: flowers, next milestone, milestone just reached (fireworks for 8 s)
      fund: {
        today: this.flowersToday,
        goal: GAME.flowerGoals.find((g) => g > this.flowersToday) ?? GAME.flowerGoals[GAME.flowerGoals.length - 1],
        party: this.fundParty && now - this.fundParty.at < 8000 ? this.fundParty.goal : 0,
      },
      // gifts the teacher got this session (on the table behind her): tier of each, newest last
      gifts: this.giftPile,
      lastFlowerAt: this.lastFlowerAt,
      clapping: now < this.clapUntil,
      // the hall monitor walking a student out (seat: their old seat), a new student walking to seat inSeat
      escort: this.escort && {
        at: this.escort.at,
        seat: this.escort.seat,
        out: { username: this.escort.out.username, nickname: this.escort.out.nickname, girl: this.escort.out.girl },
        in: this.escort.in && { username: this.escort.in.username, nickname: this.escort.in.nickname, girl: this.escort.in.girl },
        inSeat: this.escort.in ? seated.indexOf(this.escort.in) : -1,
      },
      recess: r && {
        game: r.game,
        stage: r.stage,
        rpsCounts: (Object.keys(RPS) as Rps[]).map((k) => [...r.rps.values()].filter((v) => v === k).length),
        teacher: r.teacher ? RPS[r.teacher] : '',
        callName: r.callTarget?.nickname ?? '',
        callUser: r.callTarget?.username ?? '',
        callClue: r.callQ ? `${r.callQ.kind} ${r.callQ.clue}` : '',
        callTiles: r.callTiles,
        callSlots: this.slotsOf(r.callQ, new Set(), r.stage !== 'play'),
        callResult: r.callResult,
        pick: r.pick,
        votes: [[...r.votes.values()].filter((v) => v === 1).length, [...r.votes.values()].filter((v) => v === 2).length],
        roll: r.roll.slice(0, GAME.rollWinners).map((a) => a.nickname),
        hearts: r.hearts,
        heartTarget: GAME.heartTarget,
        topLiker: (() => {
          const top = [...r.likers].sort((a, b) => b[1] - a[1])[0];
          return top ? { nickname: this.likerNames.get(top[0])?.nickname ?? '', n: top[1] } : null;
        })(),
      },
    };
  }
}

export type ClassView = ReturnType<Classroom['view']>;
