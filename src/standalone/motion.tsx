/**
 * Tiny drop-in replacement for the parts of `motion/react` this game uses
 * (motion.div / motion.span / motion.img, AnimatePresence).
 *
 * Supported: initial / animate / exit, keyframe arrays, `times`, duration, delay,
 * repeat (Infinity), repeatDelay, ease names, spring transitions, per-key transitions,
 * AnimatePresence (`initial={false}`, mode="wait").
 * Animated keys: x, y, scale, scaleX, scaleY, rotate, opacity, left, top, width, height.
 * `layout` is accepted and ignored (items just jump to their new place).
 */
import React, {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

type Num = number;
type Target = Record<string, unknown>;
type Ease = string | number[] | undefined;
interface Trans {
  duration?: number;
  delay?: number;
  repeat?: number;
  repeatDelay?: number;
  times?: number[];
  ease?: Ease;
  type?: string;
  stiffness?: number;
  damping?: number;
  mass?: number;
  [key: string]: unknown;
}

const TRANSFORM_KEYS = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate'];
const DEFAULTS: Record<string, number> = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 };
const UNIT: Record<string, string> = { x: 'px', y: 'px', rotate: 'deg', left: 'px', top: 'px', width: 'px', height: 'px' };
const ANIMATABLE = new Set([...TRANSFORM_KEYS, 'opacity', 'left', 'top', 'width', 'height']);

// ---------- easing ----------
function bezier(x1: Num, y1: Num, x2: Num, y2: Num) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: Num) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: Num) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: Num) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: Num) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = sx(t) - x;
      if (Math.abs(d) < 1e-5) break;
      const ds = dsx(t);
      if (Math.abs(ds) < 1e-6) break;
      t -= d / ds;
    }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
}
const EASES: Record<string, (t: Num) => Num> = {
  linear: (t) => t,
  easeIn: bezier(0.42, 0, 1, 1),
  easeOut: bezier(0, 0, 0.58, 1),
  easeInOut: bezier(0.42, 0, 0.58, 1),
  circOut: (t) => Math.sqrt(1 - (t - 1) * (t - 1)),
  backOut: bezier(0.34, 1.56, 0.64, 1),
  anticipate: bezier(0.36, 0, 0.66, -0.56),
};
function easeOf(e: Ease, fallback: string) {
  if (Array.isArray(e) && e.length === 4) return bezier(e[0], e[1], e[2], e[3]);
  if (typeof e === 'string' && EASES[e]) return EASES[e];
  return EASES[fallback];
}

// ---------- value parsing ----------
function parse(v: unknown, key: string): { n: Num; unit: string } | null {
  if (typeof v === 'number') return { n: v, unit: UNIT[key] ?? '' };
  if (typeof v === 'string') {
    const m = /^(-?[\d.]+)([a-z%]*)$/i.exec(v.trim());
    if (m) return { n: parseFloat(m[1]), unit: m[2] || UNIT[key] || '' };
  }
  return null;
}

// ---------- animation tracks + one shared ticker ----------
interface Track {
  ctl: Controller;
  key: string;
  frames: Num[];
  offsets: Num[];
  ease: (t: Num) => Num;
  duration: Num; // ms
  delay: Num; // ms
  repeat: Num;
  repeatDelay: Num; // ms
  start: Num;
  spring?: { k: Num; c: Num; m: Num; v: Num; to: Num; last: Num };
  onDone?: () => void;
}
const tracks = new Set<Track>();
let raf = 0;
function loop() {
  const now = performance.now();
  const dirty = new Set<Controller>();
  for (const tr of tracks) {
    const done = step(tr, now);
    dirty.add(tr.ctl);
    if (done) {
      tracks.delete(tr);
      tr.ctl.tracks.delete(tr.key);
      tr.onDone?.();
    }
  }
  for (const c of dirty) c.apply();
  raf = tracks.size ? requestAnimationFrame(loop) : 0;
}
function kick() {
  if (!raf) raf = requestAnimationFrame(loop);
}
function step(tr: Track, now: Num): boolean {
  const c = tr.ctl;
  const t0 = now - tr.start - tr.delay;
  if (t0 < 0) return false;
  if (tr.spring) {
    const s = tr.spring;
    let dt = Math.min(0.064, (now - s.last) / 1000);
    s.last = now;
    let x = c.values[tr.key];
    // integrate in small sub-steps for stability
    while (dt > 0) {
      const h = Math.min(dt, 0.008);
      const a = (-s.k * (x - s.to) - s.c * s.v) / s.m;
      s.v += a * h;
      x += s.v * h;
      dt -= h;
    }
    c.values[tr.key] = x;
    if (Math.abs(s.v) < 0.01 && Math.abs(x - s.to) < 0.005) {
      c.values[tr.key] = s.to;
      return true;
    }
    return false;
  }
  const cycle = tr.duration + tr.repeatDelay;
  let t = t0;
  let finished = false;
  if (tr.repeat > 0 && cycle > 0) {
    const n = Math.floor(t / cycle);
    if (n > tr.repeat) {
      t = tr.duration;
      finished = true;
    } else {
      t = t - n * cycle;
      if (t > tr.duration) t = tr.duration;
    }
  } else if (t >= tr.duration) {
    t = tr.duration;
    finished = true;
  }
  const p = tr.duration > 0 ? t / tr.duration : 1;
  c.values[tr.key] = sample(tr, p);
  return finished;
}
function sample(tr: Track, p: Num) {
  const { frames, offsets } = tr;
  if (frames.length === 1) return frames[0];
  if (p <= offsets[0]) return frames[0];
  for (let i = 1; i < frames.length; i++) {
    if (p <= offsets[i] || i === frames.length - 1) {
      const span = offsets[i] - offsets[i - 1] || 1;
      const local = Math.min(1, Math.max(0, (p - offsets[i - 1]) / span));
      return frames[i - 1] + (frames[i] - frames[i - 1]) * tr.ease(local);
    }
  }
  return frames[frames.length - 1];
}

