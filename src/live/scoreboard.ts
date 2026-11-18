// Viewer scoreboard. Pure functions (no React), easy to test and reuse.

export interface Player {
  username: string;
  nickname: string;
  avatar: string;
  score: number;
  diamonds: number;
  lastActive: number;
}

export type Players = Record<string, Player>;

export function addScore(
  players: Players,
  p: { username: string; nickname: string; avatar?: string },
  points: number,
  diamonds = 0,
): Players {
  const old = players[p.username];
  return {
    ...players,
    [p.username]: {
      username: p.username,
      nickname: p.nickname || old?.nickname || p.username,
      avatar: p.avatar || old?.avatar || '',
      score: (old?.score ?? 0) + points,
      diamonds: (old?.diamonds ?? 0) + diamonds,
      lastActive: Date.now(),
    },
  };
}

export function topPlayers(players: Players, n = 10): Player[] {
  return Object.values(players)
    .sort((a, b) => b.score - a.score || b.diamonds - a.diamonds)
    .slice(0, n);
}

/**
 * Collects new names and greets them in batches instead of one by one (a busy live would jam the voice).
 * const g = new NameBatcher(6000, 3, (names) => voice.say(`Hi ${names.join(', ')}`), () => voice.waiting >= 2);
 *   g.add('an123', 'An');
 * - Everyone is greeted once per session (leaving and coming back is not greeted again). reset() starts over.
 * - `isBusy`: when the voice has many lines waiting, wait for the next turn; the names are kept.
 * - When it gets too busy only the newest `maxWaiting` people are kept.
 */
export class NameBatcher {
  private names: { key: string; name: string }[] = [];
  private seen = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private everyMs: number,
    private perBatch: number,
    private flush: (names: string[]) => void,
    private isBusy: () => boolean = () => false,
    private maxWaiting = 30,
  ) {}
  /** key = username (never changes), name = name to read out */
  add(key: string, name = key) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.names.push({ key, name });
    if (this.names.length > this.maxWaiting) this.names.shift();
    if (!this.timer) this.timer = setInterval(() => this.tick(), this.everyMs);
  }
  reset() {
    this.names = [];
    this.seen.clear();
  }
  private tick() {
    if (this.names.length && this.isBusy()) return;
    const batch = this.names.splice(0, this.perBatch);
    if (batch.length) this.flush(batch.map((b) => b.name));
    if (!this.names.length && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** Each person can do one thing every X seconds (anti-spam) */
export function makeCooldown(ms: number) {
  const last = new Map<string, number>();
  return (key: string, now = Date.now()) => {
    if (now - (last.get(key) ?? 0) < ms) return false;
    last.set(key, now);
    return true;
  };
}
