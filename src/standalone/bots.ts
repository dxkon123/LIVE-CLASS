/**
 * Simulated classmates for the single-file build, so the class feels alive even when you play alone.
 * They join, chat, guess answers (some fast, some slow, some wrong), play recess games,
 * vote, pick teams, answer the big shows, send hearts and the odd flower.
 * They only use the same "comment / like / gift" events a real viewer would.
 */
import type { Classroom } from '../game/quiz';
import { emitTest } from '../live/page';

const FIRST = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Sophia', 'Mason', 'Isla', 'Leo', 'Chloe', 'Jack',
  'Lily', 'Ryan', 'Zoe', 'Aiden', 'Grace', 'Daniel', 'Hannah', 'Owen', 'Ella', 'Kai', 'Ruby', 'Max', 'Nora', 'Sam',
  'Maya', 'Ben', 'Aria', 'Theo', 'Luna', 'Finn', 'Ivy', 'Jay', 'Amara', 'Omar', 'Priya', 'Hiro',
];
const STYLE = [(n: string) => n, (n: string) => `${n}${Math.floor(Math.random() * 90 + 10)}`, (n: string) => `${n} ✨`, (n: string) => `${n.toLowerCase()}_x`, (n: string) => `Little ${n}`];
const SMALL_TALK = [
  'hi everyone!', 'so hard 😅', 'lol', 'go go go', 'this is fun', 'I know this one!', 'wait what', 'hmm...', 'nooo I was close',
  'Ms. Ngan is the best', 'easy peasy', 'my brain hurts', 'again again', 'who is winning?', 'hello from Manila', 'hello from London',
  'first time here', 'yay', 'ok ok', 'one more!', 'I love this class', '😂😂', '🔥🔥', 'gg', 'teacher pls hint', 'so fast!!',
];
const JOIN = ['join class', 'hi', 'hello teacher!', 'present', 'hey class', 'join class'];

