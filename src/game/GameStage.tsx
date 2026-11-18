import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState, StageView } from './useGame';
import { GAME, shownTeacherName } from './config';
import { thayHoa } from './teacher-swap';
import { Hair } from './Hair';
import { giftOf } from './quiz';
import './stage.css';
import { asset, roomBgSrc } from '../live/asset';

/**
 * Classroom screen, 1080x1920. The background is public/assets/bg/lop.webp (941x1672 scaled up to 1080 wide),
 * so every coordinate below = coordinate on the original image x K.
 */
const K = 1080 / 941;

// Long desks + benches drawn over the single desks of the background (measured on the original): top edge y, bottom edge b, ends x1..x2.
// n = students per row (owner's call 2026-11-04: 7–8 per row, students a bit smaller). The last row sits under the TikTok UI so it stays empty.
const ROWS = [
  { y: 812, b: 922, x1: 100, x2: 838, n: GAME.rowSeats[0], s: 0.92 },
  { y: 942, b: 1069, x1: 72, x2: 870, n: GAME.rowSeats[1], s: 0.98 },
  { y: 1093, b: 1232, x1: 45, x2: 902, n: GAME.rowSeats[2], s: 1.04 },
  { y: 1253, b: 1414, x1: 28, x2: 922, n: GAME.rowSeats[3], s: 1.1 },
  { y: 1458, b: 1646, x1: 5, x2: 938, n: 0, s: 1.16 },
];
const KID = 0.82; // students are smaller than in the single-desk version so they fit the long desks (2026-11-07 tried 45 seats at KID 0.7, then went back)
const SEAT_ROW: number[] = ROWS.flatMap((r, ri) => Array.from({ length: r.n }, () => ri));
const SPRITE_H = 250; // full body height
const SHOW = 0.5; // seated: only the upper body shows (head to hips)
// head box removed from the back-view body, as a fraction of the image (tools/remove-bg.py writes public/assets/nv/*/head.json)
const HEAD = { nam: { x: 0.136, y: 0, w: 0.682, h: 0.284 }, nu: { x: 0.174, y: 0, w: 0.668, h: 0.248 } };
// team colours: team 1 red, team 2 blue, team 3 green, team 4 yellow
const TEAM_COLOR = ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b'];
const TEAM_ICON = ['🔴', '🔵', '🟢', '🟡'];

const POSE = {
  nam: { dung: '01-dung', tay: '02-giong-tay', nghi: '03-suy-nghi', vui: '05-vui-mung', buon: '06-buon', ngac: '07-ngac-nhien', chao: '08-vay-chao' },
  nu: { dung: '01-dung', tay: '02-giong-tay', nghi: '03-suy-nghi', vui: '05-vui-mung', buon: '06-buon', ngac: '07-ngac-nhien', chao: '08-vay-chao' },
};
type PoseKey = keyof typeof POSE.nam;

// Ms. Ngan's outfits: the white set uses the original pose names; the shirt and jade ao dai sets have 16 poses with other names,
// so each pose maps to the closest one. The 2 big shows have their own outfit + poses (showPose).
const OUTFIT_POSE: Record<string, string> = {
  '01-dung': '01-dung',
  '02-gioi-thieu': '02-giang-bai',
  '03-chi-bang': '04-chi-phai', // the blackboard is to her right
  '04-vay-chao': '13-vay-chao',
  '05-dang-tay': '15-chao-don',
  '06-cuoi': '06-cuoi-che-mieng',
  '07-tay-nguc': '05-cuoi-tuoi',
  '08-ngon-cai': '08-like',
  '09-mung': '14-co-vu',
  '10-vo-tay': '07-vo-tay',
  '11-nhun-vai': '12-nhun-vai',
  '12-gai-dau': '11-suy-nghi',
  '13-ngac-nhien': '10-bat-ngo',
  '14-ngon-tro': '09-nghiem-nhe',
  '15-chong-hong': '16-tu-tin',
  '16-chi-trai': '03-chi-trai',
};
const EVEREST_POSES = [
  '01-dung-san-sang', '02-chi-len-dinh', '03-chi-lo-trinh', '04-chao-doan-leo', '05-doc-ban-do', '06-suy-nghi', '07-like', '08-co-vu',
  '09-bat-ngo', '10-cuoi-vui', '11-nhac-nho-an-toan', '12-vay-chao', '13-cam-co-dinh', '14-dong-vien', '15-vo-tay', '16-tu-tin',
];
const CHUONG_POSES = [
  '01-cam-chuong-san-sang', '02-rung-chuong-ben', '03-rung-chuong-cao', '04-rung-chuong-hai-tay', '05-rung-chuong-nghieng-nguoi',
  '06-rung-chuong-cuoi-tuoi', '07-rung-chuong-hao-hung', '08-rung-chuong-nghiem-tuc', '09-bao-hieu-bat-dau', '10-mung-chien-thang',
  '11-bat-ngo-nghe-chuong', '12-moi-thi-sinh', '13-vay-chao-cam-chuong', '14-tu-hao-gio-chuong', '15-chuan-bi-rung', '16-nghi-thang-tran',
];

// preload every pose so switching poses never flashes white
const ALL_IMGS = [
  ...Object.values(POSE.nam).map((p) => asset(`/assets/nv/nam/${p}.webp`)),
  ...Object.values(POSE.nu).map((p) => asset(`/assets/nv/nu/${p}.webp`)),
  ...[
    '01-dung', '02-gioi-thieu', '03-chi-bang', '04-vay-chao', '05-dang-tay', '06-cuoi', '07-tay-nguc', '08-ngon-cai',
    '09-mung', '10-vo-tay', '11-nhun-vai', '12-gai-dau', '13-ngac-nhien', '14-ngon-tro', '15-chong-hong', '16-chi-trai',
  ].map((p) => asset(`/assets/nv/co-ngan/${p}.webp`)),
  ...['so-mi', 'ao-dai-xanh-ngoc'].flatMap((o) => Object.values(OUTFIT_POSE).map((p) => asset(`/assets/nv/co-ngan/${o}/${p}.webp`))),
  ...EVEREST_POSES.map((p) => asset(`/assets/nv/co-ngan/everest/${p}.webp`)),
  ...CHUONG_POSES.map((p) => asset(`/assets/nv/co-ngan/chuong/${p}.webp`)),
];

// A male teacher is teaching (class settings): on-screen text says "Mr." instead of "Ms.". GameStage sets this flag on every render, before the child panels
let THAY = false;
const X = (s: string) => (THAY ? thayHoa(s) : s);

