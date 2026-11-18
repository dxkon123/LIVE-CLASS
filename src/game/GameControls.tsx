import { useEffect, useRef, useState } from 'react';
import { emitTest, sendControl } from '../live/page';
import { api } from '../live/api';
import type { StageView } from './useGame';
import { GAME, shownTeacherName, type RoomCfg } from './config';

const HO = ['Smith', 'Garcia', 'Lee', 'Patel', 'Brown', 'Nguyen', 'Kim', 'Lopez'];
const TEN = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Sophia', 'Mason', 'Isla', 'Leo'];
const CHAT = ['so hard teacher', 'what word is that', 'love this', 'join class', 'teacher is so pretty', 'wait what', '???', 'hehe'];
const fake = (i: number) => ({ username: `hs${i}`, nickname: `${TEN[i % TEN.length]} ${HO[i % HO.length]}`, avatar: '' });
const shuffleWord = (w: string) => [...w].sort(() => Math.random() - 0.5).join('');

const KY_THI = [
  { nhan: 'WARM-UP', moTa: 'Questions 1–5' },
  { nhan: 'SPEED UP', moTa: 'Questions 6–10' },
  { nhan: 'LEVEL UP', moTa: 'Questions 11–15' },
  { nhan: 'FINALS', moTa: 'Questions 16–20' },
];