class Controller {
  el: HTMLElement | null = null;
  values: Record<string, Num> = {};
  units: Record<string, string> = {};
  tracks = new Map<string, Track>();
  hasTransform = false;

  set(target: Target | undefined) {
    if (!target) return;
    for (const [key, raw] of Object.entries(target)) {
      if (!ANIMATABLE.has(key)) continue;
      const v = Array.isArray(raw) ? raw[raw.length - 1] : raw;
      const p = parse(v, key);
      if (!p) continue;
      this.stopKey(key);
      this.values[key] = p.n;
      this.units[key] = p.unit;
      if (TRANSFORM_KEYS.includes(key)) this.hasTransform = true;
    }
    this.apply();
  }

  stopKey(key: string) {
    const tr = this.tracks.get(key);
    if (tr) {
      tracks.delete(tr);
      this.tracks.delete(key);
    }
  }

  stopAll() {
    for (const k of [...this.tracks.keys()]) this.stopKey(k);
  }

  animate(target: Target | undefined, transition: Trans | undefined, onDone?: () => void) {
    if (!target) {
      onDone?.();
      return;
    }
    const now = performance.now();
    let pending = 0;
    const finishOne = () => {
      pending--;
      if (pending === 0) onDone?.();
    };
    for (const [key, raw] of Object.entries(target)) {
      if (!ANIMATABLE.has(key) || raw === undefined) continue;
      const tr = { ...(transition ?? {}), ...((transition?.[key] as Trans | undefined) ?? {}) } as Trans;
      const list = Array.isArray(raw) ? raw : [raw];
      const parsed = list.map((x) => parse(x, key));
      if (parsed.some((x) => !x)) continue;
      const unit = parsed[parsed.length - 1]!.unit;
      const known = key in this.values;
      const cur = known && (this.units[key] ?? '') === unit ? this.values[key] : (DEFAULTS[key] ?? parsed[0]!.n);
      let frames = parsed.map((x) => x!.n);
      if (!Array.isArray(raw)) frames = [cur, frames[0]];
      this.stopKey(key);
      this.units[key] = unit;
      if (TRANSFORM_KEYS.includes(key)) this.hasTransform = true;
      if (!(key in this.values)) this.values[key] = frames[0];
      const isTransform = TRANSFORM_KEYS.includes(key);
      const keyframes = Array.isArray(raw) && raw.length > 1;
      const spring =
        tr.type === 'spring' || (tr.type !== 'tween' && tr.duration === undefined && !keyframes && isTransform && !tr.ease);
      const delay = (tr.delay ?? 0) * 1000;
      if (spring && !keyframes) {
        if (frames[0] === frames[1] && !tr.repeat) {
          this.values[key] = frames[1];
          continue;
        }
        this.values[key] = frames[0];
        const tk: Track = {
          ctl: this,
          key,
          frames,
          offsets: [0, 1],
          ease: EASES.linear,
          duration: 0,
          delay,
          repeat: 0,
          repeatDelay: 0,
          start: now,
          spring: {
            k: tr.stiffness ?? (tr.type === 'spring' ? 100 : 500),
            c: tr.damping ?? (tr.type === 'spring' ? 10 : 25),
            m: tr.mass ?? 1,
            v: 0,
            to: frames[1],
            last: now + delay,
          },
        };
        pending++;
        tk.onDone = finishOne;
        this.tracks.set(key, tk);
        tracks.add(tk);
        continue;
      }
      const duration = (tr.duration ?? (keyframes ? 0.8 : 0.3)) * 1000;
      const offsets =
        tr.times && tr.times.length === frames.length ? tr.times : frames.map((_, i) => (frames.length > 1 ? i / (frames.length - 1) : 1));
      if (frames.length === 2 && frames[0] === frames[1] && !tr.repeat) {
        this.values[key] = frames[1];
        continue;
      }
      const tk: Track = {
        ctl: this,
        key,
        frames,
        offsets,
        ease: easeOf(tr.ease, keyframes ? 'easeInOut' : 'easeOut'),
        duration,
        delay,
        repeat: tr.repeat === Infinity ? Number.MAX_SAFE_INTEGER : (tr.repeat ?? 0),
        repeatDelay: (tr.repeatDelay ?? 0) * 1000,
        start: now,
      };
      if (delay === 0) this.values[key] = frames[0];
      pending++;
      tk.onDone = finishOne;
      this.tracks.set(key, tk);
      tracks.add(tk);
    }
    this.apply();
    if (pending === 0) onDone?.();
    else kick();
  }

