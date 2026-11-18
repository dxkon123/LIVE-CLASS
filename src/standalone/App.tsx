import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useGame, liveRoom } from '../game/useGame';
import { GameStage } from '../game/GameStage';
import { GameControls } from '../game/GameControls';
import { STAGE_H, STAGE_W, emitTest, sendControl } from '../live/page';
import { asset } from '../live/asset';
import { voice } from '../live/voice';
import { sfx } from '../game/sfx';
import { Classmates } from './bots';
import { chooseVoice, chosenVoice, englishVoices, speechAvailable, unlockSpeech } from './speech';
import { clearBook } from './localServer';

const ME_KEY = 'live-class-en:me';
const BOTS_KEY = 'live-class-en:bots';
const SOUND_KEY = 'live-class-en:sound';

function readMe() {
  try {
    const raw = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
    if (raw && typeof raw.username === 'string') return raw as { username: string; nickname: string };
  } catch {
    // ignore
  }
  const me = { username: `me-${Math.random().toString(36).slice(2, 8)}`, nickname: '' };
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {
    // ignore
  }
  return me;
}
function readNum(key: string, fallback: number) {
  try {
    const n = Number(localStorage.getItem(key));
    return localStorage.getItem(key) === null || !Number.isFinite(n) ? fallback : n;
  } catch {
    return fallback;
  }
}
function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    // ignore
  }
}

/** Whole app for the single-file build. Starts with a tap (browsers only allow sound after a tap). */
export function StandaloneApp() {
  const [started, setStarted] = useState(false);
  if (!started) return <Splash onStart={() => setStarted(true)} />;
  return <Game />;
}

function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="lc-splash relative mx-auto flex aspect-[9/16] max-h-[88vh] w-full max-w-[520px] flex-col items-center justify-end overflow-hidden rounded-2xl bg-cover bg-top text-center text-white shadow-2xl" style={{ backgroundImage: `url(${asset('/assets/bg/lop.webp')})`, backgroundColor: '#c8642a' }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/85" />
      <img src={asset('/assets/nv/co-ngan/02-gioi-thieu.webp')} className="absolute left-[3%] top-[10%] h-[40%] w-auto drop-shadow-2xl" alt="" />
      <div className="relative z-10 w-full px-6 pb-8">
        <div className="text-[13px] font-semibold uppercase tracking-[0.3em] text-amber-300">Interactive game show</div>
        <h1 className="mt-1 text-[38px] font-extrabold leading-tight drop-shadow-lg">🏫 LIVE-CLASS</h1>
        <p className="mx-auto mt-2 max-w-[380px] text-[15px] leading-snug text-white/90">
          Unscramble the letters, solve emoji puzzles, mental math, riddles &amp; history. Type your answer in the comment box — fastest answer gets the most points!
        </p>
        <button
          onClick={() => {
            unlockSpeech();
            sfx.unlock();
            onStart();
          }}
          className="mt-5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-10 py-4 text-[22px] font-extrabold text-amber-950 shadow-[0_6px_0_#b45309] transition active:translate-y-[3px] active:shadow-[0_3px_0_#b45309]"
        >
          ▶ Start class
        </button>
        <div className="mt-3 text-[12px] text-white/70">Turn your sound on — the teacher reads every question aloud.</div>
      </div>
    </div>
  );
}