interface Bot {
  username: string;
  nickname: string;
  skill: number; // 0..1, how often they know the answer
  speed: number; // 0.5 fast .. 1.6 slow
  joined: boolean;
  joinAt: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function scrambleWrong(answer: string) {
  // a wrong guess of the same length (counts as a real attempt)
  const letters = answer.replace(/\s+/g, '').split('');
  if (/^\d+$/.test(answer)) return String(Number(answer) + pick([-10, -2, -1, 1, 2, 10]));
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const w = letters.join('');
  return w.toLowerCase() === answer.replace(/\s+/g, '').toLowerCase() ? w.slice(1) + w[0] + 'x' : w;
}

export class Classmates {
  private bots: Bot[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private handled = new Set<string>();
  private loop: ReturnType<typeof setInterval> | null = null;
  private lastTalk = 0;
  private lastLike = 0;
  private lastGift = Date.now();
  count = 0;

  constructor(private room: () => Classroom | null) {}

  setCount(n: number) {
    n = Math.max(0, Math.min(40, Math.round(n)));
    this.count = n;
    const now = Date.now();
    while (this.bots.length < n) {
      const used = new Set(this.bots.map((b) => b.username));
      let first = pick(FIRST);
      for (let k = 0; k < 20 && used.has(`bot-${first.toLowerCase()}`); k++) first = pick(FIRST);
      const username = `bot-${first.toLowerCase()}${used.has(`bot-${first.toLowerCase()}`) ? this.bots.length : ''}`;
      this.bots.push({
        username,
        nickname: pick(STYLE)(first),
        skill: rand(0.25, 0.85),
        speed: rand(0.6, 1.5),
        joined: false,
        joinAt: now + rand(1500, 25_000),
      });
    }
    this.bots.length = n;
    if (n > 0 && !this.loop) this.loop = setInterval(() => this.tick(), 400);
    if (n === 0) this.stop();
  }

  stop() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private say(b: Bot, comment: string) {
    if (!this.bots.includes(b)) return;
    void emitTest('chat', { username: b.username, nickname: b.nickname, comment, createTime: Date.now(), test: false });
  }

  /** run once per "thing" (question, recess game...) for each bot */
  private once(key: string, fn: () => void) {
    if (this.handled.has(key)) return;
    this.handled.add(key);
    if (this.handled.size > 5000) this.handled = new Set([...this.handled].slice(-2000));
    fn();
  }

  private tick() {
    const room = this.room();
    if (!room) return;
    const now = Date.now();
    const active = this.bots.filter((b) => b.joined);
    for (const b of this.bots) {
      if (!b.joined && now >= b.joinAt) {
        b.joined = true;
        this.say(b, pick(JOIN));
      }
    }
    if (!active.length) return;

    const phase = room.phase;
    const tag = `${room.round}:${room.qNo}:${phase}`;

    // ----- regular questions -----
    if ((phase === 'question' || phase === 'bonus') && room.q && room.boardShown) {
      const q = room.q;
      const answers = [q.answer, ...(q.acceptedAnswers ?? [])];
      const hard = q.difficulty === 'hard' ? 0.75 : q.difficulty === 'medium' ? 0.9 : 1;
      const left = Math.max(1500, room.phaseEndsAt - now - 800);
      for (const b of active) {
        this.once(`${tag}:${q.id}:${b.username}`, () => {
          const r = Math.random();
          const bonus = phase === 'bonus' ? 0.2 : 0;
          if (r < b.skill * hard + bonus) {
            const ms = Math.min(left, rand(1800, 9000) * b.speed + (q.difficulty === 'hard' ? 2500 : 0));
            this.later(ms, () => room.q?.id === q.id && this.say(b, answers[0].toLowerCase()));
          } else if (r < b.skill * hard + bonus + 0.35) {
            this.later(Math.min(left, rand(2000, 12_000)), () => room.q?.id === q.id && this.say(b, scrambleWrong(answers[0])));
          }
        });
      }
    }

    // ----- recess games -----
    const rc = room.recess;
    if (phase === 'recess' && rc && rc.stage === 'play') {
      for (const b of active) {
        this.once(`${tag}:recess:${rc.game}:${b.username}`, () => {
          const ms = rand(1500, 9000) * b.speed;
          if (rc.game === 'rps') this.later(ms, () => this.say(b, pick(['rock', 'paper', 'scissors'])));
          if (rc.game === 'pick') this.later(ms, () => this.say(b, pick(['1', '2'])));
          if (rc.game === 'roll' && Math.random() < 0.85) this.later(ms * 0.7, () => this.say(b, 'here'));
          if ((rc.game === 'heart' || rc.game === 'dance') && Math.random() < 0.8) {
            for (let i = 0; i < 4; i++) this.later(ms + i * 2500, () => void emitTest('like', { username: b.username, nickname: b.nickname, likeCount: Math.ceil(rand(3, 15)) }));
          }
          if (rc.game === 'callup' && rc.callTarget?.username === b.username && rc.callQ) {
            const right = Math.random() < b.skill + 0.15;
            const a = rc.callQ.answer;
            this.later(rand(3000, 8000), () => this.say(b, right ? a.toLowerCase() : scrambleWrong(a)));
          }
        });
      }
    }

    // ----- vote for next topic / team pick -----
    if (phase === 'vote' && room.vote) for (const b of active) this.once(`${tag}:vote:${b.username}`, () => Math.random() < 0.7 && this.later(rand(1500, 7000), () => this.say(b, pick(['1', '2']))));
    if (phase === 'team') for (const b of active) this.once(`${tag}:team:${b.username}`, () => Math.random() < 0.75 && this.later(rand(2000, 12_000), () => this.say(b, `team ${Math.ceil(Math.random() * 4)}`)));

    // ----- the big shows (Everest / Golden Bell) -----
    const sh = room.show;
    if (phase === 'show' && sh && sh.stage === 'ask' && room.boardShown) {
      const st = sh.steps[sh.i];
      const left = Math.max(1500, room.phaseEndsAt - now - 700);
      for (const b of active) {
        if (st.k === 'mc' && sh.mc) {
          const mc = sh.mc;
          this.once(`show:${sh.kind}:${sh.i}:${b.username}`, () => {
            if (Math.random() > 0.85) return;
            const right = Math.random() < b.skill * 0.85;
            let c = right ? mc.ans : Math.floor(Math.random() * 4);
            if (sh.removed.includes(c)) c = mc.ans;
            this.later(Math.min(left, rand(1500, 6500) * b.speed), () => sh.mc === mc && this.say(b, 'ABCD'[c]));
          });
        }
        if (st.k === 'stake') this.once(`show:${sh.kind}:${sh.i}:${b.username}`, () => this.later(Math.min(left, rand(1000, 5000)), () => this.say(b, Math.random() < 0.5 ? '10' : '20')));
        if (st.k === 'code' && sh.code) {
          const code = sh.code;
          this.once(`show:${sh.kind}:${sh.i}:${b.username}`, () => {
            const p = st.hint === 0 ? 0.08 : st.hint === 1 ? 0.2 : st.hint === 2 ? 0.4 : 0.6;
            if (Math.random() < p * (0.5 + b.skill)) this.later(Math.min(left, rand(2500, 10_000)), () => sh.code === code && this.say(b, code.answer.toLowerCase()));
          });
        }
      }
    }

    // ----- "who loves the teacher, type 1" and fun polls -----
    if (room.love && now - room.love.at < 12_000) for (const b of active) this.once(`love:${room.love.at}:${b.username}`, () => Math.random() < 0.6 && this.later(rand(800, 8000), () => this.say(b, '1')));
    if (room.poll && now - room.poll.at < 12_000) {
      const opts = room.poll.opts;
      for (const b of active) this.once(`poll:${room.poll.at}:${b.username}`, () => Math.random() < 0.6 && this.later(rand(800, 8000), () => this.say(b, pick(opts).key)));
    }

    // ----- background life: small talk, hearts, rare gifts -----
    if (now - this.lastTalk > rand(9000, 20_000)) {
      this.lastTalk = now;
      const b = pick(active);
      if (phase !== 'question' || Math.random() < 0.5) this.say(b, pick(SMALL_TALK));
    }
    if (now - this.lastLike > rand(6000, 15_000)) {
      this.lastLike = now;
      const b = pick(active);
      void emitTest('like', { username: b.username, nickname: b.nickname, likeCount: Math.ceil(rand(2, 12)) });
    }
    if (now - this.lastGift > rand(150_000, 300_000)) {
      this.lastGift = now;
      const b = pick(active);
      const g = pick([
        { giftName: 'Rose', diamondCount: 1, repeatCount: 1 },
        { giftName: 'Rose', diamondCount: 1, repeatCount: 5 },
        { giftName: 'Finger Heart', diamondCount: 5, repeatCount: 1 },
        { giftName: 'Doughnut', diamondCount: 30, repeatCount: 1 },
      ]);
      void emitTest('gift', { username: b.username, nickname: b.nickname, giftId: 1, ...g });
    }
  }
}