  apply() {
    const el = this.el;
    if (!el) return;
    const v = this.values;
    const s = el.style;
    if ('opacity' in v) s.opacity = String(v.opacity);
    for (const k of ['left', 'top', 'width', 'height'] as const) {
      if (k in v) s[k] = `${v[k]}${this.units[k] || 'px'}`;
    }
    if (this.hasTransform) {
      const parts: string[] = [];
      if (v.x || v.y) parts.push(`translateX(${v.x ?? 0}${this.units.x || 'px'}) translateY(${v.y ?? 0}${this.units.y || 'px'})`);
      const sc = v.scale ?? 1;
      const sx = sc * (v.scaleX ?? 1);
      const sy = sc * (v.scaleY ?? 1);
      if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
      if (v.rotate) parts.push(`rotate(${v.rotate}deg)`);
      s.transform = parts.join(' ') || 'none';
    }
  }
}

// ---------- presence ----------
interface Presence {
  isPresent: boolean;
  initial: boolean;
  register: () => () => void;
}
const PresenceContext = createContext<Presence | null>(null);

type MotionProps = {
  initial?: Target | false | string;
  animate?: Target | string;
  exit?: Target | string;
  transition?: Trans;
  layout?: boolean | string;
  style?: React.CSSProperties;
  children?: ReactNode;
  [key: string]: unknown;
};

const STRIP = new Set(['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId', 'variants', 'whileHover', 'whileTap', 'onAnimationComplete']);