function Game() {
  const game = useGame();
  const v = game.view;
  const [me] = useState(readMe);
  const [nickname, setNickname] = useState(me.nickname);
  const [text, setText] = useState('');
  const [full, setFull] = useState(false);
  const [sound, setSound] = useState(() => readNum(SOUND_KEY, 1) > 0);
  const [botCount, setBotCount] = useState(() => readNum(BOTS_KEY, 8));
  const bots = useRef<Classmates | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bots.current = new Classmates(() => liveRoom.current);
    return () => bots.current?.stop();
  }, []);
  useEffect(() => {
    bots.current?.setCount(botCount);
    save(BOTS_KEY, String(botCount));
  }, [botCount]);
  useEffect(() => {
    voice.volume = sound ? 1 : 0;
    sfx.volume = sound ? 0.35 : 0;
    if (!sound) voice.stop();
    save(SOUND_KEY, sound ? '1' : '0');
  }, [sound]);

  // real fullscreen when the browser allows it, otherwise a fixed full-window overlay
  useEffect(() => {
    const off = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener('fullscreenchange', off);
    return () => document.removeEventListener('fullscreenchange', off);
  }, []);
  const toggleFull = () => {
    const next = !full;
    setFull(next);
    const el = wrap.current;
    try {
      if (next && el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
      if (!next && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    } catch {
      // overlay mode only
    }
  };

  const name = nickname.trim() || 'You';
  const send = (comment: string) => {
    const c = comment.trim().slice(0, 150);
    if (!c) return;
    void emitTest('chat', { username: me.username, nickname: name, comment: c, createTime: Date.now(), test: false });
  };
  const submit = () => {
    send(text);
    setText('');
    input.current?.focus();
  };
  const saveName = (n: string) => {
    setNickname(n);
    save(ME_KEY, JSON.stringify({ username: me.username, nickname: n }));
  };

  const hint = phaseHint(v);

  return (
    <div ref={wrap} className={`lc-game ${full ? 'lc-full fixed inset-0 z-[2147483000] flex flex-col bg-black' : 'mx-auto w-full max-w-[1100px] space-y-3'}`}>
      <div className={full ? 'relative min-h-0 flex-1' : 'relative'}>
        <StageBox
          full={full}
          bar={bar}
          overlay={
            <div className="absolute left-2 top-2 z-[5] flex gap-1.5">
              <IconBtn onClick={() => setSound(!sound)} title={sound ? 'Mute' : 'Sound on'}>
                {sound ? '🔊' : '🔇'}
              </IconBtn>
              <IconBtn onClick={toggleFull} title={full ? 'Exit full screen' : 'Full screen'}>
                {full ? '✖' : '⛶'}
              </IconBtn>
            </div>
          }
        >
          <GameStage game={game} />
        </StageBox>
      </div>

      {/* comment box: this is how you play. The hint + answer row sit right under the stage and the stage is sized so
          both fit on screen together, also while the phone keyboard is open */}
      <div className={`${full ? 'bg-black/85 p-2' : 'rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700'}`}>
        <div ref={bar}>
          <Strip v={v} hint={hint} />
          <div className="flex gap-2">
            <input
              ref={input}
              className="min-w-0 flex-1 rounded-xl bg-slate-800 px-4 py-3 text-[17px] text-white outline-none ring-1 ring-slate-600 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
              placeholder="Type your answer…"
              aria-label="Type your answer or a comment"
              value={text}
              maxLength={150}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="send"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
            <button onClick={submit} className="shrink-0 rounded-xl bg-amber-500 px-5 text-[16px] font-bold text-slate-950 hover:bg-amber-400 active:bg-amber-600">
              Send
            </button>
          </div>
        </div>
        <div className="lc-quick -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {quickReplies(v).map((q) => (
            <Quick key={q} onClick={() => send(q)}>
              {q}
            </Quick>
          ))}
          <Quick onClick={() => void emitTest('like', { username: me.username, nickname: name, likeCount: 10 })}>❤️ Like ×10</Quick>
          <Quick onClick={() => void emitTest('gift', { username: me.username, nickname: name, giftName: 'Rose', giftId: 5655, diamondCount: 1, repeatCount: 1 })}>🌹 Rose for teacher</Quick>
          <Quick onClick={() => void emitTest('follow', { username: me.username, nickname: name })}>➕ Follow</Quick>
        </div>
        {!full && (
          <label className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-300">
            Your name
            <input
              className="w-40 min-w-0 rounded-md bg-slate-800 px-2 py-1 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-amber-400"
              value={nickname}
              maxLength={24}
              placeholder="You"
              autoComplete="off"
              onChange={(e) => saveName(e.target.value)}
            />
          </label>
        )}
      </div>

      {!full && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-900 p-3 text-[14px] text-slate-200 ring-1 ring-slate-700">
            <span className="font-semibold">👥 Classmates (simulated):</span>
            <input type="range" min={0} max={30} value={botCount} onChange={(e) => setBotCount(Number(e.target.value))} className="w-40 accent-amber-400" />
            <b className="w-6 text-amber-300">{botCount}</b>
            <span className="text-[12px] text-slate-400">They join, guess, play recess games and cheer. Set 0 to play alone.</span>
          </div>

          <Fold title="🎛️ Teacher controls (rounds, big shows, recess, class settings)">
            <GameControls view={v} stageCount={1} />
          </Fold>
          <Fold title="🎙️ Voice, speed & test buttons">
            <VoicePanel channelName={game.channelName} />
          </Fold>
          <HowTo />
        </>
      )}
    </div>
  );
}

