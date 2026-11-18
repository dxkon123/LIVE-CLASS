// Game core tests: npx tsx src/game/quiz.check.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Classroom, LineBag, teamOf, tierOf, compactVi, dayPeriod, emptyLife, gradeOf, plain, scramble, topicName } from './quiz';
import { parseBank, type Question } from './questions';
import { GAME, shownTeacherName } from './config';
import { teacherText, thayHoa } from './teacher-swap';
import { makeMath } from './math';
import { choiceOf, parseCodes, parseMc } from './show';
import { LINES, PICK_TOPICS, POLLS } from './lines';

const dir = path.join(import.meta.dirname, 'word-bank');
const BANK = parseBank(Object.fromEntries(fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])));
const mk = (answer: string, d: Question['difficulty'] = 'easy', id = answer): Question => ({ id, answer, clue: 'clue', kind: 'This is a test.', category: 'x', difficulty: d });
const who = (i: number) => ({ username: `u${i}`, nickname: `Kid ${i}`, spoken: `Kid ${i}`, avatar: '' });
const chat = (c: Classroom, i: number, comment: string, createTime: number, now: number) => c.chat({ ...who(i), comment, createTime }, now);
let t = 1_000_000;
// the older tests run without team picking; teams are tested on their own at the end of the file
const TEAM_SEC = GAME.teamPickSec;
GAME.teamPickSec = 0;
// older tests include standing up front for wrong answers (owner turned it off 2026-11-07, code kept behind GAME.standWrong); the "off" version is tested at the end
const STAND = GAME.standWrong;
GAME.standWrong = true;
// the older tests were written for the old pace; quick mode (2026-11-04) is tested on its own at the end of the file
const FAST = { quickRead: GAME.quickRead, closeAfterTopN: GAME.closeAfterTopN, praiseShort: GAME.praiseShort, praiseEvery: GAME.praiseEvery, showEvery: GAME.showEvery, teamPickEvery: GAME.teamPickEvery };
Object.assign(GAME, { quickRead: false, closeAfterTopN: 0, praiseShort: false, praiseEvery: 5, showEvery: 2, teamPickEvery: 1 });

// ---------- text ----------
assert.equal(compactVi('  Crème   Brûlée! '), 'crèmebrûlée');
assert.equal(plain('Join Class'), 'joinclass');
assert.equal(compactVi('Crème brûlée'.normalize('NFD')), 'crèmebrûlée'); // decomposed accents still match
assert.notEqual(compactVi('crème'), compactVi('creme'));
const s = scramble('CRÈME BRÛLÉE', () => 0.3);
assert.deepEqual([...s].sort(), [...'CRÈMEBRÛLÉE'].sort());
assert.notEqual(s.join(''), 'CRÈMEBRÛLÉE');