function makeMotion(tag: string) {
  const Comp = forwardRef<HTMLElement, MotionProps>(function MotionEl(props, ref) {
    const presence = useContext(PresenceContext);
    const ctl = useRef<Controller | null>(null);
    if (!ctl.current) ctl.current = new Controller();
    const lastSig = useRef<string | null>(null);
    const exitingRef = useRef(false);
    const doneRef = useRef<(() => void) | null>(null);
    const animate = typeof props.animate === 'object' ? (props.animate as Target) : undefined;
    const exit = typeof props.exit === 'object' ? (props.exit as Target) : undefined;
    const initial = props.initial;

    // register with AnimatePresence (if it has an exit animation)
    useLayoutEffect(() => {
      if (presence && exit) {
        doneRef.current = presence.register();
        return () => {
          // unmounting for good: release
          const d = doneRef.current;
          doneRef.current = null;
          d?.();
        };
      }
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setRef = (el: HTMLElement | null) => {
      ctl.current!.el = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
    };

    // first mount: put the element in its `initial` state, then animate to `animate`
    useLayoutEffect(() => {
      const c = ctl.current!;
      const skipInitial = initial === false || (presence && !presence.initial);
      if (skipInitial) c.set(animate);
      else if (initial && typeof initial === 'object') c.set(initial as Target);
      else if (animate) {
        // no `initial`: start at the target for layout props, animate the rest from defaults
        const now: Target = {};
        for (const [k, v] of Object.entries(animate)) if (!Array.isArray(v) && !TRANSFORM_KEYS.includes(k) && k !== 'opacity') now[k] = v;
        c.set(now);
      }
      lastSig.current = skipInitial ? JSON.stringify(animate ?? null) : null;
      return () => {
        c.stopAll();
        c.el = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // animate whenever the `animate` target changes
    const sig = JSON.stringify(animate ?? null);
    useLayoutEffect(() => {
      if (exitingRef.current) return;
      if (sig === lastSig.current) return;
      lastSig.current = sig;
      ctl.current!.animate(animate, props.transition as Trans | undefined);
    });

    // AnimatePresence removed us: play `exit` then tell the parent
    const isPresent = presence ? presence.isPresent : true;
    useEffect(() => {
      if (isPresent || exitingRef.current || !exit) return;
      exitingRef.current = true;
      const tr = (exit.transition as Trans | undefined) ?? (props.transition as Trans | undefined);
      const { transition: _t, ...target } = exit;
      ctl.current!.animate(target, tr ? { ...tr, repeat: 0 } : { duration: 0.3 }, () => {
        const d = doneRef.current;
        doneRef.current = null;
        d?.();
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPresent]);

    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) if (!STRIP.has(k)) rest[k] = v;
    // keep values the animation owns out of the React style (so a re-render does not undo the animation)
    const style = props.style ? { ...props.style } : undefined;
    if (style) {
      const owned = new Set(Object.keys(ctl.current.values));
      for (const k of Object.keys(style)) if (owned.has(k)) delete (style as Record<string, unknown>)[k];
      if (ctl.current.hasTransform) delete (style as Record<string, unknown>).transform;
    }
    return React.createElement(tag, { ...rest, style, ref: setRef });
  });
  Comp.displayName = `motion.${tag}`;
  return Comp;
}

const cache = new Map<string, ReturnType<typeof makeMotion>>();
export const motion = new Proxy({} as Record<string, ReturnType<typeof makeMotion>>, {
  get(_t, tag: string) {
    let c = cache.get(tag);
    if (!c) {
      c = makeMotion(tag);
      cache.set(tag, c);
    }
    return c;
  },
});

function keyOf(el: ReactElement, i: number) {
  return el.key != null ? String(el.key) : `__i${i}`;
}

function PresenceChild({
  isPresent,
  initial,
  onExitComplete,
  children,
}: {
  isPresent: boolean;
  initial: boolean;
  onExitComplete: () => void;
  children: ReactNode;
}) {
  const count = useRef(0);
  const doneCount = useRef(0);
  const cb = useRef(onExitComplete);
  cb.current = onExitComplete;
  const ctx = useRef<Presence>({ isPresent, initial, register: () => () => {} });
  ctx.current = {
    isPresent,
    initial,
    register: () => {
      count.current++;
      let called = false;
      return () => {
        if (called) return;
        called = true;
        doneCount.current++;
        if (!ctx.current.isPresent && doneCount.current >= count.current) cb.current();
      };
    },
  };
  useEffect(() => {
    if (isPresent) {
      doneCount.current = 0;
      return;
    }
    // nothing inside wants an exit animation: remove right away; otherwise guard against a stuck exit
    if (count.current === 0) {
      cb.current();
      return;
    }
    const guard = setTimeout(() => cb.current(), 3000);
    return () => clearTimeout(guard);
  }, [isPresent]);
  const value = { ...ctx.current };
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function AnimatePresence({ children, initial = true, mode }: { children?: ReactNode; initial?: boolean; mode?: string }) {
  const current: ReactElement[] = [];
  Children.forEach(children, (c) => {
    if (isValidElement(c)) current.push(c);
  });
  const firstRender = useRef(true);
  const [, force] = useState(0);
  const rendered = useRef<Map<string, ReactElement>>(new Map());
  const exiting = useRef<Set<string>>(new Set());

  const currentKeys = current.map(keyOf);
  const currentSet = new Set(currentKeys);
  const prev = rendered.current;
  // keep order: previous items (some exiting), then new ones
  const next = new Map<string, ReactElement>();
  for (const [k, el] of prev) {
    if (currentSet.has(k)) {
      next.set(k, current[currentKeys.indexOf(k)]);
      exiting.current.delete(k);
    } else {
      next.set(k, el);
      exiting.current.add(k);
    }
  }
  current.forEach((el, i) => {
    const k = currentKeys[i];
    if (!next.has(k)) next.set(k, el);
  });
  rendered.current = next;

  const isFirst = firstRender.current;
  useEffect(() => {
    firstRender.current = false;
  }, []);

  const out: ReactNode[] = [];
  const waiting = mode === 'wait' && exiting.current.size > 0;
  for (const [k, el] of next) {
    const present = currentSet.has(k);
    if (waiting && present && !prev.has(k)) continue; // mode="wait": new child waits for the old one to leave
    out.push(
      <PresenceChild
        key={k}
        isPresent={present}
        initial={isFirst ? initial : true}
        onExitComplete={() => {
          if (!exiting.current.has(k)) return;
          exiting.current.delete(k);
          rendered.current.delete(k);
          force((n) => n + 1);
        }}
      >
        {el}
      </PresenceChild>,
    );
  }
  return <>{out}</>;
}

export default motion;