/**
 * The question in readable text right above the answer box. On a phone the stage is small and the keyboard covers
 * most of it, so the letters / sum / clue and the time left are repeated here. Fixed 3-line height so the stage
 * does not jump between phases.
 */
function Strip({ v, hint }: { v: ReturnType<typeof useGame>['view']; hint: string }) {
  let top = hint;
  let sub = '';
  if (v) {
    const left = Math.max(0, Math.ceil((v.endsAt - Math.max(Date.now(), v.at ?? 0)) / 1000));
    const asking = (v.phase === 'question' || v.phase === 'bonus') && v.boardShown;
    const shAsk = v.phase === 'show' && v.show && v.boardShown && (v.show.step === 'mc' || v.show.step === 'code' || v.show.step === 'stake');
    if (asking) {
      const n = (v.answer || '').replace(/\s+/g, '').length;
      if (v.math) {
        top = `🧮 Type the number · ⏱ ${left}s`;
        sub = `${v.math} = ?`;
      } else if (v.slot === 'dh') {
        top = `🔍 Emoji puzzle · ${n} letters · ⏱ ${left}s`;
        sub = v.clue;
      } else {
        top = `✍️ ${v.tiles.length ? v.tiles.join(' ') + ' · ' : ''}${n} letters · ⏱ ${left}s`;
        sub = v.clue;
      }
    } else if (v.phase === 'reveal' && v.answer) {
      top = `✅ Answer: ${v.answer}`;
      sub = v.correctTop.length ? `⚡ Fastest: ${v.correctTop.map((c) => c.nickname).join(', ')}` : 'Nobody got it this time';
    } else if (shAsk && v.show) {
      top = `${hint} · ⏱ ${left}s`;
      if (v.show.step === 'mc') sub = `${v.show.question} ${v.show.opts.map((o, i) => (v.show!.removed.includes(i) ? '' : `${'ABCD'[i]}) ${o}`)).filter(Boolean).join('  ')}`;
      else if (v.show.step === 'code' && v.show.code) sub = `${v.show.code.hints.join(' · ')} · ${v.show.code.len} letters`;
    } else if (v.phase === 'vote' && v.vote) {
      sub = `1 = ${v.vote.topics[0]} · 2 = ${v.vote.topics[1]}`;
    }
  }
  return (
    <div className="mb-2 h-[4.35em] overflow-hidden text-[13px] leading-[1.45em] text-slate-300">
      <div className="truncate">{top}</div>
      {sub && <div className="line-clamp-2 font-semibold text-amber-200">{sub}</div>}
    </div>
  );
}

/** what to type right now, in one short line */
function phaseHint(v: ReturnType<typeof useGame>['view']) {
  if (!v) return 'Opening the classroom…';
  if (v.phase === 'question' || v.phase === 'bonus') {
    if (!v.boardShown) return '👂 Listen to the question first…';
    if (v.math) return '🧮 Type the number!';
    return '✍️ Type the word — fastest answer wins +10';
  }
  if (v.phase === 'team') return '🚩 Pick a team: type "team 1", "team 2", "team 3" or "team 4"';
  if (v.phase === 'vote') return '🗳️ Vote for the next topic: type 1 or 2';
  if (v.phase === 'recess' && v.recess) {
    const g = v.recess.game;
    if (g === 'rps') return '✊✋✌️ Type rock, paper or scissors';
    if (g === 'pick') return '⚔️ Pick a side: type 1 or 2';
    if (g === 'roll') return '🙋 Roll call: type "here"';
    if (g === 'callup') return `🎤 Pop quiz for ${v.recess.callName || 'a classmate'}`;
    if (g === 'heart' || g === 'dance') return '❤️ Tap Like to send hearts!';
  }
  if (v.phase === 'show' && v.show) {
    if (v.show.step === 'stake') return '🎲 Bet your points: type 10 or 20';
    if (v.show.step === 'code') return '🔐 Type the secret password word';
    if (v.show.step === 'mc') return '🅰️ Type A, B, C or D';
    return `🎪 ${v.show.name}`;
  }
  return '💬 Chat with the class while you wait';
}

