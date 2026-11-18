/**
 * Shared "talking" rules for every game, taken from an earlier live game that ran for real.
 * Pure functions, no React, no sound: they only decide WHETHER to speak. The lines live in game/config.ts.
 */

// No accents, lowercase, single spaces, padded with spaces: "Good Luck!" -> " good luck "
export const plain = (text: string) =>
  ` ${text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

// ---------- Gift thanks ----------

/**
 * Combo gifts (x5, x10...) and back-to-back gifts from one person: thanked once per `cooldownMs`.
 * Big gifts (>= bigCoins coins) are always thanked. Small ones are skipped when the gift queue is long (busy live).
 */
export class GiftThanker {
  private last = new Map<string, number>();
  constructor(
    private cooldownMs = 30_000,
    private bigCoins = 99,
    private maxWaiting = 6,
  ) {}
  shouldThank(username: string, coins: number, giftLinesWaiting: number, now = Date.now()) {
    const key = username.toLowerCase();
    const big = coins >= this.bigCoins;
    if (!big && now - (this.last.get(key) ?? -Infinity) < this.cooldownMs) return false;
    if (!big && giftLinesWaiting >= this.maxWaiting) return false;
    this.last.set(key, now);
    return true;
  }
  reset() {
    this.last.clear();
  }
}

// ---------- Once per person (follow thanks, share thanks...) ----------

export class OncePerPerson {
  private seen = new Set<string>();
  /** true the first time for that person, false after that */
  first(username: string) {
    const key = username.toLowerCase();
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
  reset() {
    this.seen.clear();
  }
}

// ---------- People who just interacted (named when asking for shares) ----------

export class RecentPeople {
  private at = new Map<string, { name: string; at: number }>();
  note(username: string, name: string, now = Date.now()) {
    this.at.delete(username); // move to the end = newest
    this.at.set(username, { name, at: now });
    if (this.at.size > 200) this.at.delete(this.at.keys().next().value!);
  }
  /** At most `n` names that interacted within the last `withinMs`, newest first */
  latest(n: number, withinMs: number, now = Date.now()) {
    return [...this.at.values()]
      .filter((p) => now - p.at <= withinMs)
      .reverse()
      .slice(0, n)
      .map((p) => p.name);
  }
  reset() {
    this.at.clear();
  }
}

// ---------- Comments with a wish ----------

export type WishTopic = 'exam' | 'health' | 'love' | 'family' | 'work' | 'wealth' | 'peace';

// A comment needs one of these words to count as a wish
const WISH_WORDS = [' wish ', ' hope ', ' pray ', ' praying ', ' want ', ' please ', ' bless ', ' may i '];

// Checked in order, the first topic that matches wins
const TOPICS: Array<[WishTopic, string[]]> = [
  ['exam', [' exam ', ' test ', ' grade ', ' grades ', ' pass ', ' graduate ', ' university ', ' college ', ' ielts ', ' driving test ']],
  ['health', [' health ', ' healthy ', ' recover ', ' sick ', ' surgery ', ' hospital ', ' get well ', ' pain ']],
  ['love', [' love ', ' boyfriend ', ' girlfriend ', ' crush ', ' marry ', ' wedding ', ' partner ', ' soulmate ']],
  ['family', [' family ', ' kids ', ' children ', ' parents ', ' mom ', ' dad ', ' baby ', ' pregnant ']],
  ['work', [' job ', ' work ', ' interview ', ' promotion ', ' raise ', ' career ']],
  ['wealth', [' money ', ' rich ', ' business ', ' sales ', ' lottery ', ' debt ', ' orders ', ' customers ']],
  ['peace', [' peace ', ' safe ', ' luck ', ' lucky ', ' smooth ', ' calm ']],
];

/** "I hope I pass my exam next week" -> 'exam'. Not a wish -> null */
export function detectWish(comment: string): WishTopic | null {
  const t = plain(comment);
  if (!WISH_WORDS.some((w) => t.includes(w))) return null;
  for (const [topic, words] of TOPICS) {
    if (words.some((w) => t.includes(w))) return topic;
  }
  return null;
}

/**
 * Reply spam guard: each person once per `perUserMs`, the whole room at most once per `globalMs`.
 */
export class WishLimiter {
  private byUser = new Map<string, number>();
  private lastAny = -Infinity;
  constructor(
    private perUserMs = 10 * 60_000,
    private globalMs = 20_000,
  ) {}
  allow(username: string, now = Date.now()) {
    const key = username.toLowerCase();
    if (now - this.lastAny < this.globalMs) return false;
    if (now - (this.byUser.get(key) ?? -Infinity) < this.perUserMs) return false;
    this.lastAny = now;
    this.byUser.set(key, now);
    return true;
  }
  reset() {
    this.byUser.clear();
    this.lastAny = -Infinity;
  }
}

/** Random pick that never repeats the line just read */
export function makePicker() {
  const lastIndex = new Map<readonly unknown[], number>();
  return <T,>(list: readonly T[]): T | undefined => {
    if (!list.length) return undefined;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === lastIndex.get(list)) i = (i + 1) % list.length;
    lastIndex.set(list, i);
    return list[i];
  };
}
