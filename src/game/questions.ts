// The questions live in src/game/word-bank/*.txt (one topic per file, first line "# Topic name",
// a line "> It's a food." is what the teacher says before the clue, for every question below it until the next ">" line).
// Each line: ANSWER | clue | difficulty 1-3 | other spellings (comma separated)
// Check the whole bank: npx tsx src/game/quiz.check.ts

export interface Question {
  id: string; // "file-name:answer", used to remember which questions were asked
  clue: string;
  answer: string;
  acceptedAnswers?: string[];
  category: string;
  kind: string; // what the teacher says before the clue, e.g. "It's a food." (the "> ..." line in the file)
  difficulty: 'easy' | 'medium' | 'hard';
  /** mental math question (math.ts): the sum shown on the board and how the teacher reads it; not in the question files */
  math?: { show: string; say: string };
  /** questions with their own slot in the class, by file name suffix: "-meo" riddles, "-su" history.
   * Only asked at that position in GAME.roundPlan, never mixed into the ordinary word questions */
  slot?: Slot;
}

const LEVEL = { '1': 'easy', '2': 'medium', '3': 'hard' } as const;

export const SLOTS = ['meo', 'su', 'anh', 'dh'] as const;
export type Slot = (typeof SLOTS)[number];

/** Read the question files. `errors` collects lines with bad syntax for the check script */
export function parseBank(files: Record<string, string>, errors: string[] = []): Question[] {
  const out: Question[] = [];
  for (const [path, text] of Object.entries(files)) {
    const file = path.split('/').pop()!.replace(/\.txt$/, '');
    let category = file;
    let kind = '';
    text.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      if (line.startsWith('#')) {
        if (category === file) category = line.slice(1).trim();
        return;
      }
      if (line.startsWith('>')) {
        kind = line.slice(1).trim();
        return;
      }
      const [answer, clue, level, alts] = line.split('|').map((s) => s.trim());
      const difficulty = LEVEL[level as keyof typeof LEVEL];
      if (!answer || !clue || !difficulty) {
        errors.push(`${file}:${i + 1} bad syntax: ${line}`);
        return;
      }
      out.push({
        id: `${file}:${answer}`,
        answer,
        clue,
        category,
        kind,
        difficulty,
        slot: SLOTS.find((s) => file.endsWith(`-${s}`)),
        acceptedAnswers: alts ? alts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });
    });
  }
  return out;
}