function quickReplies(v: ReturnType<typeof useGame>['view']): string[] {
  if (!v) return [];
  if (v.phase === 'team') return ['team 1', 'team 2', 'team 3', 'team 4'];
  if (v.phase === 'vote') return ['1', '2'];
  if (v.phase === 'recess' && v.recess?.stage === 'play') {
    if (v.recess.game === 'rps') return ['rock', 'paper', 'scissors'];
    if (v.recess.game === 'pick') return ['1', '2'];
    if (v.recess.game === 'roll') return ['here'];
  }
  if (v.phase === 'show' && v.show) {
    if (v.show.step === 'mc') return ['A', 'B', 'C', 'D', ...(v.show.tag === 'final' ? ['hint'] : [])];
    if (v.show.step === 'stake') return ['10', '20'];
  }
  if (v.poll?.length) return v.poll.map((o) => o.key.toUpperCase());
  return ['report card'];
}

/** 1080x1920 stage scaled to the available width (and the screen height) */
function StageBox({ children, full, overlay, bar }: { children: ReactNode; full: boolean; overlay?: ReactNode; bar?: RefObject<HTMLDivElement | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 640 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const vv = window.visualViewport;
    const baseScale = vv?.scale || 1;
    const fit = () => {
      const w = el.clientWidth || 360;
      // visible height: the visual viewport shrinks when the phone keyboard opens (iOS keeps innerHeight the same).
      // While the user pinch-zooms (scale changed) keep the normal height, so zooming in never shrinks the stage.
      const zoomed = vv && Math.abs(vv.scale - baseScale) > 0.01;
      const vh = vv && !zoomed ? vv.height : window.innerHeight;
      // leave room for the hint + answer row (+ card padding and gap) so the board and the answer box are on screen together
      const below = (bar?.current?.offsetHeight ?? 0) + 32;
      const h = full ? el.clientHeight || vh : Math.max(260, Math.min(vh - below, 1920));
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    if (bar?.current) ro?.observe(bar.current);
    window.addEventListener('resize', fit);
    vv?.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      vv?.removeEventListener('resize', fit);
    };
  }, [full, bar]);
  const scale = Math.max(0.1, Math.min(size.w / STAGE_W, size.h / STAGE_H));
  return (
    <div ref={box} className={full ? 'flex h-full w-full items-center justify-center overflow-hidden' : 'flex w-full justify-center'}>
      <div data-stage="" style={{ width: STAGE_W * scale, height: STAGE_H * scale }} className={`relative overflow-hidden ${full ? '' : 'rounded-2xl shadow-2xl ring-1 ring-black/40'}`}>
        <div
          className="absolute left-0 top-0"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            background: `#c8642a url(${asset('/assets/bg/lop.webp')}) top center / 1080px auto no-repeat`,
          }}
        >
          {children}
        </div>
        {overlay}
      </div>
    </div>
  );
}