// Male teacher (2026-11-07): 8 poses, art in characters/thay-giao, background removed into public/assets/nv/thay (tools/remove-bg.mjs).
// Ms. Ngan's 16 poses map to the closest male-teacher pose. The board is to his right, so pointing at the board = pointing right.
const THAY_POSE: Record<string, string> = {
  '01-dung': '01-dung',
  '02-gioi-thieu': '02-giang-bai',
  '03-chi-bang': '04-chi-phai',
  '04-vay-chao': '08-vay-chao',
  '05-dang-tay': '02-giang-bai',
  '06-cuoi': '05-vui-mung',
  '07-tay-nguc': '05-vui-mung',
  '08-ngon-cai': '05-vui-mung',
  '09-mung': '05-vui-mung',
  '10-vo-tay': '05-vui-mung',
  '11-nhun-vai': '06-buon',
  '12-gai-dau': '07-suy-nghi',
  '13-ngac-nhien': '07-suy-nghi',
  '14-ngon-tro': '02-giang-bai',
  '15-chong-hong': '01-dung',
  '16-chi-trai': '03-chi-trai',
};
const THAY_IMGS = [...new Set(Object.values(THAY_POSE))].map((p) => asset(`/assets/nv/thay/${p}.webp`));
/** The 2 big shows with the male teacher: he only has one outfit, the pose follows the step */
function thayShowPose(v: StageView, now: number): string {
  const sh = v.show!;
  const alt = now % 6000 < 3000;
  if (now - v.lastFlowerAt < 3000 || v.walk || v.clapping) return '05-vui-mung';
  if (sh.step === 'gather') return '08-vay-chao';
  if (sh.step === 'honor') return '05-vui-mung';
  if (sh.stage === 'reveal' || sh.step === 'codeReveal') return sh.lastRight > 0 || sh.code?.solved ? '05-vui-mung' : '06-buon';
  if (!(sh.stage === 'ask' && v.boardShown)) return '02-giang-bai';
  return alt ? '04-chi-phai' : '07-suy-nghi';
}

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function GameStage({ game }: { game: GameState }) {
  const now = useNow();
  const v = game.view;
  THAY = v?.cfg.teacher === 'thay';
  useEffect(() => {
    for (const src of [...(THAY ? THAY_IMGS : ALL_IMGS), ...GIAM_THI_IMGS]) new Image().src = src;
  }, [THAY]);
  if (!v) {
    return (
      <div className="flex h-full items-center justify-center bg-black/60 p-20 text-center text-[48px] text-white">
        Opening the classroom…
      </div>
    );
  }
  return (
    <div className={`relative h-full w-full overflow-hidden ${v.clapping ? 'class-clap' : ''}`}>
      {/* custom background uploaded on the control page covers the default one; it has no blackboard, so the game draws one in the right place */}
      {v.cfg.bg && <img src={roomBgSrc(v.cfg.bg)} className="absolute inset-0 h-full w-full object-cover" />}
      {v.cfg.bg && <div className="absolute left-[332px] top-[244px] h-[384px] w-[592px] rounded-[10px] border-[12px] border-[#7a4a1d] bg-[#1d4a38] shadow-[0_8px_14px_rgba(0,0,0,0.4)]" />}
      {/* flowers: only the student walking up to give them (FlowerWalk); no zoom, no close-up frame (owner removed them 2026-11-04).
          Keep motion.div as before (scale always 1): a plain div makes the picture on the live look different */}
      <motion.div className="absolute inset-0" style={{ transformOrigin: '330px 700px' }} animate={{ scale: 1 }}>
        {/* the classroom floor in the background is a bit bright: a light dark layer from the foot of the board down (owner's tweak 2026-11-04) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[600px] bg-gradient-to-b from-[#3b1d07]/0 via-[#3b1d07]/20 to-[#3b1d07]/28 mix-blend-multiply" />
        <StageBackdrop v={v} />
        <Header v={v} name={game.channelName} />
        <EventBadge v={v} />
        <Motto text={v.cfg.motto} />
        <Board v={v} now={now} />
        <DayTop v={v} />
        <TeamBoard v={v} />
        <TalkTop v={v} />
        <GiftPile v={v} />
        <ClassFund v={v} />
        <GiftMenu />
        <Vase v={v} />
        <Teacher v={v} now={now} />
        <Punished v={v} />
        <Podium v={v} />
        {v.phase !== 'show' && <SeatHint now={now} asking={v.phase === 'question' || v.phase === 'bonus'} />}
        <Students v={v} now={now} />
        <FlowerWalk v={v} />
        <Dancers v={v} />
        <Escort v={v} />
      </motion.div>
      <DanceBanner v={v} />
      <GiftBanner gift={game.lastGift} now={now} />
      <BirthdayBanner v={v} />
      <GoodbyeBanner v={v} now={now} />
      <FundParty v={v} />
      <LoveHearts n={v.loveFans} />
      <PollCard v={v} />
      {(v.clapping || v.fund.party > 0) && <Claps />}
    </div>
  );
}

// Gifts the teacher got this session: lined up at the classroom door on the left (behind her), bigger bunches get bigger icons, stacking up
const PILE_PER_ROW = 5;
function GiftPile({ v }: { v: StageView }) {
  const pile = v.gifts;
  return (
    <div className="pointer-events-none absolute left-[2px] top-[640px] z-[1] h-[230px] w-[150px]">
      {pile.map(({ tier, icon }, i) => {
        const t = GAME.giftTiers[tier];
        const size = 26 * t.size;
        const row = Math.floor(i / PILE_PER_ROW);
        const col = i % PILE_PER_ROW;
        return (
          <motion.div
            key={i}
            initial={i === pile.length - 1 ? { scale: 0, x: 220, y: -40 } : false}
            animate={{ scale: 1, x: 0, y: 0 }}
            transition={{ delay: i === pile.length - 1 ? (GAME.walkMs * 0.65) / 1000 : 0, type: 'spring', stiffness: 140, damping: 14 }}
            className="absolute leading-none drop-shadow-[0_3px_2px_rgba(0,0,0,0.35)]"
            style={{ fontSize: size, left: 6 + col * 26 + (row % 2) * 12 - size / 4, top: 210 - size - row * 24 }}
          >
            {icon}
          </motion.div>
        );
      })}
    </div>
  );
}

// "For Teacher" board between the Class fund and Top chatters (owner 2026-11-05): written as a gift list, no pushing,
// no promise of points or advantages (TikTok forbids encouraging gifts). Items and captions are in GAME.giftMenu
function GiftMenu() {
  return (
    // narrow column to the right of the board (like the Class fund), one item per line: never covers the question
    <div className="absolute right-[8px] top-[484px] z-[8] w-[168px] rotate-1 rounded-[14px] border-[3px] border-[#c9a45c] bg-[#fff8e1]/95 px-2 pb-1 pt-[2px] text-[#4a2c0e] shadow-[0_6px_10px_rgba(0,0,0,0.3)]">
      <div className="whitespace-nowrap text-center text-[16px] font-extrabold leading-tight text-[#be185d]">{X('🎁 For Teacher 💕')}</div>
      {GAME.giftMenu.map((g) => (
        <div key={g.label} className="flex items-center gap-[2px] whitespace-nowrap text-[15px] font-semibold leading-[24px]">
          <span className="w-6 text-center text-[19px]">{g.icon}</span>
          {X(g.caption)}
        </div>
      ))}
    </div>
  );
}

// Class fund: right column, between Team race and Top chatters. Every gift coin = one flower in the fund, with daily milestones
function ClassFund({ v }: { v: StageView }) {
  const f = v.fund;
  return (
    // only "Class fund" + the flower count (owner removed the goal 2026-11-05), in the narrow column right of the board, never over the question
    <div className="absolute right-[8px] top-[428px] z-20 flex w-[168px] -rotate-1 items-baseline justify-between rounded-[14px] border-[3px] border-[#c9a45c] bg-[#fff8e1]/95 px-2 pb-1 pt-2 text-[#be185d] shadow-[0_6px_10px_rgba(0,0,0,0.3)]">
      <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 text-[28px]">📌</div>
      <span className="whitespace-nowrap text-[17px] font-extrabold leading-tight">💝 Class fund</span>
      <span className="text-[28px] font-extrabold leading-tight">{f.today}</span>
    </div>
  );
}

// Flower fund milestone: banner + fireworks (applause) for 8 seconds
function FundParty({ v }: { v: StageView }) {
  return (
    <AnimatePresence>
      {v.fund.party > 0 && (
        <motion.div
          key={v.fund.party}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute left-1/2 top-[650px] z-[70] w-[880px] -translate-x-1/2 rounded-[30px] border-4 border-white bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 px-6 py-4 text-center font-extrabold text-white shadow-2xl"
        >
          <div className="text-[44px] leading-tight">🎆 Class fund hit {v.fund.party} flowers! 🎆</div>
          <div className="text-[30px]">{X('Thank you so much, class 💕')}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Current term (0: Term 1 [Q1-5], 1: Term 2 [Q6-10], 2: Term 3 [Q11-15], 3: Term 4 Finals [Q16-20])
function stageIdxOf(v: StageView): 0 | 1 | 2 | 3 {
  if (v.qNo >= 16) return 3;
  if (v.qNo >= 11) return 2;
  if (v.qNo >= 6) return 1;
  return 0;
}

const STAGE_THEMES = [
  {
    badge: '🌱 TERM 1 · WARM-UP',
    roomFilter: '',
    floorOverlay: 'linear-gradient(180deg, rgba(59, 29, 7, 0) 0%, rgba(59, 29, 7, 0.18) 55%, rgba(59, 29, 7, 0.28) 100%)',
    boardBg: 'radial-gradient(ellipse at 50% 42%, #245c44 0%, #194432 70%, #133627 100%)',
    boardFrameBg: 'linear-gradient(180deg, #a66b32 0%, #7a4a1d 50%, #5c3512 100%)',
    boardFrameBorder: '#47270b',
    boardInnerStroke: '#d4a359',
    boardGlow: 'rgba(16, 185, 129, 0.12)',
    headerBg: 'bg-[#f6e3b4] border-[#7a4a1d] shadow-[0_8px_0_#5b3512]',
    headerTitle: 'text-[#7a2e0e]',
    headerSub: 'text-[#6b4a22]',
    podiumHeader: 'bg-[#7a2e0e] text-[#ffe9b8]',
    podiumBody: 'bg-[#fff6dd]/95 border border-[#c9a45c]',
    hintPill: 'bg-[#7a2e0e]/85 text-[#ffe9b8]',
    nametagBorder: 'border-[2px] border-[#16a34a]/70 bg-white/95',
    ambient: '',
    thayFilter: '',
    thayBadge: 'from-[#3b82f6] to-[#1d4ed8] shadow-[0_3px_0_#1e3a8a]',
    thayIcon: '📘',
  },
  {
    badge: '⚡ TERM 2 · SPEED UP',
    roomFilter: 'hue-rotate(-14deg) saturate(1.12) brightness(1.02)',
    floorOverlay: 'linear-gradient(180deg, rgba(12, 74, 110, 0) 0%, rgba(12, 74, 110, 0.20) 55%, rgba(7, 45, 72, 0.34) 100%)',
    boardBg: 'radial-gradient(ellipse at 50% 40%, #134e7a 0%, #0c3559 68%, #08243f 100%)',
    boardFrameBg: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 50%, #475569 100%)',
    boardFrameBorder: '#1e293b',
    boardInnerStroke: '#38bdf8',
    boardGlow: 'rgba(56, 189, 248, 0.28)',
    headerBg: 'bg-[#e0f2fe] border-[#0369a1] shadow-[0_8px_0_#075985]',
    headerTitle: 'text-[#0c4a6e]',
    headerSub: 'text-[#0369a1]',
    podiumHeader: 'bg-[#0369a1] text-[#e0f2fe]',
    podiumBody: 'bg-[#f0f9ff]/95 border border-[#38bdf8]',
    hintPill: 'bg-[#075985]/88 text-[#e0f2fe]',
    nametagBorder: 'border-[2px] border-[#0284c7] bg-[#f8fafc]/95',
    ambient: 'radial-gradient(circle at 58% 28%, rgba(56, 189, 248, 0.16), transparent 68%)',
    thayFilter: 'hue-rotate(-32deg) saturate(1.25)',
    thayBadge: 'from-[#06b6d4] to-[#0e7490] shadow-[0_3px_0_#155e75]',
    thayIcon: '⚡',
  },
  {
    badge: '🔥 TERM 3 · LEVEL UP',
    roomFilter: 'hue-rotate(12deg) saturate(1.18) contrast(1.04)',
    floorOverlay: 'linear-gradient(180deg, rgba(76, 17, 48, 0) 0%, rgba(88, 28, 135, 0.22) 50%, rgba(59, 7, 100, 0.38) 100%)',
    boardBg: 'radial-gradient(ellipse at 50% 40%, #581c68 0%, #3b1048 70%, #260830 100%)',
    boardFrameBg: 'linear-gradient(180deg, #991b1b 0%, #7f1d1d 55%, #450a0a 100%)',
    boardFrameBorder: '#fbbf24',
    boardInnerStroke: '#f472b6',
    boardGlow: 'rgba(232, 121, 249, 0.30)',
    headerBg: 'bg-[#fae8ff] border-[#7e22ce] shadow-[0_8px_0_#581c87]',
    headerTitle: 'text-[#581c87]',
    headerSub: 'text-[#7e22ce]',
    podiumHeader: 'bg-[#6b21a8] text-[#fae8ff]',
    podiumBody: 'bg-[#fdf4ff]/95 border border-[#d946ef]',
    hintPill: 'bg-[#581c87]/88 text-[#fae8ff]',
    nametagBorder: 'border-[2px] border-[#9333ea] bg-[#fdf4ff]/95',
    ambient: 'radial-gradient(circle at 58% 28%, rgba(217, 70, 239, 0.18), transparent 68%)',
    thayFilter: 'hue-rotate(48deg) saturate(1.3)',
    thayBadge: 'from-[#a855f7] to-[#6b21a8] shadow-[0_3px_0_#4c1d95]',
    thayIcon: '🔥',
  },
  {
    badge: '👑 TERM 4 · FINALS',
    roomFilter: 'saturate(1.25) contrast(1.06) brightness(1.02)',
    floorOverlay: 'linear-gradient(180deg, rgba(127, 29, 29, 0.05) 0%, rgba(127, 29, 29, 0.28) 50%, rgba(69, 10, 10, 0.44) 100%)',
    boardBg: 'radial-gradient(ellipse at 50% 40%, #7f1d1d 0%, #551111 68%, #380808 100%)',
    boardFrameBg: 'linear-gradient(180deg, #fde047 0%, #f59e0b 48%, #b45309 100%)',
    boardFrameBorder: '#78350f',
    boardInnerStroke: '#fef08a',
    boardGlow: 'rgba(251, 191, 36, 0.42)',
    headerBg: 'bg-gradient-to-b from-[#fef08a] to-[#fde047] border-[#b45309] shadow-[0_8px_0_#78350f]',
    headerTitle: 'text-[#7c2d12]',
    headerSub: 'text-[#92400e]',
    podiumHeader: 'bg-gradient-to-r from-[#991b1b] via-[#b91c1c] to-[#991b1b] text-[#fef08a]',
    podiumBody: 'bg-[#fffbeb]/95 border-2 border-[#f59e0b]',
    hintPill: 'bg-[#7c2d12]/90 text-[#fef08a] border border-[#fbbf24]/60',
    nametagBorder: 'border-[2px] border-[#f59e0b] bg-[#fffbeb]/95 shadow-[0_0_8px_rgba(251,191,36,0.45)]',
    ambient: 'radial-gradient(circle at 55% 30%, rgba(251, 191, 36, 0.26), transparent 72%)',
    thayFilter: 'hue-rotate(140deg) saturate(1.35) brightness(1.04)',
    thayBadge: 'from-[#f59e0b] to-[#b45309] shadow-[0_3px_0_#78350f]',
    thayIcon: '👑',
  },
] as const;

function StageBackdrop({ v }: { v: StageView }) {
  if (v.phase === 'show' || v.phase === 'recess') return null;
  const idx = stageIdxOf(v);
  const t = STAGE_THEMES[idx];
  return (
    <>
      {/* 1. Classroom colours and light change with each term (unless a custom background is used) */}
      {!v.cfg.bg && idx > 0 && (
        <img
          src={asset('/assets/bg/lop.webp')}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-all duration-700"
          style={{ filter: t.roomFilter }}
        />
      )}
      {/* Floor tint and ambient light of each term */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[600px] transition-all duration-700" style={{ background: t.floorOverlay }} />
      {t.ambient && <div className="pointer-events-none absolute inset-0 transition-all duration-700" style={{ background: t.ambient }} />}

      {/* 2. Decorations for each term (bunting in Term 2, velvet curtains & hall carpet in Term 3, spotlights & royal curtains in Term 4) */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1080 1920">
        {idx === 1 && (
          <g opacity="0.9">
            {/* Colourful triangle bunting across the ceiling in Term 2 */}
            <path d="M 0,68 Q 270,130 540,78 Q 810,130 1080,68" stroke="#0284c7" strokeWidth="3" fill="none" />
            {[40, 110, 180, 250, 320, 760, 830, 900, 970, 1035].map((cx, i) => {
              const colors = ['#38bdf8', '#facc15', '#4ade80', '#f472b6', '#fb923c'];
              const cy = cx < 540 ? 74 + Math.sin((cx / 540) * Math.PI) * 32 : 74 + Math.sin(((cx - 540) / 540) * Math.PI) * 32;
              return <polygon key={i} points={`${cx - 22},${cy} ${cx + 22},${cy} ${cx},${cy + 42}`} fill={colors[i % colors.length]} stroke="#fff" strokeWidth="2" />;
            })}
          </g>
        )}

        {idx === 2 && (
          <g>
            {/* Purple-red silk carpet down the aisle of the Term 3 hall */}
            <polygon points="360,760 720,760 920,1920 160,1920" fill="url(#hallCarpet2)" opacity="0.26" />
            <defs>
              <linearGradient id="hallCarpet2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9333ea" />
                <stop offset="100%" stopColor="#4c1d95" />
              </linearGradient>
            </defs>
            {/* Velvet hall curtains on both side walls (Term 3) */}
            <path d="M 0,0 L 95,0 Q 75,320 52,620 L 0,660 Z" fill="#6b21a8" opacity="0.78" />
            <path d="M 0,0 L 65,0 Q 50,300 32,600 L 0,630 Z" fill="#9333ea" opacity="0.65" />
            <path d="M 1080,0 L 985,0 Q 1005,320 1028,620 L 1080,660 Z" fill="#6b21a8" opacity="0.78" />
            <path d="M 1080,0 L 1015,0 Q 1030,300 1048,600 L 1080,630 Z" fill="#9333ea" opacity="0.65" />
            {/* Gold fringe along the ceiling */}
            <path d="M 0,0 Q 140,70 280,0 M 800,0 Q 940,70 1080,0" fill="#581c87" stroke="#fbbf24" strokeWidth="5" opacity="0.85" />
          </g>
        )}

        {idx === 3 && (
          <g>
            <defs>
              <linearGradient id="spotBeam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.38" />
                <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="royalCarpet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
            </defs>
            {/* 3 spotlights of the finals arena shining down on the board & teacher's stand */}
            <polygon points="220,0 310,0 520,760 90,760" fill="url(#spotBeam)" />
            <polygon points="500,0 590,0 790,760 320,760" fill="url(#spotBeam)" />
            <polygon points="780,0 870,0 1040,760 580,760" fill="url(#spotBeam)" />
            {/* Royal red carpet with gold trim */}
            <polygon points="330,755 750,755 960,1920 120,1920" fill="url(#royalCarpet)" opacity="0.34" />
            <line x1="330" y1="755" x2="120" y2="1920" stroke="#fbbf24" strokeWidth="4" opacity="0.45" />
            <line x1="750" y1="755" x2="960" y2="1920" stroke="#fbbf24" strokeWidth="4" opacity="0.45" />
            {/* Royal red velvet curtains with gold trim on both sides */}
            <path d="M 0,0 L 118,0 Q 92,340 64,680 L 0,720 Z" fill="#991b1b" stroke="#fbbf24" strokeWidth="4" opacity="0.9" />
            <path d="M 0,0 L 76,0 Q 58,320 36,640 L 0,680 Z" fill="#dc2626" opacity="0.75" />
            <path d="M 1080,0 L 962,0 Q 988,340 1016,680 L 1080,720 Z" fill="#991b1b" stroke="#fbbf24" strokeWidth="4" opacity="0.9" />
            <path d="M 1080,0 L 1004,0 Q 1022,320 1044,640 L 1080,680 Z" fill="#dc2626" opacity="0.75" />
            {/* Gold-red velvet valance across the top of the stage */}
            <path d="M 0,0 Q 135,88 270,0 Q 405,64 540,0 Q 675,64 810,0 Q 945,88 1080,0 Z" fill="#991b1b" stroke="#fde047" strokeWidth="5" opacity="0.92" />
          </g>
        )}
      </svg>

      {/* 3. Board frame & board surface change with the 4 terms (keeps the exact pixels left:332 top:244 w:592 h:384) */}
      <div
        className="pointer-events-none absolute left-[332px] top-[244px] h-[384px] w-[592px] rounded-[12px] transition-all duration-700"
        style={{
          background: t.boardFrameBg,
          border: `4px solid ${t.boardFrameBorder}`,
          boxShadow: `0 10px 24px rgba(0,0,0,0.45), 0 0 28px ${t.boardGlow}`,
        }}
      >
        {/* Board surface (where the chalk text shows at left:350 top:262 w:555 h:348) */}
        <div
          className="absolute inset-[10px] rounded-[7px] transition-all duration-700"
          style={{
            background: t.boardBg,
            border: `2.5px solid ${t.boardInnerStroke}`,
            boxShadow: 'inset 0 0 32px rgba(0,0,0,0.48)',
          }}
        />

        {/* Corner decorations & chalk tray for each term */}
        {idx === 0 && (
          <>
            {/* Classic wooden tray with white/yellow/pink chalk (Term 1) */}
            <div className="absolute -bottom-[10px] left-[28px] right-[28px] h-[12px] rounded-b-[6px] border-2 border-[#47270b] bg-[#8c5320] shadow-md" />
            <div className="absolute bottom-[2px] left-[120px] h-[6px] w-[26px] rounded-full bg-white shadow-sm" />
            <div className="absolute bottom-[2px] left-[154px] h-[6px] w-[22px] rounded-full bg-[#fde047] shadow-sm" />
            <div className="absolute bottom-[2px] left-[290px] h-[10px] w-[42px] rounded-[3px] border border-[#47270b] bg-[#d97706]" />
          </>
        )}

        {idx === 1 && (
          <>
            {/* 4 blue metal corner guards & magnetic marker tray (Term 2) */}
            <div className="absolute -left-[3px] -top-[3px] h-[22px] w-[22px] rounded-tl-[10px] border-l-4 border-t-4 border-[#0284c7]" />
            <div className="absolute -right-[3px] -top-[3px] h-[22px] w-[22px] rounded-tr-[10px] border-r-4 border-t-4 border-[#0284c7]" />
            <div className="absolute -bottom-[3px] -left-[3px] h-[22px] w-[22px] rounded-bl-[10px] border-b-4 border-l-4 border-[#0284c7]" />
            <div className="absolute -bottom-[3px] -right-[3px] h-[22px] w-[22px] rounded-br-[10px] border-b-4 border-r-4 border-[#0284c7]" />
            <div className="absolute -bottom-[9px] left-[40px] right-[40px] h-[10px] rounded-b-[5px] border border-[#334155] bg-gradient-to-r from-[#cbd5e1] via-[#f8fafc] to-[#cbd5e1]" />
            {/* Round magnets on the corners of the whiteboard */}
            <div className="absolute left-[22px] top-[20px] h-[14px] w-[14px] rounded-full border-2 border-white bg-[#ef4444] shadow" />
            <div className="absolute right-[22px] top-[20px] h-[14px] w-[14px] rounded-full border-2 border-white bg-[#38bdf8] shadow" />
          </>
        )}

        {idx === 2 && (
          <>
            {/* Gold-plated brass ornaments on the 4 corners (Term 3 hall) */}
            <div className="absolute left-[4px] top-[4px] h-[20px] w-[20px] border-l-[4px] border-t-[4px] border-[#fde047]" />
            <div className="absolute right-[4px] top-[4px] h-[20px] w-[20px] border-r-[4px] border-t-[4px] border-[#fde047]" />
            <div className="absolute bottom-[4px] left-[4px] h-[20px] w-[20px] border-b-[4px] border-l-[4px] border-[#fde047]" />
            <div className="absolute bottom-[4px] right-[4px] h-[20px] w-[20px] border-b-[4px] border-r-[4px] border-[#fde047]" />
            <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 rounded-full border-2 border-[#fde047] bg-[#581c87] px-4 py-[1px] text-[13px] font-black tracking-widest text-[#fde047] shadow">
              ★ HIGH SCHOOL HONOR BOARD ★
            </div>
          </>
        )}

        {idx === 3 && (
          <>
            {/* Crown of Glory relief above the board of the finals arena */}
            <div className="absolute -top-[18px] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border-[3px] border-[#fde047] bg-gradient-to-r from-[#7f1d1d] via-[#b91c1c] to-[#7f1d1d] px-5 py-[2px] text-[14px] font-black tracking-wider text-[#fef08a] shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              <span>👑</span>
              <span>GRADUATION ARENA</span>
              <span>👑</span>
            </div>
            <div className="absolute left-[4px] top-[4px] h-[24px] w-[24px] rounded-tl-[6px] border-l-[5px] border-t-[5px] border-[#7f1d1d]" />
            <div className="absolute right-[4px] top-[4px] h-[24px] w-[24px] rounded-tr-[6px] border-r-[5px] border-t-[5px] border-[#7f1d1d]" />
            <div className="absolute bottom-[4px] left-[4px] h-[24px] w-[24px] rounded-bl-[6px] border-b-[5px] border-l-[5px] border-[#7f1d1d]" />
            <div className="absolute bottom-[4px] right-[4px] h-[24px] w-[24px] rounded-br-[6px] border-b-[5px] border-r-[5px] border-[#7f1d1d]" />
          </>
        )}
      </div>
    </>
  );
}

function Header({ v, name }: { v: StageView; name: string }) {
  const idx = stageIdxOf(v);
  const t = STAGE_THEMES[idx];
  const sub =
    v.phase === 'team'
      ? `Pick a team · Class ${v.round}`
      : v.phase === 'show' && v.show
      ? v.show.kind === 'everest' ? '🏔️ Road to Everest' : '🔔 Golden Bell'
      : v.phase === 'recess'
      ? 'Recess'
      : v.phase === 'vote'
        ? 'Vote: next topic'
        : v.qNo > 0 && v.phase !== 'results'
          ? `${t.badge} · Q${v.qNo}/${v.total}`
          : `Class ${v.round}`;
  return (
    <div className={`absolute left-1/2 top-[14px] flex w-[520px] -translate-x-1/2 flex-col items-center rounded-[28px] border-[5px] px-6 py-3 transition-colors duration-500 ${t.headerBg}`}>
      <div className={`max-w-full truncate font-extrabold leading-none tracking-wide ${t.headerTitle}`} style={{ fontSize: name.length > 14 ? 34 : 46 }}>
        {name.toUpperCase()}
      </div>
      {/* students in class / students waiting for a seat (the old head-count board at the left door is now the teacher's gift table) */}
      <div className={`mt-1 whitespace-nowrap text-[22px] font-bold ${t.headerSub}`}>
        {sub} · 👥 {v.roster.seated}/{v.roster.seats}
        {v.roster.waiting > 0 && ` · ⏳ ${v.roster.waiting} waiting`}
      </div>
    </div>
  );
}

// ---------- Blackboard ----------
function Board({ v, now }: { v: StageView; now: number }) {
  // The engine moves endsAt forward while the teacher reads (clock on hold). The screen clock (useNow) can be
  // up to 250 ms older than the snapshot, which used to show 21 for a moment: 20, 21, 20, 21. Never count from
  // a time earlier than the snapshot.
  const left = Math.max(0, Math.ceil((v.endsAt - Math.max(now, v.at ?? 0)) / 1000));
  return (
    <div className={`chalk absolute left-[350px] top-[262px] h-[348px] w-[555px] text-[#f4f1e6] ${v.golden && v.phase !== 'recess' ? 'golden-board' : ''}`}>
      {v.phase === 'intro' && v.round % 2 === 0 && v.weekTop.length > 0 && <WeekBoard v={v} left={left} />}
      {v.phase === 'intro' && !(v.round % 2 === 0 && v.weekTop.length > 0) && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="text-[64px] leading-none">Class starts soon!</div>
          <div className="mt-6 text-[36px] leading-snug">
            {X('I scramble the letters, you guess the word.')}
            <br />
            Type your answer in the <b className="text-[#ffe680]">comments</b>
            <br />
            Fastest gets <b className="text-[#ffe680]">+10 points</b>
          </div>
          {v.topic && <div className="mt-3 text-[32px] text-[#ffe680]">🗳️ Class topic: {v.topic}</div>}
          {v.review && <div className="mt-3 text-[32px] text-[#ffe680]">📖 Review time · type "join class" for new questions</div>}
          <div className="mt-4 text-[30px] opacity-80">Starting in {left} seconds</div>
        </div>
      )}

      {(v.phase === 'question' || v.phase === 'bonus' || v.phase === 'reveal') && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            {v.golden ? (
              <span className="rounded-full bg-[#ffd84a] px-4 text-[28px] font-bold text-[#7a2e0e]">⭐ GOLDEN QUESTION x2</span>
            ) : !v.slot && !v.boardShown ? (
              // ordinary word question being read: hide the topic label (it is a clue too), only show "Question N"
              <span />
            ) : (
              <span className={`rounded-full border-2 px-4 text-[26px] ${v.slot ? 'border-[#ffe680] text-[#ffe680]' : 'border-[#f4f1e6]/60'}`}>
                {v.slot === 'meo'
                  ? `🤪 Riddle ${v.riddleNo}/2`
                  : v.slot === 'su'
                    ? '📜 History'
                    : v.slot === 'anh'
                      ? '🔤 Spelling'
                      : v.slot === 'dh'
                        ? '🖼️ Emoji puzzle'
                        : v.category}
              </span>
            )}
            {v.phase !== 'reveal' ? <Timer left={left} /> : <span className="text-[34px] text-[#9df29d]">Answer</span>}
          </div>
          {!v.boardShown ? (
            v.riddleNo === 1 ? (
              // start of the riddle segment: the teacher is introducing it, the board warns the class to get ready
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 160, damping: 13 }}
                className="flex flex-1 flex-col items-center justify-center text-center"
              >
                <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-[90px] leading-none">
                  🤪
                </motion.div>
                <div className="mt-2 text-[58px] font-bold leading-none text-[#ffe680]">RIDDLE TIME</div>
                <div className="mt-3 text-[36px]">2 in a row · points count</div>
                <div className="mt-2 text-[32px] opacity-90">Get ready: think sideways to win!</div>
              </motion.div>
            ) : (
            // the teacher is reading the question: no shuffled letters / sum yet, they appear when she says go
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {/* while she reads: only "Question N", NO clue (owner 2026-11-05: showing the clue lets fast readers guess early, which is unfair).
                  After reading, the clue + shuffled letters + answer boxes appear together */}
              <div className="text-[72px] font-bold leading-none text-[#ffe680]">Question {v.qNo}</div>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="mt-6 text-[40px] text-[#ffe680]"
              >
                {X('👂 Listen to the question…')}
              </motion.div>
            </div>
            )
          ) : v.slot === 'dh' ? (
            // emoji puzzle: big emoji picture, answer boxes below
            <motion.div
              key={v.clue}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 160, damping: 14 }}
              className={`mt-3 shrink-0 whitespace-nowrap text-center text-[84px] leading-[110px] ${v.phase === 'reveal' ? 'opacity-60' : ''}`}
            >
              {v.clue}
            </motion.div>
          ) : v.math ? (
            // math question: the sum in big chalk letters, viewers type the number
            <motion.div
              key={v.math}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`mt-4 shrink-0 text-center text-[76px] font-extrabold leading-[96px] text-[#ffe680] ${v.phase === 'reveal' ? 'opacity-50' : ''}`}
            >
              {v.math}
            </motion.div>
          ) : (
            <>
              <div className="mt-2 line-clamp-2 min-h-[96px] shrink-0 text-center text-[38px] leading-[48px]">{v.clue}</div>
              <Tiles letters={v.tiles} dim={v.phase === 'reveal'} />
            </>
          )}
          {v.boardShown && <Slots slots={v.slots} reveal={v.phase === 'reveal'} />}
          {v.boardShown && v.math && v.phase !== 'reveal' && <div className="mt-2 text-center text-[28px] opacity-80">Type the number in the comments</div>}
          {v.phase === 'bonus' && (
            <div className="mt-auto text-center text-[28px] text-[#ffe680]">{v.math ? '10 more seconds, think fast!' : X('One more letter, 10 more seconds!')}</div>
          )}
        </div>
      )}

      {v.phase === 'team' && <TeamPick v={v} left={left} />}
      {v.phase === 'show' && v.show && <ShowBoard v={v} left={left} />}
      {v.phase === 'praise' && <Praise v={v} />}
      {v.phase === 'vote' && v.vote && <Vote v={v} left={left} />}
      {v.phase === 'results' && <Results v={v} />}
      {v.phase === 'recess' && v.recess && <Recess v={v} left={left} />}
    </div>
  );
}

