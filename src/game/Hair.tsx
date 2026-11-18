/**
 * Hair seen from behind, drawn in SVG so every student gets a style (fixed per account name).
 * The 100x100 box = the head area removed from the body image (public/assets/nv/<nam|nu>/head.json); the hair may spill outside it.
 * Upgrades through the 4 terms (stageIdx 0..3):
 * - Term 3 (stageIdx = 2, LEVEL UP): red "victory" headband + ribbon tails behind the head.
 * - Term 4 (stageIdx = 3, FINALS): golden laurel wreath (the top 3 also get a graduation cap 🎓).
 */
const COLORS = ['#1d1714', '#1d1714', '#1d1714', '#1d1714', '#2f221b', '#2f221b', '#2f221b', '#4a3021', '#4a3021', '#7a4b2a', '#b8862f', '#c76b8e'];
const BOY = ['ngan', 'ngan', 'dinh', 'xoan', 'mu'] as const;
const GIRL = ['duoi', 'bui', 'bim', 'xoa', 'bob', 'hai-chum'] as const;
const CAPS = ['#dc2626', '#2563eb', '#16a34a', '#111827'];
const SKIN = '#f3c9a2';
const LINE = '#2a1a10';

export const hashName = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};

export function Hair({
  username,
  girl,
  stageIdx = 0,
  rank = 99,
}: {
  username: string;
  girl: boolean;
  stageIdx?: 0 | 1 | 2 | 3;
  rank?: number;
}) {
  const h = hashName(username);
  const color = COLORS[h % COLORS.length];
  const style = girl ? GIRL[(h >> 4) % GIRL.length] : BOY[(h >> 4) % BOY.length];
  const accent = CAPS[(h >> 8) % CAPS.length];
  const shine = 'rgba(255,255,255,0.18)';
  const ears = (
    <>
      <ellipse cx="7" cy="60" rx="7" ry="11" fill={SKIN} stroke={LINE} strokeWidth="2" />
      <ellipse cx="93" cy="60" rx="7" ry="11" fill={SKIN} stroke={LINE} strokeWidth="2" />
    </>
  );
  const skull = <ellipse cx="50" cy="52" rx="43" ry="47" fill={color} stroke={LINE} strokeWidth="2.5" />;
  const strands = (
    <path d="M50 8 C40 30 34 55 36 88 M50 8 C60 30 66 55 64 88 M30 18 C22 40 20 60 24 82 M70 18 C78 40 80 60 76 82" stroke={shine} strokeWidth="2.5" fill="none" />
  );

  let body;
  switch (style) {
    case 'ngan':
      body = (
        <>
          {ears}
          {skull}
          {strands}
          <path d="M18 86 Q50 100 82 86" stroke={LINE} strokeWidth="2" fill="none" />
        </>
      );
      break;
    case 'dinh': // buzz cut: thin hair, scalp shows
      body = (
        <>
          {ears}
          <ellipse cx="50" cy="52" rx="43" ry="47" fill={SKIN} stroke={LINE} strokeWidth="2.5" />
          <ellipse cx="50" cy="50" rx="41" ry="44" fill={color} opacity="0.72" />
        </>
      );
      break;
    case 'xoan': // curly hair: wavy edge
      body = (
        <>
          {ears}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <circle key={i} cx={50 + Math.cos(a) * 38} cy={50 + Math.sin(a) * 42} r="14" fill={color} stroke={LINE} strokeWidth="2" />;
          })}
          <ellipse cx="50" cy="50" rx="38" ry="42" fill={color} />
        </>
      );
      break;
    case 'mu': // backwards baseball cap
      body = (
        <>
          {ears}
          {skull}
          <path d="M8 46 A42 40 0 0 1 92 46 Z" fill={accent} stroke={LINE} strokeWidth="2.5" />
          <rect x="30" y="38" width="40" height="10" rx="4" fill="#fff" opacity="0.85" />
          <path d="M14 46 Q50 34 86 46 L92 62 Q50 50 8 62 Z" fill={accent} stroke={LINE} strokeWidth="2.5" />
        </>
      );
      break;
    case 'duoi': // ponytail
      body = (
        <>
          <path d="M50 40 C66 60 64 110 50 150 C38 110 36 60 50 40 Z" fill={color} stroke={LINE} strokeWidth="2.5" />
          {skull}
          {strands}
          <circle cx="50" cy="40" r="7" fill={accent} stroke={LINE} strokeWidth="2" />
        </>
      );
      break;
    case 'bui': // bun
      body = (
        <>
          {skull}
          {strands}
          <circle cx="50" cy="16" r="18" fill={color} stroke={LINE} strokeWidth="2.5" />
          <path d="M36 28 Q50 36 64 28" stroke={accent} strokeWidth="5" fill="none" />
        </>
      );
      break;
    case 'bim': // two braids with bows
      body = (
        <>
          {[24, 76].map((x) => (
            <g key={x}>
              <path d={`M${x} 70 C${x - 8} 95 ${x + 8} 115 ${x} 145`} stroke={color} strokeWidth="16" strokeLinecap="round" fill="none" />
              <path d={`M${x - 8} 120 l16 0 M${x - 8} 132 l16 0`} stroke={LINE} strokeWidth="1.5" />
              <path d={`M${x} 104 l-12 -7 l0 14 Z M${x} 104 l12 -7 l0 14 Z`} fill={accent} stroke={LINE} strokeWidth="1.5" />
            </g>
          ))}
          {skull}
          {strands}
          <line x1="50" y1="6" x2="50" y2="96" stroke={LINE} strokeWidth="1.5" opacity="0.6" />
        </>
      );
      break;
    case 'xoa': // long hair down
      body = (
        <>
          <path d="M8 50 Q4 120 14 150 L86 150 Q96 120 92 50 Z" fill={color} stroke={LINE} strokeWidth="2.5" />
          {skull}
          {strands}
          <path d="M30 100 L28 148 M50 100 L50 150 M70 100 L72 148" stroke={shine} strokeWidth="2.5" />
        </>
      );
      break;
    case 'bob': // shoulder-length bob
      body = (
        <>
          <path d="M4 52 A46 48 0 0 1 96 52 L98 104 Q50 114 2 104 Z" fill={color} stroke={LINE} strokeWidth="2.5" />
          {strands}
        </>
      );
      break;
    case 'hai-chum': // two pigtails
      body = (
        <>
          {[2, 98].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="88" rx="13" ry="26" fill={color} stroke={LINE} strokeWidth="2.5" />
              <circle cx={x < 50 ? x + 8 : x - 8} cy="64" r="6" fill={accent} stroke={LINE} strokeWidth="1.5" />
            </g>
          ))}
          {skull}
          {strands}
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute overflow-visible" style={{ inset: 0, width: '100%', height: '100%' }}>
      {body}
      {/* Term 3 (LEVEL UP): red headband with gold trim, tied at the back */}
      {stageIdx === 2 && (
        <g>
          <path d="M9 36 Q50 46 91 36 L92 45 Q50 55 8 45 Z" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.8" />
          <circle cx="50" cy="44" r="5.5" fill="#fbbf24" stroke="#7f1d1d" strokeWidth="1.5" />
          <path d="M48 46 C40 58 34 68 30 78" stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M52 46 C60 58 66 68 70 78" stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </g>
      )}
      {/* Term 4 (FINALS): golden laurel wreath + graduation cap for the top 3 */}
      {stageIdx === 3 && (
        <g>
          {/* golden laurel wreath around the head */}
          <path d="M10 38 Q50 52 90 38" stroke="#f59e0b" strokeWidth="3.5" fill="none" />
          {[-34, -24, -14, 14, 24, 34].map((dx, idx) => (
            <ellipse
              key={idx}
              cx={50 + dx}
              cy={37 - Math.abs(dx) * 0.12}
              rx="6"
              ry="3.2"
              transform={`rotate(${dx < 0 ? 28 : -28} ${50 + dx} ${37 - Math.abs(dx) * 0.12})`}
              fill="#fde047"
              stroke="#b45309"
              strokeWidth="1.2"
            />
          ))}
          <circle cx="50" cy="43" r="4.5" fill="#ef4444" stroke="#fef08a" strokeWidth="1.5" />
          {/* the top 3 students also wear a graduation cap */}
          {rank < 3 && (
            <g>
              <polygon points="50,-8 96,10 50,26 4,10" fill="#1e1b4b" stroke="#fbbf24" strokeWidth="2.5" />
              <path d="M24 18 L24 32 Q50 40 76 32 L76 18" fill="#312e81" stroke="#fbbf24" strokeWidth="2" />
              <path d="M50 10 L84 18 L86 42" stroke="#fbbf24" strokeWidth="2.5" fill="none" />
              <circle cx="86" cy="44" r="3.5" fill="#fbbf24" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