function VoicePanel({ channelName }: { channelName: string }) {
  const [list, setList] = useState(() => englishVoices());
  const [f, setF] = useState(() => chosenVoice('f'));
  const [m, setM] = useState(() => chosenVoice('m'));
  const [say, setSay] = useState('');
  const [chan, setChan] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const load = () => setList(englishVoices());
    load();
    const t = setInterval(load, 1500);
    setTimeout(() => clearInterval(t), 10_000);
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => {
      clearInterval(t);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
    };
  }, []);
  const fake = () => {
    const names = ['Emma Stone', 'Noah', 'Lily 🌸', 'Jayden', 'Sophie', 'Marco', 'kim_99', 'Aisha'];
    const nickname = names[Math.floor(Math.random() * names.length)];
    return { nickname, username: `test-${nickname.toLowerCase().replace(/[^a-z0-9]/g, '')}` };
  };
  const sel = 'w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700';
  return (
    <div className="space-y-3 text-sm text-slate-200">
      {!speechAvailable() && (
        <div className="rounded-lg bg-amber-500/15 p-2 text-amber-200 ring-1 ring-amber-500/30">
          This browser has no text-to-speech voice yet. The game still runs (silently on a timer). Chrome, Edge and Safari have built-in English voices.
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          👩‍🏫 Female teacher voice
          <select className={sel} value={f} onChange={(e) => (setF(e.target.value), chooseVoice('f', e.target.value))}>
            <option value="">Automatic</option>
            {list.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name} ({x.lang})
              </option>
            ))}
          </select>
        </label>
        <label>
          👨‍🏫 Male teacher voice
          <select className={sel} value={m} onChange={(e) => (setM(e.target.value), chooseVoice('m', e.target.value))}>
            <option value="">Automatic</option>
            {list.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name} ({x.lang})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        Speed:
        {['0.85', '1', '1.15', '1.3'].map((r) => (
          <Quick key={r} onClick={() => (voice.rate = Number(r), void sendControl('setRate', r))}>
            {r}×
          </Quick>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2" placeholder="Type a line for the teacher to read now…" value={say} onChange={(e) => setSay(e.target.value)} />
        <Quick onClick={() => say.trim() && (void sendControl('speak', say), setSay(''))}>📢 Read it</Quick>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        Class name: <b className="text-amber-300">{channelName}</b>
        <input className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2" placeholder="New class name on the sign…" maxLength={40} value={chan} onChange={(e) => setChan(e.target.value)} />
        <Quick
          onClick={async () => {
            if (!chan.trim()) return;
            const r = await sendControl('setName', chan);
            setMsg(r.success ? 'Class name saved' : r.error);
            setChan('');
          }}
        >
          Save
        </Quick>
      </div>
      <div>
        <div className="mb-1 text-slate-400">Test events (as if a viewer did it):</div>
        <div className="flex flex-wrap gap-1.5">
          <Quick onClick={() => void emitTest('chat', { ...fake(), comment: 'join class' })}>✋ "join class"</Quick>
          <Quick onClick={() => void emitTest('chat', { ...fake(), comment: 'love this live!' })}>💬 Comment</Quick>
          <Quick onClick={() => void emitTest('chat', { ...fake(), comment: "it's my birthday today" })}>🎂 Birthday comment</Quick>
          <Quick onClick={() => void emitTest('gift', { ...fake(), giftName: 'Rose', giftId: 5655, diamondCount: 1, repeatCount: 5 })}>🌹 5 roses</Quick>
          <Quick onClick={() => void emitTest('gift', { ...fake(), giftName: 'Lion', giftId: 6369, diamondCount: 29999, repeatCount: 1 })}>🦁 Big gift</Quick>
          <Quick onClick={() => void emitTest('follow', fake())}>➕ Follow</Quick>
          <Quick onClick={() => void emitTest('like', { ...fake(), likeCount: 100 })}>❤️ 100 hearts</Quick>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Quick
          onClick={() => {
            void sendControl('reset');
            setMsg('Restarted the class');
          }}
        >
          🔄 Restart class
        </Quick>
        <Quick
          onClick={() => {
            if (window.confirm('Forget all scores, report cards and asked questions saved on this device?')) {
              clearBook();
              setMsg('Saved data cleared');
            }
          }}
        >
          🧹 Clear saved scores
        </Quick>
        {msg && <span className="text-amber-300">{msg}</span>}
      </div>
    </div>
  );
}

function HowTo() {
  return (
    <div className="rounded-2xl bg-slate-900 p-4 text-[13px] leading-relaxed text-slate-300 ring-1 ring-slate-700">
      <div className="mb-1 text-[15px] font-bold text-amber-300">How to play</div>
      <ul className="list-disc space-y-0.5 pl-5">
        <li>Type anything to join the class and get a seat. Top scores sit in the front row.</li>
        <li>Each class has 20 questions: scrambled words, emoji puzzles, mental math, spelling, riddles and history. Question 20 is golden (double points).</li>
        <li>Answers count only after the teacher finishes reading. Fastest 5: +10 / +7 / +5 / +3 / +3, everyone else correct: +1.</li>
        <li>Recess games: rock-paper-scissors, roll call ("here"), pick a side (1 / 2), pop quiz, heart challenge and dance time.</li>
        <li>Every few classes: the big shows <b>Road to Everest</b> and <b>Golden Bell</b> — answer A, B, C or D.</li>
        <li>Type <b>report card</b> any time to hear your lifetime grade and badges (saved on this device).</li>
      </ul>
      <div className="mt-2 text-slate-500">
        LIVE-CLASS game show by{' '}
        <a href="https://duongbirken.deta.vn" target="_blank" rel="noreferrer" className="text-amber-400 underline">
          Duong Birken
        </a>{' '}
        · English single-file edition.
      </div>
    </div>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700">
      <summary className="cursor-pointer select-none text-[15px] font-semibold text-slate-100">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
function Quick({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="shrink-0 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-[13px] font-medium text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 active:bg-slate-600">
      {children}
    </button>
  );
}
function IconBtn({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-[18px] text-white ring-1 ring-white/25 backdrop-blur hover:bg-black/75">
      {children}
    </button>
  );
}
