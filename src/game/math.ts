import type { Question } from './questions';

// Mental math: generated when a class starts, so it never runs out and is never written to the class book.
// This edition (owner's call 2026-11-04): more multiplication/division, and addition/subtraction is always a 3-digit
// number with a 2-digit number (no more 6 + 4).
// Level 1 times tables / 3-digit plus 2-digit · 2 multiply, divide a 2-digit number / 3-digit minus 2-digit
// · 3 multiply two 2-digit numbers, divide a 3-digit number · 4 two-step sums with multiply/divide.
// The answer is always a whole number; viewers type the number (e.g. "183").

export type MathLevel = 1 | 2 | 3 | 4;

const DIFF = { 1: 'easy', 2: 'medium', 3: 'hard', 4: 'hard' } as const;

export function makeMath(level: MathLevel, rand = Math.random): Question {
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  let show: string;
  let say: string;
  let n: number;
  const kind = int(0, 2);
  if (level === 1) {
    if (kind === 0) {
      const a = int(6, 9), b = int(6, 9);
      [show, say, n] = [`${a} × ${b}`, `${a} times ${b}`, a * b];
    } else if (kind === 1) {
      const b = int(6, 9), a = int(6, 12);
      [show, say, n] = [`${a * b} ÷ ${b}`, `${a * b} divided by ${b}`, a];
    } else {
      const a = int(105, 489), b = int(16, 89);
      [show, say, n] = [`${a} + ${b}`, `${a} plus ${b}`, a + b];
    }
  } else if (level === 2) {
    if (kind === 0) {
      const a = int(13, 29), b = int(3, 9);
      [show, say, n] = [`${a} × ${b}`, `${a} times ${b}`, a * b];
    } else if (kind === 1) {
      const b = int(3, 9), a = int(13, 29);
      [show, say, n] = [`${a * b} ÷ ${b}`, `${a * b} divided by ${b}`, a];
    } else {
      const a = int(203, 699), b = int(17, 89);
      [show, say, n] = [`${a} − ${b}`, `${a} minus ${b}`, a - b];
    }
  } else if (level === 3) {
    if (kind === 0) {
      const a = int(12, 25), b = int(11, 15);
      [show, say, n] = [`${a} × ${b}`, `${a} times ${b}`, a * b];
    } else if (kind === 1) {
      const b = int(6, 9), a = int(21, 79);
      [show, say, n] = [`${a * b} ÷ ${b}`, `${a * b} divided by ${b}`, a];
    } else {
      const a = int(345, 899), b = int(57, 99);
      [show, say, n] = [`${a} + ${b}`, `${a} plus ${b}`, a + b];
    }
  } else {
    if (kind === 0) {
      const a = int(12, 25), b = int(4, 9), c = int(105, 399);
      [show, say, n] = [`${a} × ${b} + ${c}`, `${a} times ${b} plus ${c}`, a * b + c];
    } else if (kind === 1) {
      const b = int(6, 12), q = int(6, 15), c = int(3, 9);
      [show, say, n] = [`${b * q} ÷ ${b} × ${c}`, `${b * q} divided by ${b}, times ${c}`, q * c];
    } else {
      const c = int(3, 9), sum = c * int(12, 30), a = int(Math.ceil(sum / 3), sum - 11);
      [show, say, n] = [`(${a} + ${sum - a}) ÷ ${c}`, `${a} plus ${sum - a}, all divided by ${c}`, sum / c];
    }
  }
  return {
    id: `toan:${show}`,
    answer: String(n),
    clue: `What is ${say}?`,
    category: 'Mental math',
    kind: 'Mental math.',
    difficulty: DIFF[level],
    math: { show: `${show} = ?`, say },
  };
}
