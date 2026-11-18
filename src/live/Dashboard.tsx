import { useEffect, useState, type ReactNode } from 'react';
import type { LiveStatus } from './types';
import { emitTest, sendControl } from './page';

type EdgeVoice = '__edge_f__' | '__edge_m__';

const FAKE_NAMES = ['Emma Stone', 'Noah', 'Lily 🌸', 'Jayden', 'Sophie', 'Marco', 'kim_99', '𝑨𝒊𝒔𝒉𝒂'];
const pick = () => {
  const nickname = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  return { nickname, username: nickname.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'guest' };
};

/**
 * Control page (http://localhost:3006). Silent, it never plays sound.
 * Same look and feel as the other live-game dashboards.
 */
export function Dashboard({
  status,
  channelName,
  preview,
  extra,
}: {
  status: LiveStatus | null;
  channelName: string;
  preview: ReactNode;
  extra?: ReactNode;
}) {
  const [user, setUser] = useState(() => localStorageGet('tiktokUser'));
  const [nameText, setNameText] = useState('');
  const [msg, setMsg] = useState('');
  const [speakText, setSpeakText] = useState('');
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<EdgeVoice>('__edge_f__');

  // teacher voice: Microsoft Edge female (Jenny) or male (Guy); the class settings can change it too
  useEffect(() => {
    const load = () => {
      fetch('/api/tts/status')
        .then((r) => r.json())
        .then((d: { voice?: string }) => setVoice(d.voice === '__edge_m__' ? '__edge_m__' : '__edge_f__'))
        .catch(() => {});
    };
    load();
    window.addEventListener('voice-changed', load);
    return () => window.removeEventListener('voice-changed', load);
  }, []);

  const changeVoice = async (next: EdgeVoice) => {
    setVoice(next);
    try {
      const r = await fetch('/api/tts/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: next }),
      }).then((x) => x.json());
      setMsg(r.success ? (next === '__edge_m__' ? 'Switched to the male voice (Guy)' : 'Switched to the female voice (Jenny)') : r.error);
      window.dispatchEvent(new CustomEvent('voice-changed'));
    } catch (e) {
      setMsg(String(e));
    }
  };

  const connect = async () => {
    setBusy(true);
    setMsg('');
    localStorageSet('tiktokUser', user);
    try {
      const r = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user }),
      }).then((x) => x.json());
      setMsg(r.success ? 'Connected' : r.error);
    } catch (e) {
      setMsg(String(e));
    }
    setBusy(false);
  };

  const disconnect = () => fetch('/api/tiktok/disconnect', { method: 'POST' });

  const speak = async () => {
    const r = await sendControl('speak', speakText);
    setMsg(r.pages > 1 ? `Sent (${r.pages} pages open)` : 'Sent');
    setSpeakText('');
  };

  const saveName = async () => {
    const r = await sendControl('setName', nameText);
    setMsg(r.success ? `Class name saved: ${nameText.trim()}` : r.error);
    if (r.success) setNameText('');
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <Card title="Connect TikTok LIVE">
            <div className="flex flex-wrap gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2"
                placeholder="TikTok username (no @)"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && user.trim() && connect()}
              />
              <Btn onClick={connect} disabled={busy || !user.trim()}>
                {busy ? 'Connecting...' : 'Connect'}
              </Btn>
              <Btn onClick={disconnect} tone="ghost">
                Disconnect
              </Btn>
            </div>
            <div className="mt-3 text-sm">
              Status:{' '}
              {status?.isConnected ? (
                <span className="text-emerald-400">
                  Live @{status.username} · {status.viewerCount} viewers · {status.totalLikes} hearts
                </span>
              ) : status?.isConnecting ? (
                <span className="text-amber-400">Connecting...</span>
              ) : (
                <span className="text-slate-400">Not connected</span>
              )}
            </div>
            {(msg || status?.error) && <div className="mt-1 text-sm text-amber-300">{msg || status?.error}</div>}
            <div className="mt-3 rounded-lg bg-slate-800/60 p-3 text-xs text-slate-400">
              Link for TikTok LIVE Studio:{' '}
              <b className="text-slate-200">http://lvh.me:{window.location.port || 3006}/?view=stage</b> · 1080 × 1920. Only that page plays sound.
            </div>
          </Card>

          <Card title="Stage voice">
            <div className="mb-3 rounded-xl bg-slate-800/70 p-3 text-sm ring-1 ring-slate-700/60">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-200">Teacher voice:</span>
                <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs font-medium text-sky-300">
                  🔵 Microsoft Edge English voices (internet needed)
                </span>
              </div>
              <select
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700 focus:ring-amber-400"
                value={voice}
                onChange={(e) => changeVoice(e.target.value as EdgeVoice)}
              >
                <option value="__edge_f__">🌐 Microsoft Edge (Jenny, female)</option>
                <option value="__edge_m__">🌐 Microsoft Edge (Guy, male)</option>
              </select>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span>
                Class name: <b className="text-amber-300">{channelName}</b>
              </span>
              <input
                className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2"
                placeholder="New class name on the sign..."
                maxLength={40}
                value={nameText}
                onChange={(e) => setNameText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && nameText.trim() && saveName()}
              />
              <Btn onClick={saveName} disabled={!nameText.trim()}>
                Save
              </Btn>
            </div>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2"
                placeholder="Type a line for the teacher to read now..."
                value={speakText}
                onChange={(e) => setSpeakText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && speakText.trim() && speak()}
              />
              <Btn onClick={speak} disabled={!speakText.trim()}>
                Read it
              </Btn>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              Speed:
              {['0.85', '1', '1.15', '1.3'].map((r) => (
                <Btn key={r} tone="ghost" onClick={() => sendControl('setRate', r)}>
                  {r}×
                </Btn>
              ))}
              <Btn tone="danger" onClick={() => confirmReset()}>
                Reset game
              </Btn>
            </div>
          </Card>

          <Card title="Simulator (test before going live)">
            <div className="flex flex-wrap gap-2">
              <Btn tone="ghost" onClick={() => emitTest('member', pick())}>
                👋 Viewer joins
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('chat', { ...pick(), comment: 'join class' })}>
                ✋ Type "join class"
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('chat', { ...pick(), comment: 'love this live!' })}>
                💬 Comment
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('chat', { ...pick(), comment: "it's my birthday today" })}>
                🎂 Birthday comment
              </Btn>
              <Btn
                tone="ghost"
                onClick={() => emitTest('gift', { ...pick(), giftName: 'rose', giftId: 5655, diamondCount: 1, repeatCount: 5 })}
              >
                🌹 5 roses
              </Btn>
              <Btn
                tone="ghost"
                onClick={() => emitTest('gift', { ...pick(), giftName: 'Lion', giftId: 6369, diamondCount: 29999, repeatCount: 1 })}
              >
                🦁 Big gift
              </Btn>
              <Btn tone="ghost" onClick={() => comboSameUser()}>
                🔁 Same viewer gifts 3 times
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('follow', pick())}>
                ➕ Follow
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('like', { ...pick(), likeCount: 100 })}>
                ❤️ 100 hearts
              </Btn>
            </div>
            <p className="mt-2 text-xs text-slate-500">Test events go to every open page, including the stage inside LIVE Studio.</p>
          </Card>

          {extra}

          <Card title="About the project">
            <div className="space-y-2.5 text-sm text-slate-300">
              <p>
                <b className="text-amber-300">LIVE-CLASS (v2.0, English edition)</b> — a fully automatic multi-topic classroom game show for TikTok LIVE, created by{' '}
                <a
                  href="https://duongbirken.deta.vn"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-amber-400 underline decoration-amber-400/50 hover:text-amber-300"
                >
                  Duong Birken
                </a>
                .
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://duongbirken.deta.vn"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  🌐 Website: duongbirken.deta.vn
                </a>
                <a
                  href="/report"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700"
                >
                  📊 Today's live report
                </a>
              </div>
            </div>
          </Card>
        </div>

        <div className="justify-self-center">
          <div className="mb-2 text-center text-sm text-slate-400">Preview (silent)</div>
          <div className="overflow-hidden rounded-2xl ring-1 ring-slate-700">{preview}</div>
        </div>
      </div>
    </div>
  );
}

// Same person sends 3 gifts 1 second apart: thanked only once
function comboSameUser() {
  const who = pick();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => emitTest('gift', { ...who, giftName: 'rose', giftId: 5655, diamondCount: 1, repeatCount: 1 }), i * 1000);
  }
}

function confirmReset() {
  void sendControl('reset');
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  tone = 'primary',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
}) {
  const cls = {
    primary: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
    ghost: 'bg-slate-800 hover:bg-slate-700',
    danger: 'bg-rose-700 hover:bg-rose-600',
  }[tone];
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

function localStorageGet(k: string) {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function localStorageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore
  }
}