// ---------- teacher lines: plenty, no duplicates, the whole deck is used before repeating ----------
for (const [key, list] of Object.entries(LINES)) {
  assert.ok(list.length >= 2, `${key}: at least 2 lines`);
  const texts = (list as unknown[]).map((l) => (typeof l === 'function' ? (l as (...a: string[]) => string)('A', 'B') : l));
  assert.equal(new Set(texts).size, texts.length, `${key}: duplicate line`);
  for (const x of texts as string[]) assert.ok(!/[—–]/.test(x), `${key}: has a dash: ${x}`);
}
assert.ok(PICK_TOPICS.length >= 20);
const bag = new LineBag(() => 0.42);
const seen = new Set<number>();
for (let i = 0; i < 10; i++) seen.add(bag.pick('k', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
assert.equal(seen.size, 10, 'all 10 lines are read before repeating');
let prev = -1;
for (let i = 0; i < 200; i++) {
  const x = bag.pick('k2', [0, 1, 2, 3]);
  assert.notEqual(x, prev, 'never repeats the line just read');
  prev = x;
}

// ---------- 1 question, 1000 people, arriving out of order ----------
{
  const c = new Classroom([mk('CRÈME BRÛLÉE')], t);
  c.newRound(t);
  const asked = c.tick((t += GAME.introSec * 1000));
  assert.equal(c.phase, 'question');
  assert.ok(asked.some((l) => l.main && l.text.includes('Question 1.')), 'the question is a main line, read first');
  assert.deepEqual(c.slots(), [null, null, null, null, null, ' ', null, null, null, null, null, null]);
  chat(c, 9999, 'too hard', t, t); // ordinary chat never counts as wrong
  chat(c, 9999, 'crème brûlée', t + 9000, t);
  assert.equal(c.correct.length, 1);
  chat(c, 5000, 'crème brûlèe', t, t); // wrong first: no second try
  chat(c, 5000, 'crème brûlée', t, t);
  assert.ok(!c.correct.some((a) => a.username === 'u5000'));
  chat(c, 5001, 'creme brulee', t, t); // no accents: does not count
  assert.ok(!c.correct.some((a) => a.username === 'u5001'));
  for (let i = 0; i < 1000; i++) chat(c, i, i < 300 ? 'Crème Brûlée' : 'hello there teacher', t + 5000 - i, t + 10);
  assert.equal(c.correct.length, 301);
  assert.equal(c.correct[0].username, 'u299', 'earliest createTime ranks first');
  assert.deepEqual(c.correct.slice(0, 4).map((a) => a.points), [10, 7, 5, 3]);
  assert.equal(c.correct[10].points, 1);
  c.tick((t += GAME.questionSec * 1000 + 50));
  assert.equal(c.phase, 'reveal');
  assert.equal(c.students.get('u299')!.score, 10);
  assert.equal(c.students.get('u299')!.session, 10);
  assert.equal(c.seats()[0].username, 'u299');
  assert.equal(c.weekDelta.get('u299')!.points, 10);
  assert.equal(c.slots(true).join(''), 'CRÈME BRÛLÉE');
  // end of question (set has 1 word question + 4 generated math) -> summary -> recess -> new class clears class points, keeps session points
  for (let k = 0; k < 40 && c.phase !== 'results'; k++) c.tick((t = c.phaseEndsAt));
  assert.equal(c.phase, 'results');
  c.tick((t += GAME.resultsSec * 1000));
  assert.equal(c.phase, 'recess');
  for (let k = 0; k < 3 && c.phase === 'recess'; k++) c.tick((t += 40_000));
  assert.equal(c.phase, 'intro');
  assert.equal(c.students.get('u299')!.score, 0);
  assert.ok(c.students.get('u299')!.session >= 10);
}

// ---------- voice rhythm: clock held while she reads, extra lines only while waiting for answers ----------
{
  const c = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog')], t);
  c.newRound(t);
  assert.ok(!c.chatterWindow(t), 'class intro: no greetings');
  c.tick((t += GAME.introSec * 1000));
  const end = c.phaseEndsAt;
  c.hold(4000); // she reads the question for 4 seconds
  assert.equal(c.phaseEndsAt, end + 4000, 'the clock starts after the question is read');
  assert.ok(c.chatterWindow(t + 4000), 'waiting for answers: greetings allowed');
  assert.ok(!c.chatterWindow(c.phaseEndsAt - GAME.chatterMinLeftMs + 1), 'almost out of time: no greetings');
  c.hold(GAME.maxHoldMs * 3);
  assert.equal(c.phaseEndsAt, end + GAME.maxHoldMs, 'the clock hold is capped');
  chat(c, 1, c.q!.answer, t + 4000, t + 4000);
  const reveal = c.tick((t = c.phaseEndsAt));
  assert.equal(c.phase, 'reveal');
  assert.ok(reveal.every((l) => l.main), 'answer reveal: only main lines, read in order');
  assert.ok(!c.chatterWindow(t), 'answer showing: no greetings');
}

// ---------- an answer containing "birthday": graded, does not trigger a birthday wish ----------
{
  const c = new Classroom([mk('BIRTHDAY'), mk('BIRTHDAY CAKE', 'easy', 'cake')], t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  chat(c, 7, c.q!.answer, t, t);
  assert.equal(c.correct[0]?.username, 'u7', `typing "${c.q!.answer}" must count as right`);
}
// typing the right answer of every question in the bank counts as right
for (const q of BANK) {
  const c = new Classroom([q], t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  if (c.phase !== 'question' || c.q?.id !== q.id) continue; // questions only asked in their own slot (math, riddles...) are skipped
  chat(c, 1, q.answer, t, t);
  assert.equal(c.correct.length, 1, `${q.id}: typed the right answer but it did not count`);
}

// ---------- nobody right: reveal a letter + extra time ----------
{
  const c = new Classroom([mk('CRÈME BRÛLÉE')], t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  c.tick((t += GAME.questionSec * 1000));
  assert.equal(c.phase, 'bonus');
  assert.equal(c.revealed.size, 1);
  c.tick((t += GAME.bonusSec * 1000));
  assert.equal(c.phase, 'reveal');
  // gifts give NO advantage (hintGiftCoins = 0): even a big gift reveals no letter, it is just flowers and thanks
  const g = new Classroom([mk('CRÈME BRÛLÉE')], t);
  g.newRound(t);
  g.tick((t += GAME.introSec * 1000));
  for (let i = 0; i < 20; i++) g.gift(who(1), 999, t);
  assert.equal(g.revealed.size, 0, 'gifts reveal no letters');
  assert.equal(g.flowers, 20);
}

// ---------- real class: 20 questions, 5 easy 6 medium 5 hard + 4 math (Q5, 10, 15, 19); Q20 counts double; streak of 3 ----------
{
  const c = new Classroom(BANK, t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  const plan: string[] = [];
  const cats: string[] = [];
  for (let k = 0; k < GAME.questionsPerRound; k++) {
    assert.equal(c.phase, 'question');
    const q = c.q!;
    plan.push(q.math ? GAME.roundPlan[k] : (q.slot ?? q.difficulty));
    if (!q.math) cats.push(q.slot === 'meo' ? `${q.category}#${k}` : q.category); // 2 riddles in a row on purpose (mid-class segment)
    else {
      assert.match(q.answer, /^\d+$/, 'math: the answer is a number');
      assert.equal(c.tiles.length, 0, 'math has no shuffled letters');
      assert.ok(c.view(t).math.endsWith('= ?'));
    }
    if (k === GAME.questionsPerRound - 1) assert.ok(c.golden, 'question 20 is the golden question');
    else assert.ok(!c.golden);
    chat(c, 1, q.answer, t, t);
    if (k === GAME.questionsPerRound - 1) assert.equal(c.correct[0].points, 20);
    c.tick((t += GAME.questionSec * 1000 + 1));
    c.tick((t += GAME.revealSec * 1000));
    // Q5, 10, 15: the teacher stops to name the best students, gives gifts, then the next question
    if ((k + 1) % GAME.praiseEvery === 0 && k + 1 < GAME.questionsPerRound) {
      assert.equal(c.phase, 'praise', `mid-class praise after question ${k + 1}`);
      assert.equal(c.view(t).praiseTop[0].username, 'u1');
      c.tick((t += GAME.praiseSec * 1000));
    }
  }
  assert.ok(c.students.get('u1')!.desk.length >= 3, 'praise gifts go on the desk');
  assert.ok(c.students.get('u1')!.desk.length <= GAME.deskGifts);
  assert.deepEqual(plan, [...GAME.roundPlan]);
  for (let i = 1; i < cats.length; i++) assert.notEqual(cats[i], cats[i - 1], 'no 2 word questions in a row on the same topic');
  // 19 questions x 10 + golden Q20 20 + 3 streak milestones (Q5, 12, 17) x 5
  assert.equal(c.students.get('u1')!.score, 19 * 10 + 20 + 3 * GAME.streakBonus);
  assert.equal(c.phase, 'results');
  assert.equal(c.usedLog.length, 16, 'math is not written to the class book');
}

// ---------- math: the answer matches the sum, always a positive number ----------
for (const lv of [1, 2, 3, 4] as const) {
  for (let i = 0; i < 500; i++) {
    const q = makeMath(lv);
    const expr = q.math!.show.replace(' = ?', '').replace(/×/g, '*').replace(/−/g, '-').replace(/÷/g, '/');
    const n = Function(`return ${expr}`)() as number;
    assert.equal(String(n), q.answer, q.math!.show);
    assert.ok(Number.isInteger(n) && n > 0, q.math!.show);
  }
}

// ---------- after the question she says go; at 5 s left she warns, the clock keeps running ----------
{
  const c = new Classroom(BANK, t);
  c.newRound(t);
  const start = c.tick((t += GAME.introSec * 1000));
  assert.equal(c.phase, 'question');
  assert.ok(LINES.go.includes(start[start.length - 1].text.slice(3)), 'the last line of the question is go');
  assert.ok(start[start.length - 1].go);
  assert.ok(start.every((l) => l.main));
  // she is reading (clock held): no letter board yet; it appears after go
  c.hold(3000);
  c.tick(t);
  assert.equal(c.view(t).boardShown, false, 'reading the question: no letters yet');
  c.showBoard();
  assert.equal(c.view(t).boardShown, true);
  assert.ok(!c.tick((t = c.phaseEndsAt - GAME.warnLeftSec * 1000 - 500)).some((l) => l.warn));
  const warn = c.tick((t += 600));
  assert.equal(warn.filter((l) => l.warn).length, 1);
  assert.ok(!warn.some((l) => l.warn && l.main), 'the time warning does not hold the clock');
  assert.ok(!c.tick((t += 200)).some((l) => l.warn), 'warned only once');
}

// ---------- questions asked recently are not asked again ----------
{
  const history: Record<string, number> = {};
  const c = new Classroom(BANK, t, Math.random, history);
  const asked = new Set<string>();
  // before the easy questions / riddles run out (whichever is smaller runs out first)
  const perRound = (d: string) => GAME.roundPlan.filter((x) => x === d).length;
  const easy = BANK.filter((q) => q.difficulty === 'easy' && !q.slot).length;
  const ofSlot = (s: string) => BANK.filter((q) => q.slot === s).length;
  const rounds = Math.min(Math.floor(easy / perRound('easy')), ...['meo', 'su', 'anh', 'dh'].map((s) => Math.floor(ofSlot(s) / perRound(s)))) - 2;
  for (let r = 0; r < rounds; r++) {
    c.newRound((t += 1000));
    for (const id of c.usedLog.splice(0)) {
      assert.ok(!asked.has(id), `question ${id} asked again in class ${r + 1}`);
      asked.add(id);
    }
  }
  // the next live (reading the old class book) does not repeat them either
  const next = new Classroom(BANK, t, Math.random, { ...history });
  next.newRound(t);
  const fresh = next.usedLog.filter((id) => !asked.has(id)).length;
  assert.equal(fresh, next.usedLog.length, 'the next live still prefers unasked questions');
  console.log(`  ${rounds} classes in a row (${asked.size} questions) without repeating a question`);
}

// ---------- recess ----------
const recessOf = (game: 'rps' | 'callup' | 'pick' | 'roll' | 'heart', seed = 0.1) => {
  const c = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog')], t, () => seed);
  c.newRound(t);
  for (let i = 0; i < 5; i++) chat(c, i, 'hi teacher', t, t); // in class, just active
  c.forceRecess(game, t);
  return c;
};
{
  // rock paper scissors: the teacher plays by rand; beating her +2 session points, class points untouched
  const c = recessOf('rps', 0.1); // rand 0.1 -> teacher throws "rock"
  chat(c, 1, 'paper', t, t);
  chat(c, 2, 'Scissors', t, t);
  chat(c, 1, 'scissors', t, t); // changing your mind does not count
  c.tick((t += GAME.recessPlaySec.rps * 1000));
  assert.equal(c.view(t).recess!.teacher, 'rock');
  assert.equal(c.students.get('u1')!.session, GAME.rpsPoints);
  assert.equal(c.students.get('u1')!.score, 0);
  assert.equal(c.students.get('u2')!.session, 0);
  c.tick((t += GAME.recessResultSec * 1000));
  assert.equal(c.recess!.stage, 'board');
  c.tick((t += GAME.recessBoardSec * 1000));
  assert.equal(c.phase, 'intro');
}
{
  // pop quiz: only the student called on may answer, right +5, closes at once
  const c = recessOf('callup');
  assert.equal(c.recess!.game, 'callup');
  const target = c.recess!.callTarget!;
  const answer = c.recess!.callQ!.answer;
  const other = [...c.students.values()].find((u) => u.username !== target.username)!;
  c.chat({ ...other, comment: answer, createTime: t }, t);
  assert.equal(c.recess!.callResult, '');
  c.chat({ ...target, comment: answer, createTime: t }, t);
  assert.equal(c.recess!.callResult, 'right');
  c.tick(t);
  assert.equal(c.students.get(target.username)!.session, GAME.callUpPoints);
}
{
  // pick a side: count 1/2, one vote each
  const c = recessOf('pick');
  chat(c, 1, '1', t, t);
  chat(c, 2, '2', t, t);
  chat(c, 3, '1', t, t);
  chat(c, 1, '2', t, t);
  assert.deepEqual(c.view(t).recess!.votes, [2, 1]);
  const out = c.tick((t += GAME.recessPlaySec.pick * 1000));
  assert.ok(out.some((l) => l.text.includes('67')), 'reads the winning side percentage');
}
{
  // roll call: the first 10 to type "here" (by TikTok time) +3
  const c = recessOf('roll');
  for (let i = 0; i < 15; i++) chat(c, 100 + i, i % 2 ? 'Here!' : 'present', t + 100 - i, t);
  c.tick((t += GAME.recessPlaySec.roll * 1000));
  assert.equal(c.students.get('u114')!.session, GAME.rollPoints);
  assert.equal(c.students.get('u100')!.session, 0);
}
{
  // hearts: no goal, counts the real hearts exactly (owner 2026-11-07), at the end reads the total + thanks the top sender
  const c = recessOf('heart');
  c.like(59, t, false, { username: 'u7', spoken: 'Hoa', nickname: 'Hoa' });
  c.like(1, t, false);
  assert.equal(c.recess!.hearts, 60, 'every heart is counted');
  assert.equal(c.view(t).recess?.topLiker?.nickname, 'Hoa');
  const said = c.tick((t += GAME.recessPlaySec.heart * 1000));
  assert.ok(said.some((l) => l.text.includes('60') && l.text.includes('Hoa')), 'reads the heart total, thanks the top sender');
}

// ---------- class monitor: a change is announced ----------
{
  const c = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog'), mk('HEN', 'easy', 'hen')], t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  const said: string[] = [];
  const step = () => {
    said.push(...c.tick((t += GAME.questionSec * 1000 + 1)).map((l) => l.text));
    c.tick((t += GAME.revealSec * 1000));
  };
  chat(c, 1, c.q!.answer, t, t);
  step();
  chat(c, 2, c.q!.answer, t, t);
  chat(c, 1, c.q!.answer, t + 1, t);
  step();
  chat(c, 2, c.q!.answer, t, t);
  said.push(...c.tick((t += GAME.questionSec * 1000 + 1)).map((l) => l.text));
  assert.equal(c.view(t).seats.find((x) => x.username === 'u2')!.title, 'lop-truong');
  assert.ok(said.some((l) => l.includes('Kid 2') && /monitor/i.test(l)), 'the teacher announces the new class monitor');
}

// ---------- class monitor only counts this class; a new class starts the race over ----------
{
  const c = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog')], t);
  const playRound = (winner: number) => {
    c.newRound(t);
    for (let k = 0; k < 200 && c.phase !== 'results'; k++) {
      if (c.phase === 'question' && c.correct.length === 0) chat(c, winner, c.q!.answer, t, t);
      c.tick((t = c.phaseEndsAt));
    }
  };
  playRound(1);
  assert.equal(c.view(t).seats.find((s) => s.username === 'u1')!.title, 'lop-truong');
  playRound(2);
  assert.equal(c.view(t).seats.find((s) => s.username === 'u2')!.title, 'lop-truong', 'class 2: the winner of class 2 is monitor');
  assert.equal(c.view(t).seats.find((s) => s.username === 'u1')!.title, '', 'last class points no longer count');
  c.newRound(t);
  assert.ok(c.view(t).seats.every((s) => s.title === ''), 'start of class: no monitor yet');
  assert.deepEqual(
    c.view(t).champions.map((x) => [x.round, x.username]),
    [
      [2, 'u2'],
      [1, 'u1'],
    ],
  );
}

// ---------- empty class: review with old questions, switch to new ones when someone joins ----------
{
  const history: Record<string, number> = {};
  const c = new Classroom(BANK, t, Math.random, history);
  c.newRound(t); // class 1: people around (just opened), new questions
  assert.ok(!c.review);
  const asked = new Set(c.usedLog.splice(0));
  t += GAME.emptyRoomMs + 1000; // 5 minutes of nothing
  const said = c.newRound(t);
  assert.ok(c.review, 'empty class: review class');
  assert.ok(said.some((l) => LINES.reviewIntro.includes(l.text.slice(3))));
  assert.equal(c.usedLog.length, 0, 'review uses no new questions');
  const qs = (c as unknown as { roundQs: Question[] }).roundQs;
  assert.ok(qs.filter((q) => !q.math).every((q) => asked.has(q.id)), 'review only asks questions asked before');
  c.tick((t += GAME.introSec * 1000)); // question 1 (review)
  chat(c, 1, 'hey miss', t, t); // someone joins
  for (let k = 0; k < 5 && c.qNo < 2; k++) c.tick((t = c.phaseEndsAt));
  assert.equal(c.qNo, 2);
  assert.ok(!c.review, 'someone joined: review over');
  assert.ok(c.usedLog.length > 0, 'the rest are new questions');
  assert.ok(c.view(t).review === false);
}

// ---------- reading: letter count + word kind first, letters appear after go ----------
{
  const c = new Classroom(BANK, t);
  const q = (answer: string, kind: string, slot?: 'anh' | 'su') => ({ ...mk(answer), kind, slot });
  assert.equal(c.intro(q('BLACKBOARD', 'This is something at school.')), 'This is a 10-letter word: something at school.');
  assert.equal(c.intro(q('NAPOLEON', 'History question.', 'su')), 'History question. It is an 8-letter word.');
  assert.equal(c.intro(q('CAT', 'Spelling question.', 'anh')), 'Spelling question. It is a 3-letter spelling word.');
}

// ---------- "Love the teacher? Type 1": asked while waiting for word answers, counted, thanked ----------
{
  const c = new Classroom([mk('CRÈME BRÛLÉE'), mk('DESK LAMP', 'easy', 'lamp')], t);
  t += GAME.engageEveryMs; // not asked for a long time
  for (let i = 0; i < 5; i++) chat(c, i, 'hi', t, t); // keep the class from being empty
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  c.showBoard();
  const call = c.tick(t);
  assert.ok(call.some((l) => LINES.loveCall.includes(l.text.slice(3))), 'the teacher asks for 1s');
  assert.ok(call.every((l) => !l.main), 'extra line, does not hold the clock');
  chat(c, 1, '1', t + 1000, t + 1000);
  chat(c, 1, '1', t + 1000, t + 1000); // typing twice counts once
  chat(c, 2, '1', t + 2000, t + 2000);
  assert.equal(c.view(t).loveFans, 2);
  assert.equal(c.correct.length + c.view(t).stats.attempts, 0, 'typing 1 is not counted as an answer');
  const thanks = c.tick((t += GAME.loveWindowMs));
  assert.ok(thanks.some((l) => /\b2 (of you|people)\b/.test(l.text)), 'the thanks include the count');
  assert.equal(c.love, null);

  // next turn: fun fact; the turn after: poll, count votes, read the result
  const nextTurn = () => {
    t += GAME.engageEveryMs;
    for (let i = 0; i < 5; i++) chat(c, i, 'hi', t, t);
    c.newRound(t);
    c.tick((t += GAME.introSec * 1000));
    c.showBoard();
    return c.tick(t);
  };
  assert.ok(nextTurn().some((l) => LINES.funFact.includes(l.text.slice(3))), 'the teacher tells a fun fact');
  const ask = nextTurn();
  assert.ok(c.poll, 'the teacher runs a poll');
  assert.ok(ask.some((l) => POLLS.some((p) => p.ask === l.text.slice(3))));
  const [a, b] = c.poll!.opts;
  chat(c, 1, a.key.toUpperCase(), t, t);
  chat(c, 2, a.key, t, t);
  chat(c, 3, b.key, t, t);
  chat(c, 3, a.key, t, t); // changing your mind does not count
  assert.equal(c.view(t).poll!.find((o) => o.key === a.key)!.n, 2);
  assert.equal(c.view(t).stats.attempts, 0, 'a 1-letter vote is not counted as an answer');
  const result = c.tick((t += GAME.loveWindowMs));
  assert.ok(result.some((l) => l.text.includes(a.label) && l.text.includes('2')), 'the teacher reads the poll result');
}

// ---------- student interaction: chat bubbles, walking up with flowers, standing up front, dozing off ----------
{
  const c = new Classroom([mk('CRÈME BRÛLÉE'), mk('DESK LAMP', 'easy', 'lamp')], t, () => 0); // rand 0: always tease, always stand up
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  const seat = (u: string) => c.view(t).seats.find((s) => s.username === u)!;
  chat(c, 1, 'miss i am hungry', t, t);
  assert.equal(seat('u1').bubble, 'miss i am hungry', 'ordinary comments show a bubble');
  chat(c, 2, 'X'.repeat(c.answerLetters.length), t, t); // wrong answer: not shown (same length as the answer)
  assert.equal(seat('u2').bubble, '', 'answers show no bubble (would give it away)');
  c.chat({ ...who(3), comment: 'rude words', createTime: t, safe: false }, t);
  assert.equal(seat('u3').bubble, '', 'comments with banned words are not shown');
  assert.equal(c.view(t + GAME.bubbleMs).seats.find((s) => s.username === 'u1')!.bubble, '', 'bubbles disappear by themselves');
  // flowers: walks up; while one is walking, another gift does not cut in
  c.gift(who(1), 1, t);
  c.gift(who(3), 1, t + 500);
  assert.equal(c.view(t).walk!.username, 'u1');
  assert.equal(c.view(t + GAME.walkMs).walk, null);
  // wrong answer: teased + stands up front
  const said = c.tick((t = c.phaseEndsAt));
  for (let k = 0; k < 3 && c.phase !== 'reveal'; k++) said.push(...c.tick((t = c.phaseEndsAt)));
  assert.ok(said.some((l) => LINES.roastStand.some((f) => f('Kid 2') === l.text.slice(3))), 'the teacher sends them up front');
  assert.ok(c.view(t).punished.some((p) => p.username === 'u2'), 'wrong answer stands next to the teacher');
  assert.ok(seat('u2').standing);
  assert.equal(c.view(t).punished[0].left, GAME.standQuestions, 'wrong answer stands for 3 questions');
  // quiet for long: dozes off
  assert.ok(c.view(t + GAME.sleepAfterMs + 1).seats.every((s) => s.sleeping));
}

// ---------- seating: on equal points active students sit before long-quiet ones ----------
{
  const c = new Classroom(BANK, t);
  chat(c, 1, 'hi', t, t); // joined first but then went quiet
  chat(c, 2, 'hi', t + 1000, t + 1000);
  assert.equal(c.seats()[0].username, 'u1', 'same points, both still here: who joined first sits first');
  t += GAME.seatActiveMs + 5000;
  chat(c, 2, 'hey miss', t, t);
  c.tick(t);
  assert.equal(c.seats()[0].username, 'u2', 'the long-quiet student gives the seat to the active one');
}

// ---------- greeting by time of day ----------
{
  const at = (h: number) => new Date(2026, 10, 4, h, 30).getTime();
  assert.deepEqual([6, 11, 15, 19, 23, 2].map((h) => dayPeriod(at(h))), ['sang', 'trua', 'chieu', 'toi', 'khuya', 'khuya']);
  const c = new Classroom(BANK, at(7));
  const first = c.newRound(at(7)).map((l) => l.text.slice(3));
  assert.ok(first.some((x) => LINES.timeMorning.includes(x)), 'first class: good morning');
  const night = c.newRound(at(23)).map((l) => l.text.slice(3));
  assert.ok(night.some((x) => LINES.timeNight.includes(x)), 'part of day changed: late-night greeting');
}

// ---------- "Drop this question" button: next question, no points, never asked again ----------
{
  const c = new Classroom(BANK, t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  const bad = c.q!;
  chat(c, 1, bad.answer, t, t);
  const said = c.banCurrent(t);
  assert.ok(said.some((l) => LINES.banned.includes(l.text.slice(3))), 'the teacher says the question is dropped');
  assert.equal(c.qNo, 2, 'next question at once');
  assert.equal(c.students.get('u1')!.score, 0, 'a dropped question scores nothing');
  assert.deepEqual(c.banLog.map((b) => b.id), [bad.id]);
  // next live reads the book: a dropped question never comes back
  const next = new Classroom(BANK.filter((q) => q.difficulty === bad.difficulty && !q.slot).slice(0, 30).concat(bad), t, Math.random, {}, [bad.id]);
  for (let r = 0; r < 5; r++) {
    next.newRound((t += 1000));
    assert.ok(!next.usedLog.splice(0).includes(bad.id), 'a dropped question was asked again');
  }
  // generated math cannot be dropped (it is not in a file)
  const m = new Classroom([], t);
  m.newRound(t);
  m.tick((t += GAME.introSec * 1000));
  assert.ok(m.q?.math);
  assert.deepEqual(m.banCurrent(t), []);
}

// ---------- quiet room: someone right closes 8 s later; busy room runs the full time ----------
{
  const small = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog')], t);
  small.newRound(t);
  small.tick((t += GAME.introSec * 1000));
  chat(small, 1, small.q!.answer, t, t);
  assert.equal(small.phaseEndsAt, t + GAME.smallRoomEndAfterSec * 1000);
  const big = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog')], t);
  big.newRound(t);
  big.tick((t += GAME.introSec * 1000));
  const end = big.phaseEndsAt;
  for (let i = 10; i < 10 + GAME.smallRoomPlayers; i++) chat(big, i, 'hello everyone', t, t);
  chat(big, 1, big.q!.answer, t, t);
  assert.equal(big.phaseEndsAt, end, 'busy room: full time');
}

// ---------- birthday: cake on the desk, applause, once per student, 1 minute apart ----------
{
  const c = new Classroom(BANK, t);
  c.newRound(t);
  assert.equal(chat(c, 1, 'happy birthday to her!', t, t).length, 0, 'wishing someone else does not count');
  const said = chat(c, 1, "Today is my birthday teacher", t, t);
  assert.equal(said.length, 1);
  assert.ok(said[0].priority && !said[0].main, 'said while waiting for answers, never interrupts a question');
  assert.equal(c.students.get('u1')!.desk.at(-1)!.icon, '🎂');
  assert.ok(c.view(t).clapping);
  assert.equal(c.view(t).birthday!.nickname, 'Kid 1');
  assert.equal(chat(c, 2, "it's my birthday", t + 1000, t + 1000).length, 0, 'less than 1 minute apart');
  assert.equal(chat(c, 1, 'my birthday again', t + 120_000, t + 120_000).length, 0, 'once per student');
  assert.equal(chat(c, 2, "it's my birthday", t + 120_000, t + 120_000).length, 1);
}

// ---------- attendance: recognised from day 2, nice milestones get a gift ----------
{
  const c = new Classroom(BANK, t);
  assert.equal(c.attendance(who(1), 1, t).length, 0, 'day 1: nothing said');
  assert.equal(c.attendance(who(2), 2, t).length, 1);
  const before = c.students.get('u3')?.desk.length ?? 0;
  const ms = c.attendance(who(3), GAME.attendMilestones[0], t);
  assert.ok(ms[0].priority);
  assert.equal(c.students.get('u3')!.desk.length, before + 1, 'attendance milestone gets a gift');
  assert.equal(c.view(t).seats.find((s) => s.username === 'u3')!.days, GAME.attendMilestones[0]);
}

// ---------- the class picks the next topic ----------
{
  const c = new Classroom(BANK, t);
  c.newRound(t);
  for (let k = 0; k < 200 && c.phase !== 'vote'; k++) c.tick((t = c.phaseEndsAt));
  assert.equal(c.phase, 'vote');
  const [a, b] = c.view(t).vote!.topics;
  assert.notEqual(a, b);
  chat(c, 1, '2', t, t);
  chat(c, 2, '2', t, t);
  chat(c, 2, '1', t, t); // changing your mind does not count
  chat(c, 3, '1', t, t);
  assert.deepEqual(c.view(t).vote!.counts, [1, 2]);
  c.tick((t = c.phaseEndsAt));
  assert.equal(c.phase, 'intro');
  assert.equal(topicName(c.topic), b);
  assert.equal(topicName('Idioms (fill the gap)'), 'Idioms');
  const qs = (c as unknown as { roundQs: Question[] }).roundQs;
  assert.equal(qs.filter((q) => q.category === c.topic && !q.slot).length, GAME.voteTopicQuestions, 'the winning topic gets 5 questions');
}

// ---------- report: every question asked records how many tried / got it ----------
{
  const c = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog')], t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  for (let i = 0; i < 6; i++) chat(c, i, i < 4 ? c.q!.answer : 'XYZ', t, t);
  for (let k = 0; k < 5 && c.phase !== 'reveal'; k++) c.tick((t = c.phaseEndsAt));
  assert.deepEqual(
    c.reportLog.map((r) => [r.attempts, r.correct]),
    [[6, 4]],
  );
}

// ---------- teams: 45 s to pick, the rest are assigned, students joining mid-class get one at once ----------
{
  GAME.teamPickSec = TEAM_SEC;
  assert.equal(teamOf('team 2'), 2);
  assert.equal(teamOf('TEAM3'), 3);
  assert.equal(teamOf('t4'), 4);
  assert.equal(teamOf('1'), 1);
  assert.equal(teamOf('team three'), 3);
  assert.equal(teamOf('team 5'), 0);
  assert.equal(teamOf('hi teacher'), 0);
  const c = new Classroom([mk('CAT'), mk('DOG', 'easy', 'dog')], t, () => 0.1);
  chat(c, 1, 'hi teacher', t, t); // joined before class: already has a team, can still change while picking
  c.newRound(t);
  assert.equal(c.phase, 'team');
  chat(c, 1, 'team 3', t, t);
  chat(c, 2, 'team 3', t, t);
  chat(c, 3, 'to 1', t, t);
  chat(c, 3, 'team 2', t, t); // change of mind: the last pick counts
  for (let i = 4; i < 10; i++) chat(c, i, 'hello', t, t); // 6 students do not pick
  assert.equal(c.view(t).noTeam, 6);
  const remind = c.tick((t = c.phaseEndsAt - GAME.teamRemindLeftSec * 1000));
  assert.ok(remind.some((l) => l.text.includes('Team 3, 2 students')), '15 s left: the teacher reads the team sizes');
  const close = c.tick((t = c.phaseEndsAt));
  assert.equal(c.phase, 'intro');
  assert.ok(close.some((l) => l.text.includes('6 students without a team')));
  const st = c.students;
  assert.equal(st.get('u1')!.team, 3);
  assert.equal(st.get('u3')!.team, 2);
  assert.ok([...st.values()].every((s) => s.team >= 1 && s.team <= 4), 'nobody left out');
  const sizes = c.teamStats(t).map((x) => x.members);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `even split: ${sizes}`);
  chat(c, 50, 'hi miss', t, t); // joins mid-class: team assigned at once
  assert.ok(st.get('u50')!.team > 0);
  // a team 3 student answers right -> team 3 wins the flag at the end of the class
  c.tick((t = c.phaseEndsAt));
  assert.equal(c.phase, 'question');
  for (let k = 0; k < 40 && c.phase !== 'results'; k++) {
    if (c.phase === 'question') chat(c, 1, c.q!.answer, t, t);
    c.tick((t = c.phaseEndsAt));
  }
  assert.equal(c.phase, 'results');
  assert.deepEqual(c.lastTeamWin, [3]);
  assert.equal(c.teamWins[2], 1);
  assert.equal(c.view(t).teams[2].wins, 1);
  // next class: same teams, team points start over
  c.newRound(t);
  assert.equal(c.phase, 'team');
  assert.equal(st.get('u1')!.team, 3);
  assert.equal(c.teamStats(t)[2].score, 0, 'team points restart every class');
  GAME.teamPickSec = 0;
}

// ---------- report card: lifetime points -> grades, badges, typing "reportcard" ----------
{
  assert.equal(gradeOf(0), 1);
  assert.equal(gradeOf(GAME.gradePoints[1]), 2);
  assert.equal(gradeOf(GAME.gradePoints[12]), 13, 'the last threshold means graduated');
  const c = new Classroom([mk('CRÈME BRÛLÉE'), mk('DESK LAMP', 'easy', 'lamp')], t);
  // the server sends the report card: almost grade 2, almost the hard-worker badge
  c.attendance(who(1), 1, t, { ...emptyLife(), points: GAME.gradePoints[1] - 5, total: 299 });
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  chat(c, 1, c.q!.answer, t, t);
  const said: string[] = [];
  for (let k = 0; k < 4 && c.phase !== 'reveal'; k++) said.push(...c.tick((t = c.phaseEndsAt)).map((l) => l.text));
  said.push(...c.tick((t += 200)).map((l) => l.text)); // the congratulation is said on the next tick
  assert.ok(said.some((x) => x.includes('grade 2')), 'the teacher congratulates on grade 2');
  assert.ok(said.some((x) => x.includes('Hard Worker')), 'the teacher announces the new badge');
  assert.equal(c.view(t).seats.find((s) => s.username === 'u1')!.grade, 2);
  assert.ok(c.students.get('u1')!.desk.some((g) => g.icon === '🎓'));
  const d = c.lifeDelta.get('u1')!;
  assert.equal(d.total, 1, 'waiting for the server: 1 right answer');
  assert.ok(d.points >= 10);
  // typing "reportcard": the teacher reads grade, points, badges; typing it again right away does nothing
  const card = chat(c, 1, 'report card', (t += 1000), t);
  assert.ok(card[0].text.includes('grade 2') && card[0].text.includes('Hard Worker'));
  assert.equal(chat(c, 1, 'hoc ba', (t += 1000), t).length, 0);
}

// ---------- today's interaction: 1 comment = 1 (2 s apart), 1 gift = 10 ----------
{
  const c = new Classroom(BANK, t);
  chat(c, 1, 'a', t, t);
  chat(c, 1, 'b', t + 500, t + 500); // spamming within 2 s: not counted
  chat(c, 1, 'c', t + GAME.talkGapMs, t + GAME.talkGapMs);
  c.gift(who(1), 1, t, 3);
  assert.equal(c.talkDelta.get('u1')!.points, 2 + 3 * GAME.talkPerGift);
}

// ---------- no seats left: active students without a seat are waiting; long-gone students are cleared out ----------
{
  const c = new Classroom(BANK, t);
  for (let i = 0; i < GAME.seats + 7; i++) chat(c, i, 'hi', t, t);
  assert.deepEqual(c.view(t).roster, { seated: GAME.seats, seats: GAME.seats, waiting: 7 });
  assert.equal(c.view(t).standing.length, 0, 'no crowd drawn outside the door');
  c.weekDelta.clear();
  c.lifeDelta.clear();
  t += GAME.forgetAfterMs + 1000;
  chat(c, 1, 'still here', t, t);
  c.newRound(t);
  assert.equal(c.students.size, 1, 'long-gone students are cleared, active ones stay');
}

// ---------- gifts: bunch tiers, flower fund milestones, instant thanks ----------
{
  assert.deepEqual([1, 9, 10, 98, 99, 499, 500, 30000].map(tierOf), [0, 0, 1, 1, 2, 2, 3, 3]);
  const c = new Classroom(BANK, t);
  c.setFlowersSaved(GAME.flowerGoals[0] - 3); // server: close to the first milestone
  const first = c.gift(who(1), 1, t, 1);
  assert.ok(first[0].warn && !first[0].main, 'thanks said at once, clock not held');
  assert.ok(first[0].text.includes('Kid 1') && first[0].text.includes('a flower'));
  assert.equal(c.view(t).walk!.tier, 0);
  const big = c.gift(who(2), 99, t + 1000, 1); // someone is already walking up: no cut-in, but it still goes into the fund
  assert.ok(!big.some((l) => l.text.includes('a huge bouquet')));
  // one gift passes several milestones (47 -> 147 passes 50 and 100): she announces the highest
  assert.ok(big.some((l) => l.text.includes(String(GAME.flowerGoals.filter((g) => g <= GAME.flowerGoals[0] - 3 + 1 + 99).pop()))), 'flower fund milestone: the teacher thanks the class');
  const v = c.view(t + 1000);
  assert.equal(v.fund.today, GAME.flowerGoals[0] - 3 + 1 + 99);
  assert.equal(v.fund.goal, GAME.flowerGoals.find((g) => g > v.fund.today));
  assert.equal(v.fund.party, GAME.flowerGoals.filter((g) => g <= v.fund.today).pop());
  assert.deepEqual(v.gifts.map((g) => g.tier), [0, 2], 'gifts on the table behind her by tier');
  assert.equal(c.flowerDelta, 100, '100 flowers waiting for the server');
  // the server returns the saved amount: the unsent part is kept
  c.flowerDelta = 0;
  c.setFlowersSaved(500);
  assert.equal(c.flowersToday, 500);
}

// ---------- Top 5 fastest board: time to the millisecond (from go), 10/7/5/3/3, slower +1 ----------
{
  const c = new Classroom([mk('CRÈME BRÛLÉE'), mk('DESK LAMP', 'easy', 'lamp')], t);
  c.newRound(t);
  c.tick((t += GAME.introSec * 1000));
  const start = t;
  c.hold(3000); // she reads for 3 seconds: the clock has not started
  const skew = 1500; // TikTok clock 1.5 s behind the PC
  const at = (sec: number) => start + 3000 + sec * 1000; // PC time when the viewer sent it
  // 7 students right, arriving out of order; student 9 sent first
  [[1, 2.345], [2, 1.2], [3, 4.5], [4, 3.25], [5, 6.1], [6, 7.003], [9, 0.987]].forEach(([u, sec], k) =>
    chat(c, u, c.q!.answer, at(sec) - skew, at(sec) + 200 + k * 10),
  );
  const v = c.view(t);
  assert.deepEqual(
    v.fastest.map((a) => [a.username, a.points]),
    [
      ['u9', 10],
      ['u2', 7],
      ['u1', 5],
      ['u4', 3],
      ['u3', 3],
    ],
  );
  // time: exact to the millisecond, plus the smallest network delay (200 ms here) + a little drift; always rising with the rank
  const real = [987, 1200, 2345, 3250, 4500];
  v.fastest.forEach((a, i) => assert.ok(a.ms >= real[i] && a.ms - real[i] <= 300, `${a.username}: ${a.ms} ms, real ${real[i]} ms`));
  for (let i = 1; i < 5; i++) assert.ok(v.fastest[i].ms >= v.fastest[i - 1].ms);
  assert.equal(v.laterCount, 2);
  assert.equal(v.laterPoints, 1);
  assert.deepEqual(c.correct.slice(5).map((a) => a.points), [1, 1], 'slower than the top 5: +1');
}

// ---------- The 2 big shows: Road to Everest, Golden Bell ----------
{
  const sdir = path.join(import.meta.dirname, 'show-bank');
  const SHOW = { mc: parseMc(fs.readFileSync(path.join(sdir, 'multiple-choice.txt'), 'utf8')), codes: parseCodes(fs.readFileSync(path.join(sdir, 'passwords.txt'), 'utf8')) };
  assert.equal(choiceOf('B'), 1);
  assert.equal(choiceOf('answer c'), 2);
  assert.equal(choiceOf('pick D'), 3);
  assert.equal(choiceOf('a.'), 0);
  assert.equal(choiceOf('ab'), -1);
  assert.equal(choiceOf('hello'), -1);
  type Sh = { steps: { k: string; tag?: string }[]; i: number; stage: string; mc: { ans: number; tag: string } | null; code: { answer: string } | null; tickets: Set<string>; scores: Map<string, number> };
  const sh = (c: Classroom) => (c as unknown as { show: Sh }).show;
  const step = (c: Classroom) => sh(c).steps[sh(c).i];
  /** run to the next step that waits for answers (she has said go) */
  const toAsk = (c: Classroom) => {
    for (let k = 0; k < 20; k++) {
      if (c.phase !== 'show' || step(c).k === 'honor') return;
      const st = step(c);
      if (sh(c).stage === 'ask' && ['mc', 'stake', 'code'].includes(st.k)) {
        c.showBoard();
        return;
      }
      c.tick((t = c.phaseEndsAt));
    }
  };
  const wrongOf = (a: number) => 'ABCD'[(a + 1) % 4];

  // --- Everest ---
  const c = new Classroom(BANK, t, () => 0.3);
  c.showBank = SHOW;
  for (let i = 1; i <= 4; i++) chat(c, i, 'hi', t, t);
  c.forceShow('everest', t);
  assert.equal(c.phase, 'show');
  assert.equal(c.view(t).outfit, 'everest', 'Everest means climbing gear');
  // first steps: 4 questions, right +10, one answer each, nothing counts before go
  for (let q = 0; q < 4; q++) {
    toAsk(c);
    assert.equal(step(c).k, 'mc');
    const a = sh(c).mc!.ans;
    if (q === 0) {
      (c as unknown as { boardShown: boolean }).boardShown = false;
      chat(c, 4, 'ABCD'[a], t, t); // she has not said go: does not count
      c.showBoard();
    }
    chat(c, 1, 'ABCD'[a], t, t);
    chat(c, 2, wrongOf(a), t, t);
    chat(c, 2, 'ABCD'[a], t, t); // change of mind: only the first counts
    c.tick((t = c.phaseEndsAt)); // show the answer
    assert.equal(sh(c).stage, 'reveal');
  }
  assert.equal(sh(c).scores.get('u1'), 40);
  assert.equal(sh(c).scores.get('u2') ?? 0, 0);
  assert.equal(sh(c).scores.get('u4') ?? 0, 0, 'typed before go does not count');
  assert.equal(c.students.get('u1')!.session, 40, 'big-show points go to session / report card');
  // password: student 3 solves it on clue 2 for 20, student 1 guesses wrong on clue 1 then solves it on clue 2
  toAsk(c);
  assert.equal(step(c).k, 'code');
  const code = sh(c).code!.answer;
  chat(c, 1, 'x'.repeat(code.replace(/\s/g, '').length), t, t); // wrong guess (right number of letters)
  chat(c, 1, code.toLowerCase(), t, t); // already guessed on this clue: does not count
  c.tick((t = c.phaseEndsAt));
  toAsk(c);
  chat(c, 3, code.toLowerCase(), t, t);
  chat(c, 1, code.toLowerCase(), t, t);
  assert.equal(sh(c).scores.get('u3'), 20);
  assert.equal(sh(c).scores.get('u1'), 60);
  c.tick((t = c.phaseEndsAt)); // clue 3
  c.tick((t = c.phaseEndsAt)); // someone solved it: no rescue, straight to showing the password
  assert.equal(step(c).k, 'codeReveal');
  // speed storm: 4 questions +15 for student 3
  for (let q = 0; q < 4; q++) {
    toAsk(c);
    chat(c, 3, 'ABCD'[sh(c).mc!.ans], t, t);
    c.tick((t = c.phaseEndsAt));
  }
  assert.equal(sh(c).scores.get('u3'), 80);
  // summit: student 1 bets 20 and gets all 3, student 3 does not bet (counts as 10)
  for (let q = 0; q < 3; q++) {
    toAsk(c);
    assert.equal(step(c).k, 'stake');
    chat(c, 1, '20', t, t);
    c.tick((t = c.phaseEndsAt));
    toAsk(c);
    assert.equal(sh(c).mc!.tag, 'peak');
    chat(c, 1, 'ABCD'[sh(c).mc!.ans], t, t);
    chat(c, 3, 'ABCD'[sh(c).mc!.ans], t, t);
    c.tick((t = c.phaseEndsAt));
  }
  assert.equal(sh(c).scores.get('u1'), 120);
  assert.equal(sh(c).scores.get('u3'), 110);
  // no tie: skip the tiebreaker, go to the honours
  for (let k = 0; k < 5 && step(c).k !== 'honor'; k++) c.tick((t = c.phaseEndsAt));
  assert.equal(step(c).k, 'honor');
  const hv = c.view(t).show!;
  assert.equal(hv.honors[0].username, 'u1');
  assert.ok(hv.honors[0].title.includes('Everest'));
  assert.ok(c.view(t).seats.find((s) => s.username === 'u1')!.showIcons.includes('🚩'), 'titles show on the name tag');
  c.tick((t = c.phaseEndsAt));
  assert.equal(c.phase, 'vote', 'after the show: vote for the next topic');
  assert.equal(c.show, null);

  // --- Golden Bell: hint ticket, tiebreaker on a tie, ringing the bell ---
  const d = new Classroom(BANK, t, () => 0.3);
  d.showBank = SHOW;
  for (let i = 1; i <= 3; i++) chat(d, i, 'hi', t, t);
  d.forceShow('chuong', t);
  for (let k = 0; k < 40 && d.phase === 'show' && step(d).k !== 'honor'; k++) {
    toAsk(d);
    if (d.phase !== 'show' || step(d).k === 'honor') break;
    const m = sh(d).mc;
    if (m) {
      if (m.tag === 'final' && sh(d).tickets.has('u2') && !d.view(t).show!.ticketUser) {
        const said = chat(d, 2, 'hint', t, t);
        assert.ok(said.some((l) => l.warn), 'ticket used: said at once, clock not held');
        assert.equal(d.view(t).show!.removed.length, 2);
        assert.ok(!d.view(t).show!.removed.includes(m.ans), 'only wrong options are removed');
      }
      // students 1 and 2 get everything, student 3 only the rescue question; on the tiebreaker only student 2 is right
      const right = 'ABCD'[m.ans];
      if (m.tag === 'tie') {
        chat(d, 3, right, t, t); // not tied: does not count
        chat(d, 2, right, t, t);
        chat(d, 1, wrongOf(m.ans), t, t);
      } else {
        chat(d, 1, right, t, t);
        chat(d, 2, right, t, t);
        if (m.tag === 'rescue') chat(d, 3, right, t, t);
      }
    }
    d.tick((t = d.phaseEndsAt));
  }
  assert.equal(step(d).k, 'honor');
  const dv = d.view(t).show!;
  assert.equal(sh(d).scores.get('u1'), sh(d).scores.get('u2'), 'students 1 and 2 tied');
  assert.equal(dv.honors[0].username, 'u2', 'right on the tiebreaker ranks higher');
  assert.ok(dv.honors[0].title.includes('Bell'));
  assert.deepEqual(dv.bellRingers.length, 2);
  assert.ok((d.titles.get('u3') ?? []).some((x) => x.includes('Helper')), 'right on the rescue question: Helper');

  // --- one show every 2 classes, alternating; outfit changes after each class ---
  const e = new Classroom(BANK, t, () => 0.5);
  e.showBank = SHOW;
  const outfits = new Set<string>();
  const kinds: string[] = [];
  for (let r = 0; r < 4; r++) {
    e.newRound((t += 1000));
    let before = e.outfit;
    for (let k = 0; k < 200 && e.phase !== 'results'; k++) {
      if (e.phase === 'question') before = e.outfit; // outfit worn during the last questions of the class
      e.tick((t = e.phaseEndsAt));
    }
    assert.notEqual(e.outfit, before, 'after 20 questions the teacher changes outfit');
    outfits.add(e.outfit);
    e.tick((t = e.phaseEndsAt));
    if (e.phase === 'show') kinds.push(e.show!.kind);
    else assert.equal(e.phase, 'recess');
  }
  assert.deepEqual(kinds, ['everest', 'chuong'], 'class 2 Everest, class 4 Golden Bell');
  // events board: class 1 shows "after class 2", class 2 shows "right after this class" + the teacher warns by voice
  const f = new Classroom(BANK, t, () => 0.5);
  f.showBank = SHOW;
  f.newRound((t += 1000));
  assert.deepEqual(f.nextShow(), { kind: 'everest', name: 'Road to Everest', afterRound: 2, now: false, soon: false });
  for (let k = 0; k < 200 && f.phase !== 'recess'; k++) f.tick((t = f.phaseEndsAt));
  assert.equal(f.nextShow()!.afterRound, 2, 'recess after class 1: the next show is still after class 2');
  const intro2 = f.newRound((t += 1000));
  assert.ok(f.nextShow()!.soon);
  assert.ok(intro2.some((l) => LINES.showSoon.some((fn) => l.text.includes(fn('Road to Everest')))), 'start of class 2: the teacher says Everest comes after this class');
  assert.ok([...outfits].every((o) => (GAME.outfits as readonly string[]).includes(o)));
}

// ---------- streaks: praised only at 5, 12, 17; several students at the same milestone share one line, at most 3 names ----------
{
  const c = new Classroom(Array.from({ length: 30 }, (_, i) => mk('CRÈME BRÛLÉE' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26] + (i >= 26 ? 'X' : ''))), t);
  c.newRound(t);
  const streakSaid: string[][] = [];
  for (let q = 1; q <= 5; q++) {
    while (c.phase !== 'question') c.tick((t += 500));
    c.showBoard();
    for (let i = 1; i <= 4; i++) chat(c, i, c.q!.answer, t, (t += 10));
    let said: string[] = [];
    while ((c.phase as string) !== 'reveal') said = c.tick((t += 500)).map((l) => l.text);
    streakSaid.push(said.filter((x) => /in a row|without a miss|streak club|streak of/.test(x)));
  }
  assert.deepEqual(streakSaid.slice(0, 4), [[], [], [], []], 'no streak praise before 5 in a row');
  assert.equal(streakSaid[4].length, 1, '4 students hit 5 together: one shared line');
  assert.ok(streakSaid[4][0].includes(' 5 ') && streakSaid[4][0].includes('and 1 other'), streakSaid[4][0]);
  for (let i = 1; i <= 4; i++) assert.equal(c.students.get(`u${i}`)!.streak, 5);
}

// ---------- gifts on the "For Teacher" board: thanked by name, the student carries that very gift, it is displayed ----------
{
  const c = new Classroom([mk('CRÈME BRÛLÉE')], t);
  c.newRound(t);
  const said = c.gift(who(1), 30, t, 1, 'Doughnut');
  assert.ok(said.some((l) => LINES.thankDonut.some((f) => f('Kid 1') === l.text.slice(3))), 'donut: the teacher uses its own reply');
  assert.equal(c.view(t).walk!.icon, '🍩');
  const heart = c.gift(who(3), 5, t + 2 * GAME.walkMs, 1, 'Finger Heart');
  assert.ok(heart.some((l) => LINES.thankHeart.some((f) => f('Kid 3') === l.text.slice(3))), 'heart: the teacher uses the heart reply');
  assert.equal(c.view(t).gifts[0].icon, '🍩');
  c.gift(who(2), 3, t + GAME.walkMs + 1, 1, 'Odd gift');
  assert.equal(c.view(t + GAME.walkMs + 1).gifts[2].icon, GAME.giftTiers[0].icon, 'other gifts: icon by tier as before');
}

// ---------- answer sent while she was still reading but arriving late (after the board shows): no score, turn kept ----------
{
  Object.assign(GAME, FAST);
  const c = new Classroom(BANK, t);
  c.newRound(t);
  while (c.phase !== 'question') c.tick((t += 500));
  while (c.q!.math || c.q!.slot === 'meo') c.tick((t += 500)); // word question (long answer) to make it easy to test
  const delay = 1000; // TikTok comments reach the PC 1 s late
  chat(c, 801, 'hi teacher', t - delay, t); // a few ordinary comments to measure the clock skew
  chat(c, 802, 'so good', t - delay, t);
  const shownAt = t + 2000;
  c.showBoard(shownAt);
  t = shownAt + 300;
  chat(c, 9, c.q!.answer, shownAt - 2500, t); // sent while she was still reading, arrives after the board shows
  assert.equal(c.correct.length, 0, 'sent before the board showed: no score even if it arrives late');
  t = shownAt + 3000;
  chat(c, 9, c.q!.answer, t - delay, t); // saw the board on the live, then typed
  assert.equal(c.correct.length, 1, 'turn kept: retyping after the board shows counts');
  assert.ok(c.view(t).fastest.length === 0 || c.view(t).fastest[0].ms > 0);
}

// ---------- class settings: rename the teacher, the 2 big shows on/off ----------
{
  const c = new Classroom(BANK, t);
  c.newRound(t);
  c.teacherName = 'Ms. Lan';
  const said = LINES.teamIntro.map(() => c.newRound(t)).flat().map((l) => l.text).join(' ');
  assert.ok(!said.includes('Ngan'), 'renamed: the lines no longer use the old name');
  c.show = null;
  c.showBank = { mc: [{ id: 'x' } as never], codes: [] }; // nextShow only needs questions
  assert.equal(c.nextShow()?.kind, 'everest');
  c.showsOn = { everest: false, chuong: true };
  assert.equal(c.nextShow()?.kind, 'chuong', 'Everest off: the next show is Golden Bell');
  c.showsOn = { everest: false, chuong: false };
  assert.equal(c.nextShow(), null, 'both off: no big show');
}

// ---------- "Say goodbye" button: goodbye line (with the leader's name), end-of-class banner ----------
{
  const c = new Classroom([mk('CRÈME BRÛLÉE')], t);
  c.newRound(t);
  let said = c.goodbye(t);
  assert.ok(said[0].main && LINES.goodbye.some((x) => said[0].text.endsWith(x)), 'nobody has points: general goodbye');
  assert.ok(c.view(t + 1000).goodbye, 'end-of-class banner');
  assert.equal(c.view(t + GAME.goodbyeBannerSec * 1000 + 1).goodbye, null);
  while (c.phase !== 'question') c.tick((t += 500));
  c.showBoard();
  chat(c, 1, c.q!.answer, t, t);
  while ((c.phase as string) !== 'reveal') c.tick((t += 500));
  said = c.goodbye(t);
  assert.ok(LINES.goodbyeTop.some((f) => f('Kid 1') === said[0].text.slice(3)), 'there is a leader: the teacher names them');
}

// ---------- emoji puzzle: the first letter of each word is shown in the answer boxes ----------
{
  const dh = BANK.find((q) => q.answer === 'COUCH POTATO')!;
  const c = new Classroom([dh], t);
  c.newRound(t);
  while (c.phase !== 'question') c.tick((t += 500));
  assert.equal(c.slots().map((x) => x ?? '_').join(''), 'C____ P_____');
}

// ---------- wrong answer: stand next to the teacher for 3 questions, limited, first wrong first up ----------
{
  const c = new Classroom(Array.from({ length: 30 }, (_, i) => mk('CRÈME BRÛLÉE' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26] + (i >= 26 ? 'X' : ''))), t);
  c.newRound(t);
  const ask = () => {
    while (c.phase !== 'question') c.tick((t += 500));
    c.showBoard();
  };
  const toReveal = () => {
    while ((c.phase as string) !== 'reveal') c.tick((t += 500));
  };
  ask();
  for (let i = 1; i <= 5; i++) chat(c, i, 'X'.repeat(c.answerLetters.length), t, (t += 10)); // 5 students wrong
  toReveal();
  assert.deepEqual(c.view(t).punished.map((p) => p.username), ['u1', 'u2', 'u3', 'u4', 'u5'], 'every wrong answer stands up front (at most 6)');
  for (let q = 2; q <= 4; q++) {
    ask();
    toReveal();
    if (q < 4) assert.equal(c.view(t).punished.length, 5, `still standing at question ${q}`);
  }
  assert.equal(c.view(t).punished.length, 0, 'after 3 questions back to the seat');
}

// ---------- quick mode: short reading, board + answers only after reading, 5 right closes early, one praise line after Q10 ----------
{
  Object.assign(GAME, FAST);
  const c = new Classroom(BANK, t);
  c.newRound(t);
  let asked: ReturnType<Classroom['tick']> = [];
  while (c.phase !== 'question') asked = c.tick((t += 500));
  assert.ok(!c.boardShown, 'reading the question: no letter board yet');
  const qLine = asked.find((l) => l.text.includes('Question 1.'))!;
  assert.ok(qLine && qLine.main && qLine.showAfter, 'the question is a main line (clock held), the board shows after reading');
  assert.ok(/\d+-letter word\.|, \d+ letters\./.test(qLine.text), 'reads "A N-letter word."');
  assert.ok(!asked.some((l) => l.go), 'no go line');
  chat(c, 77, c.q!.answer, t, t); // typed before the board shows: no score, turn kept
  assert.equal(c.correct.length, 0, 'answers typed before she finished reading do not count');
  c.showBoard();
  chat(c, 77, c.q!.answer, t, (t += 10));
  assert.equal(c.correct.length, 1, 'once the board shows, retyping counts');
  const end = c.phaseEndsAt;
  for (let i = 1; i <= 5; i++) chat(c, i, c.q!.answer, t, (t += 10));
  assert.ok(c.phaseEndsAt <= t + GAME.closeAfterTopSec * 1000 && c.phaseEndsAt < end, '5 right answers close it early');
  let praise: ReturnType<Classroom['tick']> = [];
  while (c.qNo < 11 && (c.phase as string) !== 'results') {
    const said = c.tick((t += 500));
    if ((c.phase as string) === 'praise' && said.length) praise = said;
    if ((c.phase as string) === 'question' && c.correct.length === 0) chat(c, 1, c.q!.answer, t, t);
  }
  assert.equal(praise.length, 1, 'mid-class praise is one line');
  assert.ok(c.qNo === 11, 'praise after question 10');
  // team picking only in class 1, 5, 9...
  GAME.teamPickSec = TEAM_SEC;
  const rounds: string[] = [];
  const r = new Classroom(Array.from({ length: 30 }, (_, i) => mk('CRÈME BRÛLÉE' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26] + (i >= 26 ? 'X' : ''))), t);
  for (let i = 0; i < 5; i++) {
    r.newRound((t += 1000));
    rounds.push(r.phase);
  }
  assert.deepEqual(rounds, ['team', 'intro', 'intro', 'intro', 'team']);
}

// ---------- 2026-11-07: fix for "typed the right answer but it did not count" ----------
{
  Object.assign(GAME, FAST);
  const ask = (c: Classroom) => {
    c.newRound(t);
    while (c.phase !== 'question') c.tick((t += 500));
    c.showBoard(t);
  };
  // 1) comments without a real TikTok timestamp (test button, TikTok left it out) must not pull the clock skew to 0
  const c = new Classroom([mk('CRÈME BRÛLÉE')], t);
  const SKEW = 5000; // PC clock 5 s ahead of TikTok time
  for (let i = 0; i < 5; i++) c.chat({ ...who(100 + i), comment: 'hiya', createTime: t - SKEW - 300 }, t);
  c.chat({ ...who(200), comment: 'test', createTime: t, realTime: false }, t); // test button: PC clock
  ask(c);
  t += 4000; // viewers see the board a few seconds late, then type
  c.chat({ ...who(1), comment: 'crème brûlée', createTime: t - SKEW - 300 }, t + 300);
  assert.equal(c.correct.length, 1, 'answers sent after the board shows count, even with test comments around');
  // 2) skew measured wrong: comments arriving after the first few seconds always count
  const d = new Classroom([mk('CRÈME BRÛLÉE')], t);
  for (let i = 0; i < 3; i++) d.chat({ ...who(100 + i), comment: 'hiya', createTime: t }, t); // measured skew = 0
  ask(d);
  t += GAME.earlyCheckWindowMs + 500;
  d.chat({ ...who(1), comment: 'crème brûlée', createTime: t - 20_000 }, t); // TikTok time 20 s off (PC clock fast)
  assert.equal(d.correct.length, 1, 'arriving after the first 3 s: always counts');
  // really sent while she was reading, arriving right when the board shows: still no score, turn kept
  const e = new Classroom([mk('CRÈME BRÛLÉE')], t);
  for (let i = 0; i < 3; i++) e.chat({ ...who(100 + i), comment: 'hiya', createTime: t - 200 }, t);
  ask(e);
  e.chat({ ...who(1), comment: 'crème brûlée', createTime: t - 4000 }, t + 100);
  assert.equal(e.correct.length, 0, 'sent while she was reading: no score');
  assert.equal(e.stats.early, 1, 'early answers are counted in the stats');
  e.chat({ ...who(1), comment: 'crème brûlée', createTime: t + 500 }, t + 700);
  assert.equal(e.correct.length, 1, 'turn kept: retyping counts');
  // 3) typed without accents: not counted yet, turn KEPT; wrong accents still use up the turn
  const f = new Classroom([mk('CRÈME BRÛLÉE')], t);
  ask(f);
  chat(f, 1, 'creme brulee', t, (t += 10));
  assert.equal(f.stats.noMarks, 1);
  chat(f, 1, 'crème brûlée', t, (t += 10));
  assert.ok(f.correct.some((a) => a.username === 'u1'), 'retyping with accents counts');
  chat(f, 2, 'crème brûlèe', t, (t += 10));
  chat(f, 2, 'crème brûlée', t, (t += 10));
  assert.ok(!f.correct.some((a) => a.username === 'u2'), 'wrong accents still use up the turn');
}

// ---------- 2026-11-07: stand-up switch off, male teacher, hall monitor, dance break ----------
GAME.standWrong = STAND;
GAME.teamPickSec = 0;
const many = () => Array.from({ length: 30 }, (_, i) => mk('CRÈME BRÛLÉE' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26] + (i >= 26 ? 'X' : '')));
{
  // wrong answers do not stand up front
  const c = new Classroom(many(), t);
  c.newRound(t);
  while (c.phase !== 'question') c.tick((t += 500));
  c.showBoard();
  chat(c, 1, 'X'.repeat(c.answerLetters.length), t, (t += 10));
  while ((c.phase as string) !== 'reveal') c.tick((t += 500));
  assert.equal(c.view(t).punished.length, 0, 'stand-up off: wrong answers stay seated');
  // switched back on in the control page: the next wrong answer stands up front; switched off mid-way, back to the seat at once
  c.setStandWrong(true);
  while (c.phase !== 'question') c.tick((t += 500));
  c.showBoard();
  chat(c, 2, 'X'.repeat(c.answerLetters.length), t, (t += 10));
  while ((c.phase as string) !== 'reveal') c.tick((t += 500));
  assert.deepEqual(c.view(t).punished.map((p) => p.username), ['u2'], 'stand-up on: wrong answers stand up front');
  c.setStandWrong(false);
  assert.equal(c.view(t).punished.length, 0, 'switched off mid-way: back to the seat at once');
}
{
  // male teacher: lines say "Mr." instead of "Ms.", his name, nothing else touched
  assert.equal(thayHoa('Ms. Ngan thinks I look pretty today. Msx.'), 'Mr. Ngan thinks I look handsome today. Msx.');
  assert.equal(thayHoa('Ms. Ngan has the bell in her hand'), 'Mr. Ngan has the bell in his hand');
  assert.equal(teacherText('Ms. Ngan is here, hello class', 'Mr. Minh', true), 'Mr. Minh is here, hello class');
  assert.equal(teacherText('Ms. Ngan is here, hello class', 'Ms. Lan', false), 'Ms. Lan is here, hello class');
  assert.equal(shownTeacherName({ ...GAME.defaultRoom, teacher: 'thay' }), GAME.defaultThayName, 'male teacher while the name is still Ms. Ngan');
  const c = new Classroom(many(), t);
  c.thay = true;
  c.teacherName = 'Mr. Minh';
  const said = Array.from({ length: 6 }, () => c.newRound((t += 1000))).flat().map((l) => l.text).join(' ');
  assert.ok(!/\bMs\.\s/.test(said), 'male teacher: no "Ms." left in his lines');
}
{
  // hall monitor: a student quiet for more than N minutes is walked out, the most active waiting student takes the seat
  const seats = GAME.seats;
  GAME.seats = 3;
  const c = new Classroom(many(), t);
  c.supervisorOn = true;
  c.supervisorIdleMs = 4 * 60_000;
  c.newRound(t);
  for (let i = 1; i <= 3; i++) chat(c, i, 'hi teacher', t, t); // 3 students fill the 3 seats
  t += 3 * 60_000;
  chat(c, 4, 'join class', t, t); // 2 students waiting for a seat: student 5 is more active
  for (let k = 0; k < 4; k++) chat(c, 5, 'hihi ' + k, (t += 2500), t);
  chat(c, 2, 'im here', t, t); // student 2 still active
  chat(c, 3, 'im here', t, t);
  assert.deepEqual(c.seats().map((s) => s.username).sort(), ['u1', 'u2', 'u3']);
  t += 70_000; // student 1 quiet for more than 4 minutes
  let said: ReturnType<Classroom['tick']> = [];
  for (let k = 0; k < 4 && !c.escort; k++) said = c.tick((t += 200));
  assert.ok(c.escort, 'the hall monitor comes in');
  assert.equal(c.escort!.out.username, 'u1', 'walks out the longest-quiet student');
  assert.equal(c.escort!.in?.username, 'u5', 'the most active waiting student takes the seat');
  assert.ok(said.some((l) => !l.priority && !l.warn && !l.main && /hall monitor/i.test(l.text)), 'automatic: the teacher announces him when there is time (extra line)');
  assert.ok(!c.seats().some((s) => s.username === 'u1') && c.seats().some((s) => s.username === 'u5'));
  assert.equal(c.view(t).escort?.inSeat, c.seats().findIndex((s) => s.username === 'u5'));
  chat(c, 1, 'back again', (t += 1000), t);
  assert.ok(!c.students.get('u1')!.out, 'commenting again joins the queue');
  // next time within 2 minutes: he still comes but she does not announce it again (no constant talking in a busy room)
  t += 4 * 60_000 + 10_000; // students 2, 3 quiet for more than 4 minutes
  (c as unknown as { lastEscortSayAt: number }).lastEscortSayAt = t - 60_000; // she announced it 1 minute ago
  chat(c, 6, 'let me in', t, t);
  for (const u of [5, 6, 1]) c.students.get('u' + u)!.lastActive = t;
  let said2: ReturnType<Classroom['tick']> = [];
  for (let k = 0; k < 4 && (!c.escort || c.escort.at < t); k++) said2 = said2.concat(c.tick((t += 200)));
  assert.ok(c.escort && c.escort.at >= t - 1000, 'he comes in a second time');
  assert.ok(!said2.some((l) => /hall monitor/i.test(l.text)), 'within 2 minutes: not announced again');
  // hearts count as interaction: not treated as quiet
  const lk = new Classroom(many(), t);
  lk.supervisorOn = true;
  lk.supervisorIdleMs = 60_000;
  lk.newRound(t);
  chat(lk, 1, 'hiya', t, t);
  t += 50_000;
  lk.like(3, t, false, { username: 'u1', spoken: 'Kid 1', nickname: 'Kid 1' });
  t += 30_000;
  assert.ok(t - lk.students.get('u1')!.lastActive < 60_000, 'hearts refresh the last interaction');
  // hall monitor off: nobody walked out
  const d = new Classroom(many(), t);
  d.newRound(t);
  for (let i = 1; i <= 4; i++) chat(d, i, 'hiya', t, t);
  t += 10 * 60_000;
  chat(d, 4, 'alo', t, t);
  for (let k = 0; k < 5; k++) d.tick((t += 200));
  assert.equal(d.escort, null, 'hall monitor off');
  // test button: class not full (nobody waiting) he still walks out the longest-quiet student, said at once
  const e = new Classroom(many(), t);
  e.newRound(t);
  chat(e, 1, 'hiya', t, t);
  chat(e, 2, 'hiya', (t += 1000), t);
  const alone = e.forceEscort((t += 1000));
  assert.equal(e.escort?.out.username, 'u1');
  assert.equal(e.escort?.in, null, 'nobody waiting: the seat stays empty');
  assert.ok(alone[0]?.warn && LINES.escortAlone.some((f) => alone[0].text.endsWith(f('Kid 1'))), 'said at once, not waiting for a quiet moment');
  GAME.seats = seats;
}
{
  // dance break: counts real hearts, half way she reads the count, at the end thanks + names the top sender
  const c = new Classroom(many(), t);
  c.danceSec = 20;
  c.newRound(t);
  const intro = c.forceRecess('dance', t);
  assert.ok(intro[0].main && LINES.danceIntro.some((x) => intro[0].text.endsWith(x)));
  assert.equal(c.phaseEndsAt - t, 20_000, 'dance time follows the setting');
  c.like(5, t, false, { username: 'u1', spoken: 'Lan', nickname: 'Lan' });
  c.like(12, t, false, { username: 'u2', spoken: 'Minh', nickname: 'Minh' });
  assert.equal(c.view(t).recess?.hearts, 17, 'counts real hearts, no multiplier');
  assert.equal(c.view(t).recess?.topLiker?.nickname, 'Minh');
  let all: ReturnType<Classroom['tick']> = [];
  while (c.recess?.stage === 'play') all = all.concat(c.tick((t += 500)));
  assert.ok(all.some((l) => l.warn && l.text.includes('17') && l.text.includes('Minh')), 'half way the teacher reads the heart count');
  assert.ok(all.some((l) => l.main && l.text.includes('17') && /Minh/.test(l.text)), 'at the end: heart total and thanks');
  assert.ok(c.view(t).clapping, 'the class claps');
  // 'always': every recess is a dance break
  const d = new Classroom(many(), t);
  d.dance = 'always';
  d.newRound(t);
  d.skip(t);
  for (let k = 0; k < 3; k++) {
    d.forceRecess(undefined as never, (t += 1000));
    assert.equal(d.recess?.game, 'dance');
  }
}

console.log('quiz.check: all passed');