export function GameControls({ view, stageCount = 0 }: { view: StageView | null; stageCount?: number }) {
  const btn = 'rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40';
  const o = 'mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 focus:ring-amber-400';

  const [cfg, setCfg] = useState<RoomCfg>(GAME.defaultRoom);
  const [teacherName, setTeacherName] = useState('');
  const [motto, setMotto] = useState('');
  const [daLuu, setDaLuu] = useState('');
  const [stopAt, setStopAt] = useState<number | null>(null);
  const [remainSec, setRemainSec] = useState(0);
  const [sent, setSent] = useState(0);
  const [running, setRunning] = useState(false);
  const [bdName, setBdName] = useState('');
  const [mins, setMins] = useState('');
  const [danceText, setDanceText] = useState('');
  const [danceSec, setDanceSec] = useState('');
  const [bdText, setBdText] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const load = (r: Partial<RoomCfg>) => {
    const merged = { ...GAME.defaultRoom, ...r };
    setCfg(merged);
  };

  useEffect(() => {
    api('/api/room-settings')
      .then((r) => r.json())
      .then(load)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!stopAt) {
      setRemainSec(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((stopAt - Date.now()) / 1000));
      setRemainSec(left);
      if (left <= 0) {
        setStopAt(null);
        void sendControl('custom', 'goodbye');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [stopAt]);

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const save = async (patch: Partial<RoomCfg>, done: string) => {
    const r = await api('/api/room-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((x) => x.json());
    setDaLuu(r.success ? done : r.error);
    if (r.success) {
      load(r.room);
      window.dispatchEvent(new CustomEvent('voice-changed'));
    }
    return r.success as boolean;
  };

  const luuTenVaBang = async () => {
    const patch: Partial<RoomCfg> = {};
    if (teacherName.trim()) patch.teacherName = teacherName.trim();
    if (motto.trim()) patch.motto = motto.trim();
    if (Object.keys(patch).length === 0) {
      setDaLuu('Kept the default names');
      return;
    }
    const ok = await save(patch, 'Saved, the screen updates right away');
    if (ok) {
      setTeacherName('');
      setMotto('');
    }
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setDaLuu('Uploading the background...');
    const r = await api('/api/room-bg', { method: 'POST', headers: { 'Content-Type': f.type }, body: f })
      .then((x) => x.json())
      .catch(() => ({ success: false, error: 'Image too big or wrong type (PNG, JPG, WEBP, max 12 MB)' }));
    setDaLuu(r.success ? 'Classroom background changed' : r.error);
    if (r.success) load(r.room);
    if (file.current) file.current.value = '';
  };

  const resetBg = async () => {
    const r = await api('/api/room-bg', { method: 'DELETE' }).then((x) => x.json());
    setDaLuu('Back to the default classroom');
    load(r.room);
  };

  const flood = async (n: number) => {
    if (!view?.answer || running) return;
    setRunning(true);
    setSent(0);
    const answer = view.answer.toLowerCase();
    const start = Date.now();
    let done = 0;
    await Promise.all(
      Array.from({ length: n }, (_, i) => {
        const r = Math.random();
        const comment = r < 0.2 ? answer : r < 0.45 ? shuffleWord(answer) : CHAT[i % CHAT.length];
        const delay = Math.random() * 8_000;
        return new Promise<void>((ok) =>
          setTimeout(async () => {
            await emitTest('chat', { ...fake(i), comment, createTime: start + delay - Math.random() * 1200 }).catch(() => {});
            setSent(++done);
            ok();
          }, delay),
        );
      }),
    );
    setRunning(false);
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      {stageCount > 1 && (
        <div className="rounded-lg bg-red-600 p-2 text-xs font-semibold text-white">
          ⚠️ {stageCount} stage pages are open, the voices will overlap. Close the extra ones!
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-amber-300">LIVE-CLASS</div>
        {view && (
          <div className="text-xs text-slate-300">
            Class <b>{view.round}</b> · Question <b>{view.qNo}/{view.total}</b> · Answer:{' '}
            <b className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">{view.answer || '—'}</b> · Correct:{' '}
            <b className="text-emerald-400">{view.correctCount}</b>/{view.stats.attempts} ({view.players} players)
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-sm text-white/70">
          Teacher (character)
          <select
            className={o}
            value={cfg.teacher}
            onChange={(e) => {
              const teacher = e.target.value as RoomCfg['teacher'];
              const patch: Partial<RoomCfg> = { teacher, teacherVoice: teacher === 'thay' ? 'nam' : 'nu' };
              if (teacher === 'thay' && /^(ms|miss|mrs)\.?(\s|$)/i.test(cfg.teacherName)) patch.teacherName = GAME.defaultThayName;
              if (teacher === 'co' && /^(mr|sir)\.?(\s|$)/i.test(cfg.teacherName)) patch.teacherName = GAME.defaultRoom.teacherName;
              void save(patch, teacher === 'thay' ? 'Switched to Mr. Minh (male voice)' : 'Switched to Ms. Ngan (female voice)');
            }}
          >
            <option value="co" className="bg-slate-900">👩‍🏫 Ms. Ngan (female teacher)</option>
            <option value="thay" className="bg-slate-900">👨‍🏫 Mr. Minh (male teacher)</option>
          </select>
        </label>
        <label className="text-sm text-white/70">
          Teacher name (name badge)
          <input
            className={o}
            value={teacherName}
            maxLength={24}
            placeholder={shownTeacherName(cfg)}
            onChange={(e) => setTeacherName(e.target.value)}
          />
        </label>
        <label className="text-sm text-white/70">
          Red banner slogan (max 40 characters)
          <input
            className={o}
            value={motto}
            maxLength={40}
            placeholder={cfg.motto}
            onChange={(e) => setMotto(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`} onClick={luuTenVaBang}>
          💾 Save
        </button>
        <span className="text-sm text-white/60">{daLuu || 'Leave empty to keep the defaults'}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`${btn} bg-amber-600 text-white hover:bg-amber-500`}
          onClick={() => {
            setStopAt(null);
            void sendControl('custom', 'newRound');
          }}
        >
          ▶ Start a new class now
        </button>
        <button className={`${btn} bg-slate-700 text-white hover:bg-slate-600`} onClick={() => sendControl('custom', 'skip')}>
          ⏭ Skip to next part
        </button>
        <button
          className={`${btn} bg-red-800 text-white hover:bg-red-700`}
          disabled={!view?.answer || !!view.math || !['question', 'bonus', 'reveal'].includes(view.phase)}
          onClick={() => sendControl('custom', 'ban')}
        >
          🚫 Drop this question
        </button>
        <button
          className={`${btn} bg-rose-600 text-white ring-1 ring-rose-400/50 hover:bg-rose-500`}
          onClick={() => {
            setStopAt(null);
            void sendControl('custom', 'goodbye');
          }}
        >
          🛑 End class ({cfg.teacher === 'thay' ? 'Mr. Minh' : 'Ms. Ngan'} says goodbye)
        </button>
      </div>

      <div className="rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/75">
          <span>⏰ Auto-stop timer: the game ends and {cfg.teacher === 'thay' ? 'Mr. Minh' : 'Ms. Ngan'} says goodbye:</span>
          {stopAt ? (
            <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 font-bold text-rose-300">
              ⏳ Ends in {fmtTime(remainSec)}
            </span>
          ) : (
            <span className="text-white/40">No timer set</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60, 90, 120].map((phut) => (
            <button
              key={phut}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
              onClick={() => setStopAt(Date.now() + phut * 60_000)}
            >
              +{phut} min
            </button>
          ))}
          {stopAt && (
            <button
              className="rounded-lg bg-rose-900/60 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-800"
              onClick={() => setStopAt(null)}
            >
              ✖ Cancel timer
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-white/60">Jump to a term (changes the board style &amp; the teacher's outfit):</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KY_THI.map((v, i) => (
          <button
            key={i}
            className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/30"
            onClick={() => sendControl('custom', `vong:${i}`)}
          >
            Term {i + 1}: {v.nhan}
          </button>
        ))}
      </div>

      <div className="text-sm text-white/60">Simulate players (press while a question is on the board):</div>
      <div className="flex flex-wrap gap-2">
        <button
          className={`${btn} bg-white/10 text-white hover:bg-white/20`}
          onClick={() => emitTest('chat', { ...fake(Math.floor(Math.random() * 50)), comment: view?.answer.toLowerCase() ?? '' })}
        >
          1 correct player
        </button>
        <button className={`${btn} bg-white/10 text-white hover:bg-white/20`} disabled={running} onClick={() => flood(60)}>
          60 players
        </button>
        <button className={`${btn} bg-white/10 text-white hover:bg-white/20`} disabled={running} onClick={() => flood(500)}>
          500 players
        </button>
        {sent > 0 && <span className="self-center text-xs text-amber-300">Sent: {sent}</span>}
      </div>

      <details className="rounded-xl bg-black/25 p-3 text-xs text-slate-300 ring-1 ring-white/10">
        <summary className="cursor-pointer font-semibold text-amber-200">
          ⚙️ More: big shows (Everest / Golden Bell), recess, hall monitor &amp; class settings
        </summary>
        <div className="mt-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            <button className="rounded-lg bg-sky-700 px-3 py-1.5 font-semibold text-white hover:bg-sky-600" onClick={() => sendControl('custom', 'show:everest')}>
              🏔️ Play now: Road to Everest
            </button>
            <button className="rounded-lg bg-amber-700 px-3 py-1.5 font-semibold text-white hover:bg-amber-600" onClick={() => sendControl('custom', 'show:chuong')}>
              🔔 Play now: Golden Bell
            </button>
            <button className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-white hover:bg-slate-600" onClick={() => sendControl('custom', 'recess:dance')}>
              💃 Recess: dance
            </button>
            <button className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-white hover:bg-slate-600" onClick={() => sendControl('custom', 'recess:rps')}>
              ✊ Rock paper scissors
            </button>
            <button className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-white hover:bg-slate-600" onClick={() => sendControl('custom', 'recess:callup')}>
              📢 Pop quiz
            </button>
            <button className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-white hover:bg-slate-600" onClick={() => sendControl('custom', 'recess:roll')}>
              🙋 Roll call
            </button>
            <button className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-white hover:bg-slate-600" onClick={() => sendControl('custom', 'escort')}>
              👮 Hall monitor visit
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={bdName}
              onChange={(e) => setBdName(e.target.value)}
              placeholder="Birthday person's name..."
              className="w-48 rounded-lg bg-slate-900 px-2.5 py-1.5 text-white ring-1 ring-white/15"
            />
            <button
              onClick={() => {
                if (bdName.trim()) sendControl('custom', `birthday:${bdName.trim()}`);
                setBdName('');
              }}
              className="rounded-lg bg-pink-700 px-3 py-1.5 font-semibold text-white hover:bg-pink-600"
            >
              🎂 Wish happy birthday
            </button>
            <label className="ml-2 flex items-center gap-1">
              <input
                type="checkbox"
                checked={cfg.everest}
                onChange={(e) => save({ everest: e.target.checked }, e.target.checked ? 'Everest on' : 'Everest off')}
              />
              🏔️ Auto Everest
            </label>
            <label className="ml-2 flex items-center gap-1">
              <input
                type="checkbox"
                checked={cfg.chuong}
                onChange={(e) => save({ chuong: e.target.checked }, e.target.checked ? 'Golden Bell on' : 'Golden Bell off')}
              />
              🔔 Auto Golden Bell
            </label>
            <label className="ml-2 flex items-center gap-1">
              <input
                type="checkbox"
                checked={cfg.standWrong}
                onChange={(e) => save({ standWrong: e.target.checked }, e.target.checked ? 'Front-of-class cheering on' : 'Front-of-class cheering off')}
              />
              🙋 Wrong answer = cheer at the front
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={cfg.supervisor}
                onChange={(e) => save({ supervisor: e.target.checked }, e.target.checked ? 'Hall monitor on' : 'Hall monitor off')}
              />
              👮 Hall monitor after
            </label>
            <input
              className="w-14 rounded-lg bg-slate-900 px-2 py-1 text-white ring-1 ring-white/15"
              type="number"
              min={1}
              max={60}
              placeholder={String(cfg.supervisorMin)}
              value={mins}
              onChange={(e) => setMins(e.target.value)}
            />
            <span>min</span>
            <button
              disabled={!mins}
              onClick={() => save({ supervisorMin: Number(mins) }, 'Hall monitor minutes changed').then((ok) => ok && setMins(''))}
              className="rounded-lg bg-slate-700 px-2.5 py-1 text-white disabled:opacity-40"
            >
              Save
            </button>
            <span className="ml-2">💃 Dance recess:</span>
            <select
              className="rounded-lg bg-slate-900 px-2 py-1 text-white ring-1 ring-white/15"
              value={cfg.dance}
              onChange={(e) => save({ dance: e.target.value as RoomCfg['dance'] }, 'Dance mode changed')}
            >
              <option value="off">Off</option>
              <option value="mix">Sometimes</option>
              <option value="always">Every recess</option>
            </select>
            <input
              className="w-14 rounded-lg bg-slate-900 px-2 py-1 text-white ring-1 ring-white/15"
              type="number"
              min={10}
              max={120}
              placeholder={String(cfg.danceSec)}
              value={danceSec}
              onChange={(e) => setDanceSec(e.target.value)}
            />
            <span>sec</span>
            <button
              disabled={!danceSec}
              onClick={() => save({ danceSec: Number(danceSec) }, 'Dance time changed').then((ok) => ok && setDanceSec(''))}
              className="rounded-lg bg-slate-700 px-2.5 py-1 text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span>Dance banner:</span>
            <input
              className="min-w-0 flex-1 rounded-lg bg-slate-900 px-2 py-1 text-white ring-1 ring-white/15"
              placeholder={cfg.danceText}
              maxLength={80}
              value={danceText}
              onChange={(e) => setDanceText(e.target.value)}
            />
            <button
              disabled={!danceText.trim()}
              onClick={() => save({ danceText }, 'Dance banner changed').then((ok) => ok && setDanceText(''))}
              className="rounded-lg bg-slate-700 px-2.5 py-1 text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span>🎂 Birthday banner:</span>
            <input
              className="min-w-0 flex-1 rounded-lg bg-slate-900 px-2 py-1 text-white ring-1 ring-white/15"
              placeholder={cfg.birthdayText}
              maxLength={60}
              value={bdText}
              onChange={(e) => setBdText(e.target.value)}
            />
            <button
              disabled={!bdText.trim()}
              onClick={() => save({ birthdayText: bdText }, 'Birthday banner changed').then((ok) => ok && setBdText(''))}
              className="rounded-lg bg-slate-700 px-2.5 py-1 text-white disabled:opacity-40"
            >
              Save
            </button>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button onClick={() => file.current?.click()} className="rounded-lg bg-slate-700 px-2.5 py-1 text-white hover:bg-slate-600">
              🖼️ Change background...
            </button>
            {cfg.bg && (
              <button onClick={resetBg} className="rounded-lg bg-rose-800 px-2.5 py-1 text-white">
                Default background
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