function Timer({ left }: { left: number }) {
  const urgent = left <= 5;
  return (
    <motion.div
      key={urgent ? left : 'calm'}
      initial={urgent ? { scale: 1.35 } : false}
      animate={{ scale: 1 }}
      className={`flex h-[78px] min-w-[78px] items-center justify-center rounded-full border-[5px] px-2 text-[50px] font-bold leading-none ${urgent ? 'border-[#ff8a7a] bg-[#ff8a7a]/20 text-[#ff8a7a]' : 'border-[#f4f1e6]'}`}
    >
      {left}
    </motion.div>
  );
}

function Tiles({ letters, dim }: { letters: string[]; dim: boolean }) {
  const n = letters.length || 1;
  const size = Math.min(76, Math.floor((555 - 8 * (n - 1)) / n));
  return (
    <div className={`mt-3 flex justify-center gap-2 ${dim ? 'opacity-40' : ''}`}>
      {letters.map((ch, i) => (
        <motion.div
          key={`${i}${ch}`}
          initial={{ y: -30, opacity: 0, rotate: -8 }}
          animate={{ y: 0, opacity: 1, rotate: ((i * 37) % 9) - 4 }}
          transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 18 }}
          className="tile flex items-center justify-center font-extrabold"
          style={{ width: size, height: size * 1.1, fontSize: size * 0.62 }}
        >
          {ch}
        </motion.div>
      ))}
    </div>
  );
}

function Slots({ slots, reveal }: { slots: (string | null)[]; reveal: boolean }) {
  const n = slots.length || 1;
  const size = Math.min(56, Math.floor((555 - 6 * (n - 1)) / n));
  return (
    <div className="mt-4 flex justify-center gap-[6px]">
      {slots.map((ch, i) =>
        ch === ' ' ? (
          <div key={i} style={{ width: size * 0.5 }} />
        ) : (
          <div
            key={i}
            className={`flex items-end justify-center border-b-4 ${reveal ? 'border-[#9df29d] text-[#9df29d]' : 'border-[#f4f1e6]'}`}
            style={{ width: size, height: size, fontSize: size * 0.8, lineHeight: 1 }}
          >
            {ch ?? ''}
          </div>
        ),
      )}
    </div>
  );
}

