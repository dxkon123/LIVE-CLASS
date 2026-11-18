// Check the question banks: npx tsx src/game/bank.check.ts
import fs from 'node:fs';
import path from 'node:path';
import { parseBank } from './questions';
import { compactVi, normVi } from './quiz';
import { parseCodes, parseMc } from './show';

const dir = path.join(import.meta.dirname, 'word-bank');
const files = Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
const errors: string[] = [];
const bank = parseBank(files, errors);
const MAX_LETTERS = 14; // more letters and the tiles on the board get too small
const MAX_LETTERS_DH = 16; // emoji puzzles have no scrambled tiles, only answer boxes, so they can be longer

const seen = new Map<string, string>();
for (const q of bank) {
  const n = compactVi(q.answer).length;
  const max = q.slot === 'dh' ? MAX_LETTERS_DH : MAX_LETTERS;
  if (n < 2 || n > max) errors.push(`${q.id}: answer has ${n} letters (allowed 2-${max})`);
  if (seen.has(q.id)) errors.push(`${q.id}: duplicate in the same topic`);
  seen.set(q.id, q.clue);
  // clue gives away the whole answer (whole words)
  const words = ` ${normVi(q.clue).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  if (words.includes(` ${normVi(q.answer)} `)) errors.push(`${q.id}: clue gives away the answer: ${q.clue}`);
  // an alternative that only differs in spaces/punctuation is already understood by the game
  for (const a of q.acceptedAnswers ?? []) if (compactVi(a) === compactVi(q.answer)) errors.push(`${q.id}: unnecessary alternative (${a})`);
  if (!q.kind) errors.push(`${q.id}: topic is missing its "This is..." line (a line starting with >)`);
}
const byAnswer = new Map<string, string[]>();
for (const q of bank) byAnswer.set(compactVi(q.answer), [...(byAnswer.get(compactVi(q.answer)) ?? []), q.id]);
const dup = [...byAnswer.values()].filter((v) => v.length > 1);

const count = (d: string) => bank.filter((q) => q.difficulty === d).length;
const cats = new Set(bank.map((q) => q.category));
console.log(`${bank.length} questions, ${cats.size} topics · easy ${count('easy')} · medium ${count('medium')} · hard ${count('hard')}`);
if (dup.length) console.log(`Same answer in 2 topics (different clues, allowed): ${dup.length}, e.g. ${dup.slice(0, 5).map((d) => d.join(' / ')).join('; ')}`);
// ---------- the 2 big shows: multiple choice + passwords ----------
{
  const sdir = path.join(import.meta.dirname, 'show-bank');
  const mc = parseMc(fs.readFileSync(path.join(sdir, 'multiple-choice.txt'), 'utf8'), errors);
  const codes = parseCodes(fs.readFileSync(path.join(sdir, 'passwords.txt'), 'utf8'), errors);
  const ids = new Set<string>();
  for (const q of mc) {
    if (ids.has(q.id)) errors.push(`${q.id}: duplicate multiple-choice question`);
    ids.add(q.id);
    const opts = [q.right, ...q.wrong].map((o) => compactVi(o));
    if (new Set(opts).size < 4) errors.push(`${q.id}: two options are the same`);
    // long options do not fit the A B C D boxes
    for (const o of [q.right, ...q.wrong]) if (o.length > 28) errors.push(`${q.id}: option longer than 28 characters: ${o}`);
    if (q.q.length > 110) errors.push(`${q.id}: question longer than 110 characters`);
  }
  for (const c of codes) {
    const n = compactVi(c.answer).length;
    if (n < 3 || n > 14) errors.push(`${c.id}: password has ${n} letters (allowed 3-14)`);
    for (const h of c.hints) if (` ${normVi(h).replace(/[^\p{L}\p{N}]+/gu, ' ')} `.includes(` ${normVi(c.answer)} `)) errors.push(`${c.id}: clue gives away the password: ${h}`);
  }
  // each show needs: Everest de 4, vua 4, kho 3, phu 1; Golden Bell de 4, vua 7, kho 3, chuong 1, phu 1
  const by = (l: string) => mc.filter((q) => q.level === l).length;
  console.log(`big shows: ${mc.length} multiple-choice (de ${by('de')} · vua ${by('vua')} · kho ${by('kho')} · chuong ${by('chuong')} · phu ${by('phu')}), ${codes.length} passwords`);
}

if (errors.length) {
  console.log(`ERRORS ${errors.length}:\n` + errors.join('\n'));
  process.exit(1);
}
console.log('bank.check: ok');
