// Question sets for the 2 big shows: Road to Everest and Golden Bell.
// Multiple choice in src/game/show-bank/multiple-choice.txt, passwords (3 clues) in passwords.txt.
// Check: npx tsx src/game/bank.check.ts
import { plain } from './quiz';

export type ShowKind = 'everest' | 'chuong';
/** de: warm-up · vua: medium · kho: hard / summit · chuong: Golden Bell question · phu: tiebreaker */
export const MC_LEVELS = ['de', 'vua', 'kho', 'chuong', 'phu'] as const;
export type McLevel = (typeof MC_LEVELS)[number];

export interface McQ {
  id: string;
  q: string;
  /** the right answer comes first (the game shuffles A B C D when asking) */
  right: string;
  wrong: [string, string, string];
  level: McLevel;
}
export interface CodeQ {
  id: string;
  answer: string;
  hints: [string, string, string];
}
export interface ShowBank {
  mc: McQ[];
  codes: CodeQ[];
}

/** Read the multiple-choice file: a "[de]" line switches group; each line "question | right | wrong | wrong | wrong" */
export function parseMc(text: string, errors: string[] = []): McQ[] {
  const out: McQ[] = [];
  let level: McLevel | '' = '';
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const sec = /^\[(\w+)\]$/.exec(line);
    if (sec) {
      level = (MC_LEVELS as readonly string[]).includes(sec[1]) ? (sec[1] as McLevel) : '';
      if (!level) errors.push(`multiple-choice:${i + 1} unknown group: ${line}`);
      return;
    }
    const parts = line.split('|').map((s) => s.trim());
    if (!level || parts.length !== 5 || parts.some((p) => !p)) {
      errors.push(`multiple-choice:${i + 1} bad syntax: ${line}`);
      return;
    }
    const [q, right, ...wrong] = parts;
    out.push({ id: `tn:${q}|${right}`, q, right, wrong: wrong as McQ['wrong'], level });
  });
  return out;
}

/** Read the password file: "ANSWER | clue 1 | clue 2 | clue 3" (hardest clue first) */
export function parseCodes(text: string, errors: string[] = []): CodeQ[] {
  const out: CodeQ[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length !== 4 || parts.some((p) => !p)) {
      errors.push(`passwords:${i + 1} bad syntax: ${line}`);
      return;
    }
    out.push({ id: `mm:${parts[0]}`, answer: parts[0], hints: parts.slice(1) as CodeQ['hints'] });
  });
  return out;
}

export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** A comment choosing an option: "a", "B", "answer c", "pick d", "c." -> 0..3; otherwise -1 */
export function choiceOf(comment: string): number {
  const m = /^(?:answer|option|pick|choose|its)?([abcd])$/.exec(plain(comment));
  return m ? 'abcd'.indexOf(m[1]) : -1;
}