// The class picks the next class's topic: type 1 or 2
function Vote({ v, left }: { v: StageView; left: number }) {
  const r = v.vote!;
  const total = r.counts[0] + r.counts[1] || 1;
  return (
    <div className="flex h-full flex-col items-center text-center">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-[#ffd84a] px-4 text-[26px] font-bold text-[#7a2e0e]">🗳️ The class decides</span>
        <Timer left={left} />
      </div>
      <div className="mt-1 text-[44px] leading-tight text-[#ffe680]">What should we study next?</div>
      <div className="mt-3 w-full space-y-4 px-4">
        {r.topics.map((label, i) => {
          const pct = Math.round((r.counts[i] / total) * 100);
          return (
            <div key={label} className="relative h-[76px] overflow-hidden rounded-2xl border-2 border-white/40 text-left">
              <div className="absolute inset-y-0 left-0 bg-[#ffd84a]/35 transition-all duration-500" style={{ width: `${pct}%` }} />
              <div className="relative flex h-full items-center justify-between gap-3 px-4 text-[32px]">
                <span className="truncate">
                  Type <b className="text-[#ffe680]">{i + 1}</b>: {label}
                </span>
                <span>{r.counts[i]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Mid-class break: best students since the start of the class, with the gift the teacher just gave
function Praise({ v }: { v: StageView }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[50px] leading-none text-[#ffe680]">{X('🎁 Prize time!')}</div>
      <div className="mt-1 text-[28px] opacity-80">Top students after {v.qNo} questions</div>
      <div className="mt-4 w-full space-y-2">
        {v.praiseTop.map((s, i) => (
          <motion.div
            key={s.username}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.4 }}
            className="flex items-center gap-3 px-6 text-[40px]"
          >
            <span className="w-12">{['🥇', '🥈', '🥉'][i]}</span>
            <span className="flex-1 truncate">{s.nickname}</span>
            <span className="text-[34px]">{s.desk[s.desk.length - 1]?.icon}</span>
            <span>{s.score} pts</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-auto text-[30px] text-[#ffe680]">{X('Say hi and send hearts for a prize! 💕')}</div>
    </div>
  );
}

function Results({ v }: { v: StageView }) {
  const top = v.seats.filter((s) => s.score > 0).slice(0, 5);
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[56px] leading-none text-[#ffe680]">Class {v.round} honor roll</div>
      {top.length === 0 && <div className="mt-16 text-[38px]">Nobody scored yet</div>}
      <div className="mt-4 w-full space-y-1">
        {top.map((s, i) => (
          <motion.div
            key={s.username}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.25 }}
            className="flex items-center gap-3 px-6 text-[40px]"
          >
            <span className="w-12 text-[#ffe680]">{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
            <span className="flex-1 truncate">{s.nickname}</span>
            <span>{s.score} pts</span>
          </motion.div>
        ))}
      </div>
      {v.teamWin.length > 0 && (
        <div className="mt-auto text-[36px] text-[#ffe680]">
          🚩 {v.teamWin.map((n) => `Team ${n}`).join(' & ')} won this class!
        </div>
      )}
    </div>
  );
}

// ---------- Teams ----------
// first 45 s of a class: 4 team boxes on the board, each team's count jumps when someone picks it
function TeamPick({ v, left }: { v: StageView; left: number }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-[#ffd84a] px-4 text-[26px] font-bold text-[#7a2e0e]">🚩 Pick your team</span>
        <Timer left={left} />
      </div>
      <div className="mt-1 text-[32px] leading-tight">
        Type <b className="text-[#ffe680]">team 1</b>, <b className="text-[#ffe680]">team 2</b>, <b className="text-[#ffe680]">team 3</b> or <b className="text-[#ffe680]">team 4</b>
      </div>
      <div className="mt-2 grid w-full grid-cols-2 gap-2 px-2">
        {v.teams.map((t, i) => (
          <div key={t.no} className="rounded-2xl border-[3px] bg-white/10 text-center leading-[38px]" style={{ borderColor: TEAM_COLOR[i] }}>
            <div className="text-[32px] font-bold" style={{ color: TEAM_COLOR[i] }}>
              {TEAM_ICON[i]} Team {t.no}
            </div>
            <motion.div key={t.members} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-[28px] leading-[32px]">
              {t.members} {t.members === 1 ? 'student' : 'students'}{t.wins > 0 && <span className="ml-2 text-[24px] text-[#ffe680]">🚩{t.wins}</span>}
            </motion.div>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[24px] leading-tight opacity-85">
        {X(v.noTeam > 0 ? `${v.noTeam} not picked yet: I will place them` : 'No pick? I will put you in the smallest team')}
      </div>
    </div>
  );
}

// Team race board: pinned right of the blackboard, this class's points per team, the leader floats to the top, 🚩 = classes won
function TeamBoard({ v }: { v: StageView }) {
  if (!v.teams.length) return null;
  const rows = [...v.teams].sort((a, b) => b.score - a.score || b.wins - a.wins || a.no - b.no);
  const lead = rows[0].score > 0 ? rows[0].no : 0;
  return (
    <div className="absolute right-[8px] top-[150px] z-20 w-[168px] rotate-2 rounded-[14px] border-[3px] border-[#c9a45c] bg-[#fff8e1]/95 px-2 pb-2 pt-3 text-[#4a2c0e] shadow-[0_6px_10px_rgba(0,0,0,0.3)]">
      <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 text-[28px]">📌</div>
      <div className="text-center text-[19px] font-extrabold leading-tight text-[#b45309]">🚩 Team race</div>
      <div className="mt-1 space-y-[4px]">
        {rows.map((t) => (
          <motion.div
            key={t.no}
            layout
            className="rounded-lg px-2 py-[2px] text-white shadow"
            style={{ background: TEAM_COLOR[t.no - 1], outline: t.no === lead ? '3px solid #ffd84a' : undefined }}
          >
            <div className="flex items-center justify-between gap-1 whitespace-nowrap text-[19px] font-extrabold leading-tight">
              <span>
                {t.no === lead ? '👑 ' : ''}Team {t.no}
              </span>
              <span>{t.score}</span>
            </div>
            <div className="flex justify-between text-[15px] font-semibold leading-tight opacity-95">
              <span>{t.members} kids</span>
              <span>{t.wins > 0 ? `🚩x${t.wins}` : ''}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Events board right of the channel name: tells viewers there are 2 big shows and which one is next, after which class
function EventBadge({ v }: { v: StageView }) {
  const n = v.nextShow;
  if (!n) return null;
  // only lists the shows that are switched on in the control page
  const games = [
    { kind: 'everest', label: '🏔️ Road to Everest', on: v.cfg.everest },
    { kind: 'chuong', label: '🔔 Golden Bell', on: v.cfg.chuong },
  ].filter((g) => g.on || g.kind === n.kind);
  return (
    <div className="absolute left-[784px] top-[12px] z-20 w-[288px] overflow-hidden rounded-[18px] border-[3px] border-[#7c3aed] bg-gradient-to-b from-[#2e1065] to-[#4c1d95] text-white shadow-[0_6px_0_#3b0764]">
      <div className="bg-[#7c3aed] py-[1px] text-center text-[18px] font-extrabold tracking-wide text-[#fde68a]">🎪 CLASS EVENTS</div>
      <div className="px-2 pt-1">
        {games.map((g) => (
          <div key={g.kind} className={`truncate text-[19px] font-bold leading-[26px] ${g.kind === n.kind ? 'text-[#fde68a]' : 'opacity-70'}`}>
            {g.label}
          </div>
        ))}
      </div>
      <motion.div
        key={`${n.kind}${n.now}${n.soon}`}
        animate={n.now || n.soon ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity }}
        className={`mx-2 mb-2 mt-1 rounded-lg px-2 text-center text-[18px] font-extrabold leading-[26px] ${n.now ? 'bg-[#dc2626]' : n.soon ? 'bg-[#f59e0b] text-[#3b0764]' : 'bg-white/15'}`}
      >
        {n.now ? `🔴 HAPPENING NOW` : n.soon ? '⏰ Right after this class!' : `⏭ Next: after class ${n.afterRound}`}
      </motion.div>
    </div>
  );
}

// ---------- The 2 big shows: Road to Everest / Golden Bell ----------
// Board: while she reads, show the question + 4 options to read along; when she says go (boardShown) the clock starts and answers count
type ShowView = NonNullable<StageView['show']>;
const SHOW_ACCENT = { everest: '#7dd3fc', chuong: '#fbbf24' };
function ShowBoard({ v, left }: { v: StageView; left: number }) {
  const s = v.show!;
  const accent = SHOW_ACCENT[s.kind];
  const answering = s.stage === 'ask' && v.boardShown;
  const badge =
    s.tag === 'tie' ? '⚖️ Tiebreaker' : s.tag === 'bell' ? '🔔 Golden Bell question' : s.tag === 'rescue' ? '🤝 Rescue for everyone' : s.step === 'code' ? '🔐 Base Camp Password' : s.step === 'stake' ? '🏔️ Place your bet' : `Question ${s.qNo}`;
  return (
    <div className="flex h-full flex-col">
      {s.step !== 'gather' && s.step !== 'section' && s.step !== 'honor' && (
        <div className="flex shrink-0 items-center justify-between">
          <span className="rounded-full px-4 text-[26px] font-bold text-[#1e1b4b]" style={{ background: accent }}>
            {badge}
          </span>
          {answering ? <Timer left={left} /> : s.stage === 'reveal' ? <span className="text-[30px] text-[#9df29d]">Answer</span> : <span className="text-[26px] opacity-80">👂 Listen…</span>}
        </div>
      )}
      {s.step === 'gather' && <ShowGather s={s} left={left} />}
      {s.step === 'section' && (
        <motion.div key={s.section} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex h-full flex-col items-center justify-center text-center">
          <div className="text-[30px] opacity-80">{s.name}</div>
          <div className="mt-2 text-[58px] font-extrabold leading-tight" style={{ color: accent }}>
            {s.section}
          </div>
        </motion.div>
      )}
      {s.step === 'mc' && <ShowQuestion s={s} answering={answering} />}
      {s.step === 'stake' && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-[36px]">How much will you bet on the next question?</div>
          <div className="mt-3 flex gap-6">
            {[10, 20].map((x, i) => (
              <div key={x} className="w-[190px] rounded-2xl border-4 py-2" style={{ borderColor: accent }}>
                <div className="text-[54px] font-extrabold leading-none" style={{ color: accent }}>
                  {x}
                </div>
                <div className="text-[24px]">Type "{x}" · {s.stakes[i]} players</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[24px] opacity-80">No pick = 10 · wrong answers lose nothing</div>
        </div>
      )}
      {(s.step === 'code' || s.step === 'codeReveal') && s.code && <ShowCode s={s} answering={answering} />}
      {s.step === 'honor' && <ShowHonor s={s} />}
      {answering && (s.step === 'mc' || s.step === 'stake') && (
        <div className="mt-auto shrink-0 text-center text-[24px] opacity-85">
          {s.step === 'stake' ? 'Type 10 or 20' : 'Type A, B, C or D'} · {s.answered} answered
          {s.tag === 'final' && s.tickets > 0 && !s.ticketUser && <span className="text-[#ffe680]"> · 🎟️ got a ticket? type "hint"</span>}
        </div>
      )}
    </div>
  );
}

function ShowGather({ s, left }: { s: ShowView; left: number }) {
  const rules =
    s.kind === 'everest'
      ? ['👣 First Steps · 🔐 Base Camp Password', '🌪️ Speed Storm · 🏔️ The Summit', 'Type A B C D · every right answer scores']
      : ['🔥 Warm-up · 💪 Hold Steady · 🤝 Rescue', '⚡ Final Challenge · 🔔 Golden Bell question', 'Type A B C D · nobody gets eliminated'];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 0.47, repeat: Infinity }} className="text-[64px] leading-none">
        {s.kind === 'everest' ? '🏔️' : '🔔'}
      </motion.div>
      <div className="mt-1 text-[48px] font-extrabold leading-tight" style={{ color: SHOW_ACCENT[s.kind] }}>
        {s.name}
      </div>
      <div className="mt-2 space-y-1 text-[27px] leading-snug">
        {rules.map((r) => (
          <div key={r}>{r}</div>
        ))}
      </div>
      <div className="mt-3 text-[26px] opacity-80">Starting in {left} seconds</div>
    </div>
  );
}

function ShowQuestion({ s, answering }: { s: ShowView; answering: boolean }) {
  const reveal = s.stage === 'reveal';
  return (
    <>
      <div className="mt-2 line-clamp-3 shrink-0 text-center text-[31px] leading-[38px]">{s.question}</div>
      <div className="mt-2 grid flex-1 grid-cols-2 content-center gap-2">
        {s.opts.map((o, i) => {
          const right = reveal && i === s.ans;
          const gone = s.removed.includes(i);
          return (
            <motion.div
              key={i}
              initial={{ x: i % 2 ? 30 : -30, opacity: 0 }}
              animate={{ x: 0, opacity: gone || (reveal && !right) ? 0.35 : 1, scale: right ? [1, 1.08, 1] : 1 }}
              transition={{ delay: reveal ? 0 : i * 0.08 }}
              className={`flex min-h-[54px] items-center gap-2 rounded-xl border-[3px] px-2 text-[25px] leading-tight ${
                right ? 'border-[#4ade80] bg-[#16a34a]/50' : answering ? 'border-white/60 bg-white/10' : 'border-white/30 bg-white/5'
              }`}
            >
              <b className="w-7 shrink-0 text-center text-[28px]" style={{ color: SHOW_ACCENT[s.kind] }}>
                {'ABCD'[i]}
              </b>
              <span className={`min-w-0 flex-1 ${gone ? 'line-through' : ''}`}>{o}</span>
              {reveal && <span className="shrink-0 text-[20px] opacity-80">{s.counts[i]}</span>}
            </motion.div>
          );
        })}
      </div>
      {s.tag === 'tie' && s.stage === 'ask' && <div className="shrink-0 truncate text-center text-[22px] text-[#ffe680]">Only counts for: {s.tied.join(', ')}</div>}
      {s.ticketUser && s.stage === 'ask' && <div className="shrink-0 truncate text-center text-[22px] text-[#ffe680]">🎟️ {s.ticketUser} used a ticket: 2 wrong answers removed</div>}
      {reveal && <div className="shrink-0 text-center text-[24px] text-[#9df29d]">{s.lastRight} got it right</div>}
    </>
  );
}

function ShowCode({ s, answering }: { s: ShowView; answering: boolean }) {
  const c = s.code!;
  const letters = c.answer ? [...c.answer.replace(/\s+/g, '')] : [];
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-2 flex shrink-0 justify-center gap-1">
        {Array.from({ length: c.len }, (_, i) => (
          <div key={i} className="flex h-[48px] w-[38px] items-end justify-center border-b-4 border-[#ffe680] text-[34px] font-bold leading-none text-[#ffe680]">
            {letters[i] ?? (i === 0 ? c.first : '')}
          </div>
        ))}
      </div>
      <div className="mt-2 flex-1 space-y-1 overflow-hidden">
        {c.hints.map((h, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 text-[24px] leading-[30px]">
            <b className="shrink-0 text-[#7dd3fc]">{[30, 20, 10][i]} pts</b>
            <span className="line-clamp-2">{h}</span>
          </motion.div>
        ))}
        {c.rescue && !c.answer && <div className="text-[24px] text-[#ffe680]">🆘 10 second rescue · starts with {c.first}</div>}
      </div>
      <div className="shrink-0 text-center text-[23px] opacity-90">
        {c.answer
          ? c.solvers.length
            ? `🔓 ${c.solved} cracked it: ${c.solvers.map((x) => x.nickname).slice(0, 3).join(', ')}`
            : '🔒 Nobody cracked it'
          : answering
            ? `Type the password · ${c.pts} pts · ${c.solved} cracked it`
            : `${c.solved} cracked it`}
      </div>
    </div>
  );
}

function ShowHonor({ s }: { s: ShowView }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[44px] font-extrabold leading-none" style={{ color: SHOW_ACCENT[s.kind] }}>
        {s.kind === 'everest' ? '🚩 Everest Hall of Fame' : '🔔 Golden Bell Hall of Fame'}
      </div>
      {s.honors.length === 0 && <div className="mt-16 text-[34px]">Nobody scored yet</div>}
      <div className="mt-2 grid w-full grid-cols-2 gap-x-4 px-2 text-[22px] leading-[30px]">
        {s.honors.map((h, i) => (
          <motion.div key={h.username} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} className={`flex min-w-0 gap-1 ${i === 0 ? 'col-span-2 justify-center text-[30px] text-[#ffe680]' : ''}`}>
            <span className="shrink-0">{i === 0 ? h.title.split(' ')[0] : `${i + 1}.`}</span>
            <span className="min-w-0 truncate">{h.nickname}</span>
            <b className="shrink-0">{h.score} pts</b>
          </motion.div>
        ))}
      </div>
      {s.honors[0] && <div className="mt-auto text-[24px] opacity-85">{s.honors[0].title.slice(s.honors[0].title.indexOf(' ') + 1)} · top 10 get a badge</div>}
    </div>
  );
}

// Below the board: Mount Everest, the top 10 climb by points (max points = summit), the leader holds the flag
function Mountain({ v }: { v: StageView }) {
  const s = v.show!;
  const W = 400; // smaller so it does not cover the Top chatters board on the right
  const H = 168;
  const top = s.top.slice(0, 10);
  const pos = (i: number, score: number) => {
    const p = Math.min(1, score / Math.max(1, s.maxScore));
    const side = i % 2 === 0 ? -1 : 1; // alternate between the two slopes so names overlap less
    const y = H - 18 - p * (H - 40);
    const halfWidth = ((y - 20) / (H - 20)) * (W / 2 - 10);
    return { x: W / 2 + side * Math.max(8, halfWidth * (0.35 + ((i * 37) % 50) / 100)), y };
  };
  return (
    <div className="absolute left-[392px] top-[622px] z-30 overflow-hidden rounded-[16px] border-[3px] border-[#0c4a6e] bg-gradient-to-b from-[#bae6fd] to-[#e0f2fe] shadow-xl" style={{ width: W, height: H }}>
      <svg width={W} height={H} className="absolute inset-0">
        <polygon points={`10,${H} ${W / 2},20 ${W - 10},${H}`} fill="#64748b" />
        <polygon points={`${W / 2 - 46},62 ${W / 2},20 ${W / 2 + 46},62 ${W / 2 + 20},54 ${W / 2},66 ${W / 2 - 22},54`} fill="#f8fafc" />
        <line x1={W / 2} y1={20} x2={W / 2} y2={2} stroke="#7c2d12" strokeWidth={3} />
        <polygon points={`${W / 2},2 ${W / 2 + 22},8 ${W / 2},14`} fill="#ef4444" />
      </svg>
      <div className="absolute left-2 top-1 text-[18px] font-extrabold text-[#0c4a6e]">⛰️ Top 10 climbers · {s.players} players</div>
      {top.length === 0 && <div className="absolute inset-x-0 bottom-3 text-center text-[20px] font-bold text-white">Answer right to climb!</div>}
      {top.map((r, i) => {
        const p = pos(i, r.score);
        return (
          <motion.div
            key={r.username}
            animate={{ left: p.x, top: p.y }}
            transition={{ type: 'spring', stiffness: 80, damping: 14 }}
            className="absolute flex -translate-x-1/2 -translate-y-full items-center gap-[2px] whitespace-nowrap rounded-full bg-white/90 px-[6px] text-[14px] font-bold text-[#0c4a6e] shadow"
          >
            {i === 0 ? '🚩' : '🧗'}
            <span className="max-w-[90px] truncate">{r.nickname}</span>
            <span className="text-[#c2410c]">{r.score}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// Below the board: Golden Bell, top 5 score bars + who can still ring the bell
function BellBoard({ v }: { v: StageView }) {
  const s = v.show!;
  const top = s.top.slice(0, 5);
  return (
    <div className="absolute left-[392px] top-[622px] z-30 w-[400px] overflow-hidden rounded-[16px] border-[3px] border-[#78350f] bg-[#fffbeb]/97 shadow-xl">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#b45309] to-[#d97706] px-3 py-[2px] text-[19px] font-bold text-[#fff7d6]">
        <span>🔔 Golden Bell scores</span>
        <span>
          {s.players} players{s.tickets > 0 ? ` · 🎟️ ${s.tickets}` : ''}
        </span>
      </div>
      <div className="space-y-[3px] px-2 py-1">
        {top.length === 0 && <div className="py-3 text-center text-[20px] text-[#92400e]">Answer right to get on the board!</div>}
        {top.map((r, i) => (
          <motion.div key={r.username} layout className="relative h-[26px] overflow-hidden rounded-md bg-[#fde68a]/50">
            <motion.div className="absolute inset-y-0 left-0 bg-[#f59e0b]/70" animate={{ width: `${Math.min(100, (r.score / Math.max(1, s.maxScore)) * 100)}%` }} />
            <div className="relative flex h-full items-center gap-2 px-2 text-[18px] font-bold text-[#78350f]">
              <span>{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
              <span className="min-w-0 flex-1 truncate">{r.nickname}</span>
              <span>{r.score} pts</span>
            </div>
          </motion.div>
        ))}
        {s.bellRingers.length > 0 && <div className="truncate text-[17px] font-semibold text-[#b45309]">🔔 Bell ringers: {s.bellRingers.join(', ')}</div>}
      </div>
    </div>
  );
}

// ---------- Recess ----------
const RECESS_TITLE = { rps: 'Rock Paper Scissors', callup: 'Pop quiz', pick: 'Pick a side', roll: 'Speed roll call', heart: 'Hearts for the class', dance: '💃 Dance & hearts' };

function Recess({ v, left }: { v: StageView; left: number }) {
  const r = v.recess!;
  if (r.stage === 'board') return <SessionBoard v={v} />;
  const playing = r.stage === 'play';
  return (
    <div className="flex h-full flex-col items-center text-center">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-[#ffd84a] px-4 text-[26px] font-bold text-[#7a2e0e]">
          🔔 Recess{r.game === 'callup' ? ` · ${RECESS_TITLE.callup}` : ''}
        </span>
        {playing && <Timer left={left} />}
      </div>
      {r.game !== 'callup' && <div className="mt-1 shrink-0 text-[48px] leading-tight text-[#ffe680]">{X(RECESS_TITLE[r.game])}</div>}
      {r.game === 'rps' && (
        <>
          <div className="mt-3 flex w-full justify-center gap-6 text-[34px]">
            {[
              ['✊', 'rock'],
              ['✌️', 'scissors'],
              ['✋', 'paper'],
            ].map(([icon, word], i) => (
              <div key={word} className={`w-[150px] rounded-2xl border-2 py-2 ${r.teacher === word ? 'border-[#ffd84a] bg-white/15' : 'border-white/30'}`}>
                <div className="text-[56px] leading-none">{icon}</div>
                <div>{word}</div>
                <div className="text-[30px] text-[#9df29d]">{r.rpsCounts[i]}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[32px]">{playing ? 'Type: rock, paper or scissors' : r.teacher ? X(`Teacher threw: ${r.teacher}`) : 'Nobody played'}</div>
        </>
      )}
      {r.game === 'callup' && (
        <>
          <div className="mt-1 max-w-full shrink-0 truncate text-[36px] text-[#ffe680]">📢 {r.callName} to the board!</div>
          <div className="line-clamp-2 shrink-0 text-[30px] leading-[36px]">{r.callClue}</div>
          <Tiles letters={r.callTiles} dim={!playing} />
          <Slots slots={r.callSlots} reveal={!playing} />
          {!playing && (
            <div className="mt-1 text-[34px]">{r.callResult === 'right' ? '✅ Correct! +5 points' : r.callResult === 'wrong' ? '❌ Not quite' : '💤 No answer'}</div>
          )}
        </>
      )}
      {r.game === 'pick' && (
        <div className="mt-4 w-full space-y-4 px-4">
          {r.pick.map((label, i) => {
            const total = r.votes[0] + r.votes[1] || 1;
            const pct = Math.round((r.votes[i] / total) * 100);
            return (
              <div key={label} className="relative h-[70px] overflow-hidden rounded-2xl border-2 border-white/40 text-left">
                <div className="absolute inset-y-0 left-0 bg-[#ffd84a]/35 transition-all duration-500" style={{ width: `${pct}%` }} />
                <div className="relative flex h-full items-center justify-between px-4 text-[36px]">
                  <span>
                    Type <b className="text-[#ffe680]">{i + 1}</b>: {label}
                  </span>
                  <span>{r.votes[i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {r.game === 'roll' && (
        <>
          <div className="text-[34px]">
            Type <b className="text-[#ffe680]">HERE</b> fast, first 10 get +3
          </div>
          <div className="mt-2 grid w-full grid-cols-2 gap-x-6 px-6 text-left text-[28px]">
            {r.roll.map((n, i) => (
              <div key={i} className="truncate">
                {i + 1}. {n}
              </div>
            ))}
          </div>
        </>
      )}
      {r.game === 'dance' && (
        <>
          <div className="mt-1 text-[32px]">Send hearts to power up the class!</div>
          <HeartCounter n={r.hearts} />
          {r.topLiker && r.topLiker.nickname && (
            <div className="mt-1 max-w-full truncate px-4 text-[28px] text-[#ffb3c8]">
              👑 Top heart sender: {r.topLiker.nickname} · {r.topLiker.n}
            </div>
          )}
          {!playing && <div className="mt-1 text-[32px] text-[#9df29d]">Thank you, class! 💕</div>}
        </>
      )}
      {/* class heart rain (owner 2026-11-07): no more 0/300 goal, it just counts real hearts */}
      {r.game === 'heart' && (
        <>
          <div className="mt-2 text-[32px]">Tap the screen to send hearts!</div>
          <HeartCounter n={r.hearts} />
          {r.topLiker && r.topLiker.nickname && (
            <div className="mt-1 max-w-full truncate px-4 text-[28px] text-[#ffb3c8]">
              👑 Top heart sender: {r.topLiker.nickname} · {r.topLiker.n}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// End of recess: class monitors of the previous classes (newest on top), with a count for repeat monitors
function SessionBoard({ v }: { v: StageView }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[48px] leading-none text-[#ffe680]">👑 Class monitors</div>
      {v.champions.length === 0 && <div className="mt-16 text-[36px]">No class monitor yet</div>}
      <div className="mt-3 w-full space-y-1">
        {v.champions.map((c, i) => (
          <motion.div
            key={c.round}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.2 }}
            className="flex items-center gap-3 px-6 text-[36px]"
          >
            <span className="w-[110px] text-[26px] text-[#ffe680]">Class {c.round}</span>
            <span className="flex-1 truncate">{c.nickname}</span>
            {c.times > 1 && <span className="text-[26px] text-[#ffe680]">👑x{c.times}</span>}
            <span>{c.score} pts</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-auto text-[28px] opacity-80">New class, new scores: anyone can be class monitor!</div>
    </div>
  );
}

function WeekBoard({ v, left }: { v: StageView; left: number }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[48px] leading-none text-[#ffe680]">This week's honor roll</div>
      <div className="mt-3 w-full space-y-1">
        {v.weekTop.slice(0, 5).map((s, i) => (
          <div key={s.username} className="flex items-center gap-3 px-6 text-[36px]">
            <span className="w-12 text-[#ffe680]">{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
            <span className="flex-1 truncate">{s.nickname}</span>
            <span>{s.points} pts</span>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[28px] opacity-80">Next class in {left} seconds</div>
    </div>
  );
}

// Top-left corner above the teacher: pinned note "Top students this class", only this class's points, restarts every class
// (owner changed it 2026-11-04, it used to be the whole day). Seats are already sorted by class points, so take the first 4
function DayTop({ v }: { v: StageView }) {
  const rows = v.seats.filter((s) => s.score > 0).slice(0, 4).map((s) => ({ username: s.username, nickname: s.nickname, points: s.score })); // top 4 only so it never covers the teacher's head
  return (
    <div className="absolute left-[10px] top-[230px] z-20 w-[326px] -rotate-2 rounded-[14px] border-[3px] border-[#c9a45c] bg-[#fff8e1]/95 px-3 pb-2 pt-3 text-[#4a2c0e] shadow-[0_6px_10px_rgba(0,0,0,0.3)]">
      <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 text-[30px]">📌</div>
      <div className="whitespace-nowrap text-center text-[21px] font-extrabold leading-tight text-[#b45309]">🏆 Top students this class</div>
      {rows.length === 0 && <div className="py-3 text-center text-[20px] text-[#8a6a3a]">Nobody yet, answer right to get on the board!</div>}
      <div className="mt-1 space-y-[2px]">
        {rows.map((r, i) => (
          <motion.div key={r.username} layout className="flex items-center gap-2 text-[23px] leading-[28px]">
            <span className="w-7 text-center">{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.nickname}</span>
            <b className="text-[#c2410c]">{r.points}</b>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------- Teacher (Ms. Ngan: 16 poses, art in characters/co-giao-ngan, background removed into public/assets/nv/co-ngan) ----------
function teacherPose(v: StageView, now: number): string {
  // goodbye / end of live banner is on: she waves goodbye, alternating with happy heart hands
  if (v.goodbye) return now % 3000 < 1800 ? '04-vay-chao' : '07-tay-nguc';
  // a student walks up with flowers: surprised, then laughs behind her hand when the flowers arrive
  if (v.walk) return now - v.walk.at < GAME.walkMs * 0.35 ? '13-ngac-nhien' : '06-cuoi';
  if (now - v.lastFlowerAt < 3000) return '06-cuoi'; // got flowers
  if (v.birthday) return '09-mung';
  if (v.clapping) return '10-vo-tay';
  if (v.loveFans > 0) return '07-tay-nguc'; // students typing "love you teacher"
  switch (v.phase) {
    case 'team':
    case 'intro':
      return '04-vay-chao';
    case 'question':
      if (!v.boardShown) return '02-gioi-thieu'; // reading the question
      if (v.correctCount > 0) return '08-ngon-cai'; // someone got it right
      return now % 8000 < 4000 ? '03-chi-bang' : '01-dung'; // waiting for answers: sometimes pointing at the board, sometimes standing
    case 'bonus':
      return '12-gai-dau'; // nobody yet, extra time
    case 'reveal':
      return v.correctCount === 0 ? '11-nhun-vai' : v.golden ? '09-mung' : '08-ngon-cai';
    case 'praise':
      return '09-mung';
    case 'results':
    case 'vote':
      return '14-ngon-tro';
    case 'recess':
      if (v.recess?.stage === 'play') return v.recess.game === 'callup' ? '16-chi-trai' : '05-dang-tay';
      return v.recess?.stage === 'result' ? '15-chong-hong' : '07-tay-nguc';
  }
  return '01-dung';
}

/** The 2 big shows: pose per step (art in characters/co-giao-ngan/duong-len-dinh-everest and Rung-Chuong-Dong) */
function showPose(v: StageView, now: number): string {
  const sh = v.show!;
  const flower = now - v.lastFlowerAt < 3000 || !!v.walk;
  const alt = now % 6000 < 3000;
  const answering = sh.stage === 'ask' && v.boardShown;
  if (sh.kind === 'everest') {
    if (flower) return '10-cuoi-vui';
    if (v.clapping) return '15-vo-tay';
    switch (sh.step) {
      case 'gather':
        return alt ? '04-chao-doan-leo' : '12-vay-chao';
      case 'section':
        return sh.section.includes('Summit') ? '02-chi-len-dinh' : '03-chi-lo-trinh';
      case 'stake':
        return '16-tu-tin';
      case 'code':
        return !answering ? '05-doc-ban-do' : sh.code?.rescue ? '14-dong-vien' : alt ? '06-suy-nghi' : '01-dung-san-sang';
      case 'codeReveal':
        return sh.code?.solved ? '10-cuoi-vui' : '09-bat-ngo';
      case 'honor':
        return '13-cam-co-dinh';
      default:
        if (sh.stage === 'reveal') return sh.lastRight > 0 ? '07-like' : '09-bat-ngo';
        if (!answering) return '05-doc-ban-do';
        if (Math.max(0, v.endsAt - now) <= 3000) return '11-nhac-nho-an-toan';
        return alt ? '08-co-vu' : '01-dung-san-sang';
    }
  }
  if (flower) return '06-rung-chuong-cuoi-tuoi';
  if (v.clapping) return '07-rung-chuong-hao-hung';
  switch (sh.step) {
    case 'gather':
      return alt ? '12-moi-thi-sinh' : '13-vay-chao-cam-chuong';
    case 'section':
      return sh.section.includes('Bell') ? '15-chuan-bi-rung' : '09-bao-hieu-bat-dau';
    case 'honor':
      return alt ? '10-mung-chien-thang' : '03-rung-chuong-cao';
    default:
      if (sh.stage === 'reveal') {
        if (sh.lastRight === 0) return '11-bat-ngo-nghe-chuong';
        return sh.tag === 'bell' ? '04-rung-chuong-hai-tay' : alt ? '02-rung-chuong-ben' : '05-rung-chuong-nghieng-nguoi';
      }
      if (!answering) return sh.tag === 'tie' ? '16-nghi-thang-tran' : '08-rung-chuong-nghiem-tuc';
      return alt ? '01-cam-chuong-san-sang' : '14-tu-hao-gio-chuong';
  }
}

function Teacher({ v, now }: { v: StageView; now: number }) {
  const gotFlower = now - v.lastFlowerAt < 3000;
  if (THAY) return <TeacherThay v={v} now={now} gotFlower={gotFlower} />;
  // outfit: the white set is in the main folder, the others in sub-folders; the 2 big shows use the show outfit
  const src = v.show
    ? asset(`/assets/nv/co-ngan/${v.show.kind}/${showPose(v, now)}.webp`)
    : v.outfit === 'trang' || !v.outfit
      ? asset(`/assets/nv/co-ngan/${teacherPose(v, now)}.webp`)
      : asset(`/assets/nv/co-ngan/${v.outfit}/${OUTFIT_POSE[teacherPose(v, now)] ?? '01-dung'}.webp`);
  return (
    <div className="absolute left-[86px] top-[410px] h-[490px] w-[320px]">
      <img src={src} className="h-full w-full object-contain object-bottom drop-shadow-[0_10px_8px_rgba(0,0,0,0.25)]" />
      {/* name badge pinned on her chest (the Top students note is above her head, so not there) */}
      <div className="absolute left-1/2 top-[128px] z-10 -translate-x-1/2 -rotate-3 whitespace-nowrap rounded-full border-[3px] border-[#fff6dd] bg-gradient-to-b from-[#ff6b9a] to-[#d63384] px-3 py-[1px] text-[22px] font-extrabold text-white shadow-[0_3px_0_#9d174d]">
        🌸 {v.cfg.teacherName}
      </div>
      <AnimatePresence>
        {gotFlower && (
          <motion.div
            key={v.lastFlowerAt}
            initial={{ scale: 0, y: 80 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-[130px] top-[150px] text-[80px]"
          >
            💐
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Male teacher: same spot as the teacher, suit colour & badge change with each term (Term 1 -> Term 2 -> Term 3 -> Finals) */
function TeacherThay({ v, now, gotFlower }: { v: StageView; now: number; gotFlower: boolean }) {
  const pose = v.show ? thayShowPose(v, now) : (THAY_POSE[teacherPose(v, now)] ?? '01-dung');
  const t = STAGE_THEMES[stageIdxOf(v)];
  return (
    <div className="absolute left-[86px] top-[410px] h-[490px] w-[320px]">
      <img
        src={asset(`/assets/nv/thay/${pose}.webp`)}
        className="h-full w-full object-contain object-bottom drop-shadow-[0_10px_8px_rgba(0,0,0,0.25)] transition-[filter] duration-500"
        style={t.thayFilter ? { filter: t.thayFilter } : undefined}
      />
      <div className={`absolute left-1/2 top-[118px] z-10 -translate-x-1/2 -rotate-3 whitespace-nowrap rounded-full border-[3px] border-[#fff6dd] bg-gradient-to-b px-3 py-[1px] text-[22px] font-extrabold text-white transition-all duration-500 ${t.thayBadge}`}>
        {t.thayIcon} {shownTeacherName(v.cfg)}
      </div>
      <AnimatePresence>
        {gotFlower && (
          <motion.div key={v.lastFlowerAt} initial={{ scale: 0, y: 80 }} animate={{ scale: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-[130px] top-[150px] text-[80px]">
            💐
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Hall monitor (2026-11-07) ----------
// Own art: put it in characters/thay-giam-thi and run: node tools/remove-bg.mjs thay-giam-thi giam-thi (needs 01-dung.png).
// Without art it borrows the male teacher image, with another shirt colour + a red "HALL MONITOR" armband so it differs from the teacher.
const GIAM_THI_IMGS = [asset('/assets/nv/giam-thi/01-dung.webp'), asset('/assets/nv/thay/01-dung.webp')];
const DOOR: [number, number] = [1000, 690]; // classroom door on the right (top-left corner of the character)
function GiamThi({ h }: { h: number }) {
  const [own, setOwn] = useState(true);
  return (
    <div className="relative" style={{ width: h * 0.62, height: h }}>
      <img
        src={own ? GIAM_THI_IMGS[0] : GIAM_THI_IMGS[1]}
        onError={() => setOwn(false)}
        className="h-full w-full object-contain object-bottom drop-shadow-[0_6px_5px_rgba(0,0,0,0.35)]"
        style={own ? undefined : { filter: 'hue-rotate(185deg) saturate(1.6) brightness(0.92)' }}
      />
      <div className="absolute left-1/2 top-[26%] -translate-x-1/2 -rotate-6 whitespace-nowrap rounded-md border-2 border-white bg-[#2563eb] px-2 text-[17px] font-extrabold text-white shadow">
        📋 HALL MONITOR
      </div>
    </div>
  );
}

/** The hall monitor walks from the door to a student who has been quiet too long and walks them out; a waiting student walks from the door to the empty seat */
function Escort({ v }: { v: StageView }) {
  const e = v.escort;
  if (!e) return null;
  const T = GAME.escortMs / 1000;
  const H = 300;
  const seat = seatBox(Math.max(0, e.seat));
  // stands on the floor next to the seat (right of the seat so he is not hidden behind the teacher in the left corner)
  const at: [number, number] = [seat.x + seat.w * 0.6, seat.y + seat.show + 30 - H];
  const kidH = 150;
  const g = e.out.girl ? 'nu' : 'nam';
  const target = e.inSeat >= 0 ? seatBox(e.inSeat) : null;
  const gi = e.in?.girl ? 'nu' : 'nam';
  return (
    <>
      <motion.div
        key={`gt${e.at}`}
        initial={{ left: DOOR[0], top: DOOR[1], opacity: 0 }}
        animate={{ left: [DOOR[0], at[0], at[0], DOOR[0]], top: [DOOR[1], at[1], at[1], DOOR[1]], opacity: [1, 1, 1, 0] }}
        transition={{ duration: T * 0.85, times: [0, 0.4, 0.55, 1], ease: 'easeInOut' }}
        className="pointer-events-none absolute z-30"
      >
        <GiamThi h={H} />
      </motion.div>
      {/* student being walked out: stands up at the seat and follows him to the door */}
      <motion.div
        key={`out${e.at}`}
        initial={{ left: seat.x, top: seat.y - 30, opacity: 0 }}
        animate={{ left: [seat.x, seat.x, DOOR[0] + 20, DOOR[0] + 20], top: [seat.y - 30, seat.y - 30, DOOR[1] + 70, DOOR[1] + 70], opacity: [0, 1, 1, 0] }}
        transition={{ duration: T * 0.85, times: [0, 0.45, 0.95, 1], ease: 'easeInOut' }}
        className="pointer-events-none absolute z-30"
        style={{ width: kidH * 0.47, height: kidH }}
      >
        <img src={asset(`/assets/nv/${g}/${POSE[g].buon}.webp`)} className="h-full w-full drop-shadow-[0_4px_3px_rgba(0,0,0,0.3)]" />
        <div className="nametag" style={{ fontSize: 15, maxWidth: 120 }}>
          <span className="truncate">💤 {e.out.nickname}</span>
        </div>
      </motion.div>
      {/* new student: walks from the door to the seat */}
      {e.in && target && (
        <motion.div
          key={`in${e.at}`}
          initial={{ left: DOOR[0], top: DOOR[1] + 70, opacity: 0 }}
          animate={{ left: [DOOR[0], DOOR[0], target.x, target.x], top: [DOOR[1] + 70, DOOR[1] + 70, target.y - 30, target.y - 30], opacity: [0, 1, 1, 0] }}
          transition={{ duration: T, times: [0, 0.6, 0.95, 1], ease: 'easeInOut' }}
          className="pointer-events-none absolute z-30"
          style={{ width: kidH * 0.47, height: kidH }}
        >
          <img src={asset(`/assets/nv/${gi}/${POSE[gi].chao}.webp`)} className="h-full w-full drop-shadow-[0_4px_3px_rgba(0,0,0,0.3)]" />
          <div className="nametag" style={{ fontSize: 15, maxWidth: 120 }}>
            <span className="truncate">🙋 {e.in.nickname}</span>
          </div>
        </motion.div>
      )}
    </>
  );
}

// ---------- Dance break with hearts at recess (2026-11-07) ----------
/** seated students come up to dance: at most GAME.dancers students who are still active, in seat order (high scores first) */
function dancersOf(v: StageView) {
  if (v.phase !== 'recess' || v.recess?.game !== 'dance') return [];
  return v.seats.filter((s) => !s.sleeping).slice(0, GAME.dancers);
}
// floor space in front of the board (between the teacher and the first row), 2 staggered rows: [body centre, feet]
const DANCE_SPOTS: [number, number][] = [
  [445, 915], [550, 915], [655, 915], [760, 915], [865, 915],
  [497, 845], [602, 845], [707, 845], [812, 845], [917, 845],
];
function Dancers({ v }: { v: StageView }) {
  const list = dancersOf(v);
  return (
    <>
      {list.map((s, i) => {
        const H = i < 5 ? 190 : 170;
        const [cx, feet] = DANCE_SPOTS[i];
        const g = s.girl ? 'nu' : 'nam';
        const pose = (['vui', 'tay', 'chao'] as const)[i % 3];
        return (
          <motion.div
            key={s.username}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute"
            style={{ left: cx - (H * 0.47) / 2, top: feet - H, width: H * 0.47, height: H, zIndex: i < 5 ? 31 : 30 }}
          >
            <motion.img
              src={asset(`/assets/nv/${g}/${POSE[g][pose]}.webp`)}
              animate={{ y: [0, -22, 0, -10, 0], rotate: [-8, 8, -8], scaleX: [1, 1, -1, -1, 1] }}
              transition={{ duration: 1.3 + (i % 3) * 0.15, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
              style={{ transformOrigin: 'bottom center' }}
              className="h-full w-full drop-shadow-[0_4px_3px_rgba(0,0,0,0.3)]"
            />
            <motion.div
              animate={{ y: [0, -30], opacity: [0, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3 }}
              className="absolute -top-6 left-1/2 text-[28px]"
            >
              {['🎵', '🎶', '✨'][i % 3]}
            </motion.div>
            <div className="nametag" style={{ fontSize: 14, maxWidth: 110 }}>
              <span className="truncate">{s.nickname}</span>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

/** heart counter: big number that bounces on every increase */
function HeartCounter({ n }: { n: number }) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-[24px] border-4 border-[#ff8fb1] bg-[#3b0a1e]/70 px-6 py-1 shadow-[0_0_24px_rgba(255,93,143,0.6)]">
      <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="text-[70px] leading-none">
        ❤️
      </motion.span>
      <motion.span key={n} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="font-mono text-[84px] font-extrabold leading-none text-[#ffd1de] tabular-nums">
        {n.toLocaleString('en-US')}
      </motion.span>
      <span className="ml-3 text-[34px] text-[#ffd1de]">hearts</span>
    </div>
  );
}

/** dance-break banner at the top of the screen + hearts floating up from the bottom */
function DanceBanner({ v }: { v: StageView }) {
  const on = v.phase === 'recess' && v.recess?.game === 'dance' && v.recess.stage === 'play';
  return (
    <AnimatePresence>
      {on && (
        <motion.div key="dance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-40">
          <motion.div
            initial={{ y: -60 }}
            animate={{ y: 0, scale: [1, 1.04, 1] }}
            transition={{ scale: { duration: 0.9, repeat: Infinity } }}
            className="absolute left-[110px] top-[140px] w-[860px] rounded-[30px] border-4 border-white bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 px-6 py-2 text-center font-extrabold text-white shadow-2xl"
          >
            <div className="text-[40px] leading-tight">💃 RECESS · EVERYBODY DANCE 🕺</div>
            <div className="line-clamp-2 text-[28px] leading-tight">{v.cfg.danceText}</div>
          </motion.div>
          {Array.from({ length: 12 }, (_, i) => (
            <motion.div
              key={i}
              initial={{ y: 1500, opacity: 0 }}
              animate={{ y: 600, opacity: [0, 1, 0] }}
              transition={{ duration: 2.6, delay: (i % 6) * 0.35, repeat: Infinity }}
              className="absolute text-[60px]"
              style={{ left: 30 + i * 88 }}
            >
              {i % 3 === 0 ? '💖' : '❤️'}
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Fastest on this question ----------
// End of the question (answer shown): Top 5 fastest board, time to the millisecond + points earned; slower right answers +1
const secText = (ms: number) => `${(ms / 1000).toFixed(3)} s`;
function FastestBoard({ v }: { v: StageView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute left-[378px] top-[618px] z-30 w-[460px] overflow-hidden rounded-[16px] border-[3px] border-[#7a2e0e] bg-[#fff6dd]/97 shadow-xl"
    >
      <div className="flex items-center justify-between bg-[#7a2e0e] px-3 py-[2px] text-[25px] font-bold text-[#ffe9b8]">
        <span>⚡ Top {GAME.fastestShown} fastest</span>
        <span>{v.correctCount} correct</span>
      </div>
      {v.fastest.length === 0 && <div className="py-3 text-center text-[22px] text-[#8a6a3a]">Nobody got this one</div>}
      {v.fastest.map((a, i) => (
        <motion.div
          key={a.username}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 * i }}
          className={`flex items-center gap-2 px-3 text-[29px] leading-[42px] text-[#4a2c0e] ${i % 2 ? 'bg-[#f6e3b4]/60' : ''}`}
        >
          <span className="w-9 shrink-0 text-center text-[28px]">{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{a.nickname}</span>
          <span className="shrink-0 whitespace-nowrap text-right text-[24px] font-bold tabular-nums text-[#6b4a22]">{secText(a.ms)}</span>
          <b className="w-[58px] shrink-0 text-right text-[30px] text-[#c2410c]">+{a.points}</b>
        </motion.div>
      ))}
      {v.laterCount > 0 && (
        <div className="border-t border-[#e9d8a6] px-3 text-center text-[22px] font-semibold leading-[34px] text-[#6b4a22]">
          {v.laterCount} more got it later: +{v.laterPoints} each
        </div>
      )}
    </motion.div>
  );
}

function Podium({ v }: { v: StageView }) {
  if (v.phase === 'show' && v.show) return v.show.kind === 'everest' ? <Mountain v={v} /> : <BellBoard v={v} />;
  if (v.phase === 'reveal') return <FastestBoard v={v} />;
  if (v.phase !== 'question' && v.phase !== 'bonus') return null;
  const t = STAGE_THEMES[stageIdxOf(v)];
  return (
    <div className="absolute left-[417px] top-[634px] w-[420px]">
      <div className={`flex items-center justify-between rounded-t-[14px] px-3 py-[1px] text-[19px] font-bold transition-colors duration-500 ${t.podiumHeader}`}>
        <span>⚡ Fastest</span>
        <span>{v.correctCount} correct so far</span>
      </div>
      <div className={`flex h-[48px] items-center gap-1 rounded-b-[14px] px-2 shadow-lg transition-colors duration-500 ${t.podiumBody}`}>
        {v.correctTop.length === 0 && <div className="w-full text-center text-[20px] text-[#8a6a3a]">Nobody has it yet…</div>}
        <AnimatePresence initial={false}>
          {v.correctTop.map((a, i) => (
            <motion.div
              key={a.username}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex w-1/3 min-w-0 items-center gap-1 text-[17px] text-[#4a2c0e]"
            >
              <span className="text-[20px]">{['🥇', '🥈', '🥉'][i]}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate font-semibold">{a.nickname}</div>
                <div className="font-extrabold text-[#c2410c]">+{a.points}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Hint line under the "Fastest" box, above the first row: how to get a seat (changes every 8 s, kept short)
const SEAT_HINTS = ['⭐ Answer fast, score high, get a seat!', '💬 Keep chatting to keep your seat!'];
// while asking: always show the fixed how-to so people scrolling in understand at once (quick mode 2026-11-04)
const ASK_HINT = '💬 Type your answer in the comments · fastest +10';
function SeatHint({ now, asking }: { now: number; asking: boolean }) {
  const i = asking ? -1 : Math.floor(now / 8000) % SEAT_HINTS.length;
  return (
    <div className="pointer-events-none absolute left-[397px] top-[718px] z-[9] flex w-[460px] justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="whitespace-nowrap rounded-full bg-[#7a2e0e]/80 px-3 py-[1px] text-[18px] font-bold text-[#ffe9b8] shadow-md"
        >
          {i < 0 ? ASK_HINT : SEAT_HINTS[i]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------- Students ----------
function studentPose(s: StageView['seats'][number], v: StageView, rank: number, now: number): PoseKey {
  if (v.goodbye) return (rank + Math.floor(now / 1200)) % 2 === 0 ? 'chao' : 'vui';
  if (v.clapping) return 'vui';
  if (now - s.joinedAt < 3000) return 'chao';
  const asking = v.phase === 'question' || v.phase === 'bonus';
  if (s.answered === 'right') return 'vui';
  if (s.answered === 'wrong') return asking ? 'buon' : 'ngac';
  if (asking) return now - s.lastActive < 2500 ? 'tay' : 'nghi';
  if ((v.phase === 'results' || v.phase === 'praise') && rank < 3 && s.score > 0) return 'vui';
  if (now - (s.desk[s.desk.length - 1]?.at ?? 0) < 3000) return 'vui'; // just got a gift from the teacher
  return now - s.lastActive < 2500 ? 'tay' : 'dung';
}

/** student at the start / end of a row: the name tag leans inwards so it never spills off the screen */
function edgeTag(k: number, n: number): React.CSSProperties {
  if (k === 0) return { left: 0, transform: 'none' };
  if (k === n - 1) return { left: 'auto', right: 0, transform: 'none' };
  return {};
}

/** Position of seat i (box of the seated upper body, stage coordinates) */
function seatBox(i: number) {
  const ri = SEAT_ROW[i] ?? ROWS.length - 1;
  const row = ROWS[ri];
  const k = i - SEAT_ROW.indexOf(ri); // place in the row
  const scale = row.s * KID;
  const w = SPRITE_H * 0.47 * scale;
  const h = SPRITE_H * scale;
  const show = h * SHOW;
  const cx = row.x1 + ((k + 0.5) * (row.x2 - row.x1)) / Math.max(1, row.n);
  const x = cx * K - w / 2;
  const y = (row.y + 0.64 * (row.b - row.y)) * K - show; // sitting on the bench, back to the audience
  return { scale, w, h, show, x, y, ri, k, gap: ((row.x2 - row.x1) * K) / Math.max(1, row.n) };
}

// Desk colours & styles for the 4 terms (keeps the ROWS coordinates exactly)
const DESK_STYLES = [
  // Term 1: warm golden pine desks, the classic look
  {
    shadow: '#9c5a2c',
    leg: '#70411b',
    frontPanel: '#965c22',
    topFace: '#cf9a4c',
    frontEdge: '#b5772f',
    benchLeg: '#5f3816',
    benchTop: '#c68a3c',
    benchEdge: '#a5692b',
    stroke: '#57320f',
    trim: '',
  },
  // Term 2: light modern oak desks + navy powder-coated steel frame
  {
    shadow: '#1e3a5f',
    leg: '#1e293b',
    frontPanel: '#0f3460',
    topFace: '#e5c185',
    frontEdge: '#0284c7',
    benchLeg: '#1e293b',
    benchTop: '#d8ad68',
    benchEdge: '#0369a1',
    stroke: '#0f172a',
    trim: '#38bdf8',
  },
  // Term 3: deep red mahogany / rosewood hall desks with brass-gold trim
  {
    shadow: '#4a1228',
    leg: '#3b0a1e',
    frontPanel: '#6b1426',
    topFace: '#a82838',
    frontEdge: '#801826',
    benchLeg: '#3b0a1e',
    benchTop: '#962232',
    benchEdge: '#6b1426',
    stroke: '#2d0614',
    trim: '#f59e0b',
  },
  // Term 4 (finals arena): Hall of Glory desks with crimson velvet cloth and royal gold trim
  {
    shadow: '#550c0c',
    leg: '#78350f',
    frontPanel: '#991b1b',
    topFace: '#dc2626',
    frontEdge: '#fbbf24',
    benchLeg: '#78350f',
    benchTop: '#b91c1c',
    benchEdge: '#f59e0b',
    stroke: '#450a0a',
    trim: '#fef08a',
  },
] as const;

/** Long desk + bench for one row (fully covers the single desks painted in the background, changes with the 4 terms) */
function LongDesk({ ri, stageIdx = 0 }: { ri: number; stageIdx?: 0 | 1 | 2 | 3 }) {
  const r = ROWS[ri];
  const h = r.b - r.y;
  const [x1, x2] = [r.x1 - 6, r.x2 + 6];
  const Y = (f: number) => r.y + f * h;
  const nLegs = Math.max(2, Math.floor((r.n || 8) / 2) + 1);
  const legs = Array.from({ length: nLegs }, (_, j) => x1 + 22 + (j * (x2 - x1 - 44)) / (nLegs - 1));
  const d = DESK_STYLES[stageIdx];
  const line = { stroke: d.stroke, strokeWidth: 3, strokeLinejoin: 'round' as const };
  const midX = (x1 + x2) / 2;

  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={1080} height={1920} viewBox="0 0 941 1672" style={{ zIndex: 9 + ri }}>
      {/* shadow under the desks: hides the legs of the single desks in the background */}
      <rect x={x1 - 2} y={Y(0.5)} width={x2 - x1 + 4} height={h * 0.52} rx={10} fill={d.shadow} />
      {/* desk legs at both ends */}
      <rect x={x1 + 6} y={Y(0.34)} width={14} height={h * 0.62} fill={d.leg} {...line} />
      <rect x={x2 - 20} y={Y(0.34)} width={14} height={h * 0.62} fill={d.leg} {...line} />
      {/* desk top + front edge + modesty panel */}
      <rect x={x1 + 14} y={Y(0.36)} width={x2 - x1 - 28} height={h * 0.26} fill={d.frontPanel} {...line} />
      <polygon points={`${x1 + 8},${r.y} ${x2 - 8},${r.y} ${x2},${Y(0.28)} ${x1},${Y(0.28)}`} fill={d.topFace} {...line} />
      <rect x={x1} y={Y(0.28)} width={x2 - x1} height={h * 0.08} fill={d.frontEdge} {...line} />

      {/* Signature decoration on the desk front for Term 2, Term 3 and Term 4 */}
      {stageIdx === 1 && (
        <>
          {/* Bright blue metal brace across the desk front (Term 2) */}
          <line x1={x1 + 26} y1={Y(0.48)} x2={x2 - 26} y2={Y(0.48)} stroke={d.trim} strokeWidth={3} strokeDasharray="18 8" opacity="0.85" />
        </>
      )}
      {stageIdx === 2 && (
        <>
          {/* Elegant brass-gold trim frame on the mahogany desk front (Term 3) */}
          <rect
            x={x1 + 24}
            y={Y(0.39)}
            width={x2 - x1 - 48}
            height={h * 0.19}
            rx={3}
            fill="none"
            stroke={d.trim}
            strokeWidth={2.2}
            opacity="0.88"
          />
        </>
      )}
      {stageIdx === 3 && (
        <>
          {/* Red velvet valance with gold fringe + Star of Glory in the middle of the desk (Term 4) */}
          <rect
            x={x1 + 20}
            y={Y(0.38)}
            width={x2 - x1 - 40}
            height={h * 0.21}
            rx={4}
            fill="#7f1d1d"
            stroke="#fde047"
            strokeWidth={2.8}
          />
          <line x1={x1 + 28} y1={Y(0.56)} x2={x2 - 28} y2={Y(0.56)} stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="6 6" />
          <circle cx={midX} cy={Y(0.48)} r={h * 0.08} fill="#fbbf24" stroke="#78350f" strokeWidth={1.8} />
        </>
      )}

      {/* bench */}
      {legs.map((lx) => (
        <rect key={lx} x={lx - 5} y={Y(0.74)} width={10} height={h * 0.24} fill={d.benchLeg} />
      ))}
      <rect x={x1 + 16} y={Y(0.6)} width={x2 - x1 - 32} height={h * 0.1} rx={4} fill={d.benchTop} {...line} />
      <rect x={x1 + 16} y={Y(0.7)} width={x2 - x1 - 32} height={h * 0.06} fill={d.benchEdge} {...line} />
    </svg>
  );
}

/** Uniform accessories seen from behind for each term (drawn over the shoulders of the white school shirt) */
function StudentUniformBack({ stageIdx }: { stageIdx: 0 | 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {stageIdx === 0 && (
        /* Term 1: red scarf over the shoulder of the white shirt */
        <g>
          <polygon points="24,55 76,55 50,86" fill="#ef4444" stroke="#991b1b" strokeWidth="1.8" strokeLinejoin="round" />
          <polygon points="29,56 71,56 50,80" fill="#dc2626" />
          <circle cx="50" cy="57" r="4" fill="#b91c1c" stroke="#fef08a" strokeWidth="1" />
        </g>
      )}
      {stageIdx === 1 && (
        /* Term 2: sailor-style collar with blue trim + blue shoulder straps */
        <g>
          <polygon points="23,55 77,55 70,73 30,73" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="27" y1="68" x2="73" y2="68" stroke="#e0f2fe" strokeWidth="2" />
          <rect x="18" y="54" width="11" height="5" rx="2" fill="#0369a1" stroke="#e0f2fe" strokeWidth="1" />
          <rect x="71" y="54" width="11" height="5" rx="2" fill="#0369a1" stroke="#e0f2fe" strokeWidth="1" />
        </g>
      )}
      {stageIdx === 2 && (
        /* Term 3: purple and gold honour collar of a gifted school */
        <g>
          <polygon points="22,55 78,55 68,75 32,75" fill="#6b21a8" stroke="#fbbf24" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="50" cy="65" r="4.5" fill="#fde047" stroke="#581c87" strokeWidth="1.2" />
        </g>
      )}
      {stageIdx === 3 && (
        /* Term 4 (finals arena): royal red Cape of Glory with gold trim across the shoulders */
        <g>
          <path d="M 18,54 Q 50,62 82,54 L 85,96 Q 50,90 15,96 Z" fill="#b91c1c" stroke="#fde047" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M 22,55 Q 50,63 78,55 L 74,70 Q 50,65 26,70 Z" fill="#7f1d1d" stroke="#fbbf24" strokeWidth="1.6" />
          <circle cx="50" cy="61" r="5" fill="#fde047" stroke="#78350f" strokeWidth="1.4" />
        </g>
      )}
    </svg>
  );
}

function Students({ v, now }: { v: StageView; now: number }) {
  const asking = v.phase === 'question' || v.phase === 'bonus';
  const first = asking ? v.correctTop[0]?.username : undefined;
  const dancing = new Set(dancersOf(v).map((s) => s.username));
  const stageIdx = stageIdxOf(v);
  const theme = STAGE_THEMES[stageIdx];
  return (
    <>
      {ROWS.map((_, ri) => (
        <LongDesk key={ri} ri={ri} stageIdx={stageIdx} />
      ))}
      {v.seats.map((s, i) => {
        const { scale, w, h, show, x, y, ri, k, gap } = seatBox(i);
        // staggered name tags: the 2nd, 4th, 6th... student in a row has the tag one level lower, so tags on the same level are 2 seats apart and long names fit
        const low = k % 2 === 1;
        const pose = studentPose(s, v, i, now);
        const g = s.girl ? 'nu' : 'nam';
        const hd = HEAD[g];
        const called = v.recess?.game === 'callup' && v.recess.callUser === s.username;
        // walking up to the front (flowers / standing up front): empty seat, the character is drawn elsewhere
        // dancing in front of the board, or being brought in by the hall monitor (not at the seat yet): empty seat
        const entering = v.escort?.in?.username === s.username && now - v.escort.at < GAME.escortMs * 0.95;
        const away = s.standing || v.walk?.username === s.username || dancing.has(s.username) || entering;
        return (
          <motion.div
            key={s.username}
            initial={{ opacity: 0, left: x, top: y + 40 }}
            // first right answer: jumps for joy
            animate={{ opacity: away ? 0 : 1, left: x, top: s.username === first ? [y, y - 34, y, y - 18, y] : y }}
            transition={s.username === first ? { top: { duration: 0.9 } } : { type: 'spring', stiffness: 120, damping: 18 }}
            className={`absolute ${called ? 'called-up' : ''}`}
            style={{ width: w, height: show, zIndex: 10 + ri }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <img src={asset(`/assets/nv/${g}/sau-${POSE[g][pose]}.webp`)} style={{ width: w, height: h }} className="max-w-none" />
              <StudentUniformBack stageIdx={stageIdx} />
              <div className="absolute" style={{ left: hd.x * w, top: hd.y * h, width: hd.w * w, height: hd.h * h }}>
                <Hair username={s.username} girl={s.girl} stageIdx={stageIdx} rank={i} />
              </div>
            </div>
            {s.answered === 'right' && <div className="badge bg-[#16a34a]">✓</div>}
            {s.answered === 'right' && s.gain > 0 && (
              <motion.div
                key={`gain${v.qNo}`}
                initial={{ y: 0, opacity: 1, scale: 0.6 }}
                animate={{ y: -90, opacity: [1, 1, 0], scale: 1.2 }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
                className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2 whitespace-nowrap font-extrabold text-[#fde047] [text-shadow:0_2px_0_#7a2e0e,0_0_6px_#000]"
                style={{ fontSize: 34 * scale }}
              >
                +{s.gain}
              </motion.div>
            )}
            {s.answered === 'wrong' && <div className="badge bg-[#dc2626]">✗</div>}
            <DeskGifts desk={s.desk} x={x} y={y} w={w} show={show} scale={scale} />
            {s.sleeping && !s.bubble && (
              <motion.div
                animate={{ y: [0, -14, 0], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="pointer-events-none absolute -top-[46px] right-0 text-[34px]"
                style={{ fontSize: 34 * scale }}
              >
                💤
              </motion.div>
            )}
            {s.bubble && <ChatBubble text={s.bubble} scale={scale} />}
            <div
              className={`nametag ${theme.nametagBorder}`}
              style={{ ...edgeTag(k, ROWS[ri].n), fontSize: 19 * scale, maxWidth: 2 * gap - 8, bottom: low ? `calc(100% - ${4 + 27 * scale}px)` : undefined, zIndex: low ? 2 : 1 }}
            >
              {s.team > 0 && (
                <span className="mr-1 shrink-0 rounded-full px-[5px] font-extrabold text-white" style={{ background: TEAM_COLOR[s.team - 1] }}>
                  {s.team}
                </span>
              )}
              {i < 5 && s.score > 0 && <span className="rank">{i + 1}</span>}
              {s.title && <span className="mr-1">{s.title === 'lop-truong' ? '👑' : '⭐'}</span>}
              {s.showIcons && <span className="mr-1 whitespace-nowrap">{s.showIcons}</span>}
              {called && <span className="mr-1">📢</span>}
              {s.days >= 2 && <span className="mr-1 whitespace-nowrap">🎒{s.days}</span>}
              {/* report card: grade (grade 1 is hidden to keep it tidy), graduates wear a cap */}
              {s.grade >= 2 && (
                <span className="mr-1 shrink-0 rounded-full bg-[#2563eb] px-[5px] font-extrabold text-white">{s.grade > 12 ? '🎓' : `L${s.grade}`}</span>
              )}
              <span className="truncate">{s.nickname}</span>
              {s.score > 0 && <b className="ml-1 text-[#c2410c]">{s.score}</b>}
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

// Chat bubble above the head (filtered: never an answer, never a banned word)
function ChatBubble({ text, scale }: { text: string; scale: number }) {
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 10, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="pointer-events-none absolute bottom-[calc(100%+30px)] left-1/2 z-30 max-w-[200px] -translate-x-1/2 truncate rounded-[16px] bg-white px-3 py-1 font-semibold text-[#3b2a14] shadow-md"
      style={{ fontSize: 18 * scale }}
    >
      {text}
      <div className="absolute -bottom-[7px] left-1/2 h-[14px] w-[14px] -translate-x-1/2 rotate-45 bg-white" />
    </motion.div>
  );
}

// Flowers: the student stands up, walks to the front, gives the teacher the flowers and walks back (students without a seat walk in from the door)
const PODIUM: [number, number] = [372, 690]; // where the student stands to hand over the flowers, next to her hand (top-left corner of the character)
function FlowerWalk({ v }: { v: StageView }) {
  const w = v.walk;
  if (!w) return null;
  const i = v.seats.findIndex((s) => s.username === w.username);
  const H = 210;
  const from: [number, number] = i >= 0 ? [seatBox(i).x, seatBox(i).y - 40] : [990, 760];
  const g = w.girl ? 'nu' : 'nam';
  return (
    <motion.div
      key={w.at}
      initial={{ left: from[0], top: from[1], opacity: 0 }}
      animate={{ left: [from[0], PODIUM[0], PODIUM[0], from[0]], top: [from[1], PODIUM[1], PODIUM[1], from[1]], opacity: [1, 1, 1, 0] }}
      transition={{ duration: GAME.walkMs / 1000, times: [0, 0.35, 0.65, 1], ease: 'easeInOut' }}
      className="pointer-events-none absolute z-30"
      style={{ width: H * 0.47, height: H }}
    >
      <img src={asset(`/assets/nv/${g}/${POSE[g].vui}.webp`)} className="h-full w-full drop-shadow-[0_4px_3px_rgba(0,0,0,0.3)]" />
      {/* bunch size follows the gift tier */}
      <div className="absolute -right-4 top-[70px] leading-none" style={{ fontSize: 40 * GAME.giftTiers[w.tier].size }}>
        {w.icon}
      </div>
      <div className="nametag" style={{ fontSize: 16, bottom: 'calc(100% - 4px)' }}>
        <span className="truncate">{w.nickname}</span>
      </div>
    </motion.div>
  );
}

// Cheer squad next to the board: with the standWrong switch on, students who answered wrong stand next to the teacher and cheer the class for 3 questions
const STAND_SPOTS = [420, 492, 564, 636, 708, 780];
const STAND_FEET = 880;
function Punished({ v }: { v: StageView }) {
  return (
    <>
      {v.punished.slice(0, STAND_SPOTS.length).map((s, i) => {
        const H = 120;
        const g = s.girl ? 'nu' : 'nam';
        const pose = i % 2 === 0 ? 'chao' : 'vui';
        return (
          <motion.div
            key={s.username}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute z-30"
            style={{ left: STAND_SPOTS[i] - (H * 0.47) / 2, top: STAND_FEET - H, width: H * 0.47, height: H }}
          >
            <motion.img
              src={asset(`/assets/nv/${g}/${POSE[g][pose]}.webp`)}
              animate={{ y: [0, -6, 0], rotate: [-4, 4, -4] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
              style={{ transformOrigin: 'bottom center' }}
              className="h-full w-full drop-shadow-[0_4px_3px_rgba(0,0,0,0.3)]"
            />
            <div className="nametag" style={{ fontSize: 15, maxWidth: 76 }}>
              <span className="truncate">{s.nickname}</span>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

// Vase on the teacher's desk: flowers from students go in, the more flowers the fuller the vase
const VASE_SPOTS: [number, number][] = [
  [0, 0], [-22, 8], [22, 8], [-12, -18], [12, -18], [0, -30], [-30, -10], [30, -10], [-20, -36], [20, -36], [-36, 14], [36, 14],
];
function Vase({ v }: { v: StageView }) {
  const n = Math.min(v.flowers, VASE_SPOTS.length);
  return (
    <div className="pointer-events-none absolute left-[150px] top-[585px] z-[9]">
      {VASE_SPOTS.slice(0, n).map(([dx, dy], i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i === n - 1 ? GAME.walkMs / 2000 : 0, type: 'spring' }}
          className="absolute text-[30px]"
          style={{ left: dx, top: dy }}
        >
          {['🌸', '🌷', '🌹', '🌼'][i % 4]}
        </motion.div>
      ))}
    </div>
  );
}

// Teacher's prizes: fly from her hand down to the desk on both sides of the student
const TEACHER_HAND: [number, number] = [300, 640]; // px stage
function DeskGifts({ desk, x, y, w, show, scale }: { desk: StageView['seats'][number]['desk']; x: number; y: number; w: number; show: number; scale: number }) {
  const size = 34 * scale;
  const deskTop = show - 72 * K + 44 * scale; // desk top: the top edge of the desk (ROWS.y) moved down, inside the student box
  // free spots on the desk on both sides of the student's head (offset from the desk centre): left, right, far left, far right
  const SPOTS = [-40, 40, -58, 58];
  return (
    <>
      {desk.map((g, i) => {
        const left = w / 2 + SPOTS[i % SPOTS.length] * scale - size / 2;
        const top = deskTop - size + (i >= 2 ? 3 : 0) * scale;
        return (
          <motion.div
            key={g.at + g.icon}
            // old gifts (page reload, seat change) are already on the desk and do not fly again
            initial={Date.now() - g.at < 2000 ? { x: TEACHER_HAND[0] - (x + left), y: TEACHER_HAND[1] - (y + top), scale: 2.2, rotate: -30, opacity: 0 } : false}
            animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.3, 1.4, 0.5, 1], opacity: { duration: 0.2 } }}
            className="pointer-events-none absolute drop-shadow-[0_4px_2px_rgba(0,0,0,0.35)]"
            style={{ left, top, fontSize: size, lineHeight: 1, zIndex: 5 }}
          >
            {g.icon}
          </motion.div>
        );
      })}
    </>
  );
}

// Right side, above the first row: today's top chatters (how it is counted is not shown on screen)
function TalkTop({ v }: { v: StageView }) {
  const rows = (v.talkTop ?? []).slice(0, 5);
  return (
    <div className="absolute left-[842px] top-[616px] z-[8] w-[232px] rotate-1 rounded-[14px] border-[3px] border-[#c9a45c] bg-[#fff8e1]/95 px-2 pb-2 pt-3 text-[#4a2c0e] shadow-[0_6px_10px_rgba(0,0,0,0.3)]">
      <div className="absolute -top-[18px] left-1/2 -translate-x-1/2 text-[28px]">📌</div>
      <div className="whitespace-nowrap text-center text-[22px] font-extrabold leading-tight text-[#b45309]">💬 Top chatters</div>
      {rows.length === 0 && <div className="py-2 text-center text-[17px] text-[#8a6a3a]">Comment to get on the board!</div>}
      <div className="mt-1 space-y-[1px]">
        {rows.map((r, i) => (
          <motion.div key={r.username} layout className="flex items-center gap-1 text-[22px] leading-[28px]">
            <span className="w-6 text-center">{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.nickname}</span>
            {/* show the chat points, without explaining how they are counted (owner's change 2026-11-04) */}
            <b className="text-[#c2410c]">{r.points}</b>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Red slogan banner above the blackboard
function Motto({ text }: { text: string }) {
  // text can be changed on the control page: long text gets smaller to fit
  const size = text.length > 34 ? 28 : text.length > 28 ? 33 : 38;
  return (
    <div className="motto absolute left-1/2 top-[168px] -translate-x-1/2 whitespace-nowrap px-10 py-[6px] font-extrabold tracking-wider" style={{ fontSize: size }}>
      {text}
    </div>
  );
}

function GiftBanner({ gift, now }: { gift: GameState['lastGift']; now: number }) {
  const show = gift && now - gift.at < 4000;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={gift.at}
          initial={{ opacity: 0, y: -30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute left-[24px] top-[470px] z-50 max-w-[560px] rounded-[26px] bg-gradient-to-r from-pink-500 to-rose-400 px-6 py-3 text-[30px] font-bold text-white shadow-xl"
        >
          {giftOf(gift.giftName)?.icon ?? '💐'} <span className="inline-block max-w-[300px] truncate align-bottom">{gift.nickname}</span> {X('gave Teacher')} {gift.repeatCount > 1 ? `${gift.repeatCount} × ` : ''}
          {giftOf(gift.giftName)?.say ?? gift.giftName}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// "Love the teacher? Type 1": every student who types it sends a heart up next to her, with a counter
function LoveHearts({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <div className="pointer-events-none absolute left-[60px] top-[330px] z-40 h-[520px] w-[340px]">
      {Array.from({ length: Math.min(n, 30) }, (_, i) => (
        <motion.div
          key={i}
          initial={{ y: 480, opacity: 0, scale: 0.6 }}
          animate={{ y: -20, opacity: [0, 1, 0], scale: 1.2 }}
          transition={{ duration: 2.4, delay: (i % 6) * 0.15, repeat: Infinity, repeatDelay: 0.4 }}
          className="absolute text-[54px]"
          style={{ left: ((i * 67) % 280) + 10 }}
        >
          {i % 3 === 0 ? '💕' : '❤️'}
        </motion.div>
      ))}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pink-500 px-5 py-1 text-[30px] font-bold text-white shadow-lg">
        💕 {n} {X('love Teacher')}
      </div>
    </div>
  );
}

// Fun poll ("type A or B..."): vote card next to the teacher for 15 seconds
function PollCard({ v }: { v: StageView }) {
  return (
    <AnimatePresence>
      {v.poll && (
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          className="absolute left-[16px] top-[640px] z-40 w-[330px] rounded-[20px] border-[3px] border-white bg-gradient-to-br from-sky-500 to-indigo-500 px-4 py-2 text-white shadow-xl"
        >
          <div className="text-center text-[24px] font-extrabold">🗳️ Type a letter to vote!</div>
          {v.poll.map((o) => (
            <div key={o.key} className="flex items-center gap-2 text-[24px] leading-[34px]">
              <b className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-indigo-600">{o.key.toUpperCase()}</b>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <b>{o.n}</b>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Happy birthday: banner across the top of the class, the cake is already on the student's desk
function BirthdayBanner({ v }: { v: StageView }) {
  return (
    <AnimatePresence>
      {v.birthday && (
        <motion.div
          key={v.birthday.at}
          initial={{ opacity: 0, y: -40, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="absolute left-1/2 top-[620px] z-50 w-[900px] -translate-x-1/2 rounded-[30px] border-4 border-white bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-6 py-4 text-center font-extrabold text-white shadow-2xl"
        >
          {/* the banner text is set on the control page; {name} (or {ten}) inserts the name */}
          {/\{(ten|name)\}/.test(v.cfg.birthdayText) ? (
            <div className="line-clamp-2 text-[50px] leading-tight drop-shadow">{v.cfg.birthdayText.replace(/\{(ten|name)\}/g, () => v.birthday!.nickname)}</div>
          ) : (
            <>
              <div className="text-[46px] leading-tight">{v.cfg.birthdayText}</div>
              <div className="mt-1 truncate text-[54px] leading-tight drop-shadow">{v.birthday.nickname}</div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Fun Gen Z / office-life wishes rotating on the goodbye board (always with a follow-for-notifications call)
const GOODBYE_QUOTES = [
  '🎒 Pack your bags, eat well, sleep well, and FOLLOW the channel to get notified for the next class! 🔔',
  '💸 Sleep well, no deadline nightmares! Hit FOLLOW so the bell rings for the next class! ✨',
  '🪑 Want a front row seat next time? FOLLOW the channel to get notified the moment class opens! 💕',
  '🏆 Ten spirit points for everyone! FOLLOW the channel so you are on time for the next class! 💯',
];

// "Say goodbye / End of class" button on the control page (pressed before ending the live): a fun end-of-school ceremony
function GoodbyeBanner({ v, now }: { v: StageView; now: number }) {
  const g = v.goodbye;
  const leftSec = g ? Math.max(0, Math.ceil((g.at + GAME.goodbyeBannerSec * 1000 - now) / 1000)) : 0;
  const quoteIdx = Math.floor(now / 4500) % GOODBYE_QUOTES.length;
  // Top 3 students of the session (sessionTop first, otherwise by seat)
  const top3 =
    v.sessionTop && v.sessionTop.length > 0
      ? v.sessionTop.slice(0, 3).map((s) => ({ nickname: s.nickname, pts: s.session }))
      : v.seats
          .filter((s) => s.score > 0)
          .slice(0, 3)
          .map((s) => ({ nickname: s.nickname, pts: s.score }));

  return (
    <AnimatePresence>
      {g && (
        <motion.div
          key={g.at}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-[65] overflow-hidden"
        >
          {/* 1. Confetti & end-of-school icons raining down */}
          {Array.from({ length: 18 }, (_, i) => {
            const icons = ['🎉', '🎒', '🧋', '💖', '✨', '🥳', '🌸', '🏆', '💯'];
            const left = 40 + ((i * 59) % 1000);
            const delay = (i % 6) * 0.28;
            return (
              <motion.div
                key={`float-${i}`}
                initial={{ y: 1750, x: 0, opacity: 0, scale: 0.6, rotate: -20 }}
                animate={{
                  y: 180,
                  x: [0, i % 2 === 0 ? 28 : -28, 0],
                  opacity: [0, 1, 1, 0],
                  scale: [0.7, 1.15, 0.9],
                  rotate: [0, i % 2 === 0 ? 25 : -25, 0],
                }}
                transition={{ duration: 3.4 + (i % 3) * 0.4, delay, repeat: Infinity, ease: 'easeOut' }}
                className="absolute text-[52px] drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]"
                style={{ left }}
              >
                {icons[i % icons.length]}
              </motion.div>
            );
          })}

          {/* 2. End-of-school ceremony card in the middle of the screen */}
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.65 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 210, damping: 15 }}
            className="absolute left-1/2 top-[480px] w-[940px] -translate-x-1/2 rounded-[36px] border-[6px] border-[#fef08a] bg-gradient-to-br from-[#be185d] via-[#7e22ce] to-[#1d4ed8] p-5 text-center text-white shadow-[0_20px_50px_rgba(0,0,0,0.65),0_0_40px_rgba(250,204,21,0.55)]"
          >
            {/* School-bell badge on top */}
            <div className="absolute -top-[34px] left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border-4 border-white bg-gradient-to-r from-[#f59e0b] via-[#ef4444] to-[#f59e0b] px-7 py-1.5 text-[28px] font-black tracking-wide text-[#fef08a] shadow-[0_6px_16px_rgba(0,0,0,0.45)]">
              <motion.span
                animate={{ rotate: [-18, 18, -18], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.45, repeat: Infinity }}
                className="inline-block text-[38px]"
              >
                🥁
              </motion.span>
              <span>DING! DING! DING! THE FINAL BELL</span>
              <span className="rounded-full bg-black/30 px-3 py-0.5 text-[22px] text-white">⏳ {leftSec}s</span>
            </div>

            {/* Main title + two waving hands */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <motion.span
                animate={{ rotate: [-20, 20, -20], scale: [1, 1.15, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="inline-block text-[66px] leading-none"
              >
                👋
              </motion.span>
              <div>
                <div className="text-[48px] font-black leading-tight text-[#fef08a] drop-shadow-[0_4px_0_rgba(0,0,0,0.45)]">
                  CLASS DISMISSED! SEE YOU NEXT TIME 💕
                </div>
                <div className="mt-1 text-[25px] font-bold text-pink-100">
                  {`${shownTeacherName(v.cfg)} thanks the class for learning and partying so hard today!`}
                </div>
              </div>
              <motion.span
                animate={{ rotate: [20, -20, 20], scale: [1, 1.15, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="inline-block text-[66px] leading-none"
              >
                🎒
              </motion.span>
            </div>

            {/* Rotating funny wishes */}
            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-auto mt-3 max-w-[860px] rounded-[20px] border-2 border-white/35 bg-black/25 px-5 py-2.5 text-[27px] font-extrabold text-[#fde047] shadow-inner"
              >
                {GOODBYE_QUOTES[quoteIdx]}
              </motion.div>
            </AnimatePresence>

            {/* Top 3 Today honour board + quick class stats */}
            {top3.length > 0 && (
              <div className="mt-3.5 rounded-[22px] border-2 border-[#fde047]/60 bg-white/15 px-4 py-2.5 backdrop-blur-sm">
                <div className="text-[22px] font-black uppercase tracking-wider text-[#fef08a]">
                  👑 TODAY'S HONOR ROLL 👑
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-3">
                  {top3.map((st, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 rounded-[16px] px-3 py-1.5 text-left shadow-md ${
                        idx === 0
                          ? 'border-2 border-[#fde047] bg-gradient-to-r from-amber-500/90 to-yellow-500/90 text-[#451a03]'
                          : 'border border-white/40 bg-white/90 text-[#1e1b4b]'
                      }`}
                    >
                      <span className="text-[32px] leading-none">{['🥇', '🥈', '🥉'][idx]}</span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-[22px] font-black">{st.nickname}</div>
                        <div className={`text-[19px] font-extrabold ${idx === 0 ? 'text-[#7c2d12]' : 'text-[#c2410c]'}`}>
                          ⭐ {st.pts} points
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Class stats bar + blinking follow call */}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 rounded-full border-2 border-white/40 bg-black/30 px-5 py-2 text-[23px] font-extrabold text-white">
                <span>👥 Class size: {v.classSize}</span>
                <span>·</span>
                <span>💝 Flower fund: {v.fund.today}</span>
              </div>

              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.85, repeat: Infinity }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border-[3px] border-[#fef08a] bg-gradient-to-r from-[#ec4899] via-[#f43f5e] to-[#f59e0b] px-5 py-2 text-[23px] font-black text-white shadow-lg"
              >
                <span>➕</span>
                <span>FOLLOW the channel to get notified for the next class! 🔔</span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Claps() {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {Array.from({ length: 14 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ y: 1500, opacity: 0 }}
          animate={{ y: 700, opacity: [0, 1, 0] }}
          transition={{ duration: 2.2, delay: (i % 7) * 0.25, repeat: Infinity }}
          className="absolute text-[70px]"
          style={{ left: 60 + i * 70 }}
        >
          👏
        </motion.div>
      ))}
    </div>
  );
}
