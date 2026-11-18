// =====================================================
//  LIVE-CLASS SETTINGS: numbers. Teacher lines live in lines.ts, questions in word-bank/*.txt
// =====================================================

/** Class settings from the control panel (saved in settings.json): teacher name + voice, red banner, the 2 big shows, custom background */
export interface RoomCfg {
  teacherName: string;
  teacherVoice: 'nu' | 'nam';
  motto: string;
  everest: boolean;
  chuong: boolean;
  bg: string; // custom background file in data/backgrounds/, empty = default classroom
  /** who teaches: 'co' Ms. Ngan, 'thay' Mr. Minh (male voice everywhere, "Ms." becomes "Mr.") */
  teacher: 'co' | 'thay';
  /** hall monitor: a student silent for supervisorMin minutes gets a break, the most active waiting student takes the seat */
  supervisor: boolean;
  supervisorMin: number;
  /** dance & hearts recess: 'off', 'mix' (alternates with other games), 'always' (every recess) */
  dance: 'off' | 'mix' | 'always';
  danceText: string; // banner text on screen
  danceSec: number; // dance time (seconds)
  /** birthday banner title; "{ten}" is replaced by the student's name (then no extra name line is shown) */
  birthdayText: string;
  /** wrong answer in class = stand at the front for 3 questions (off by default, can be turned on in the panel) */
  standWrong: boolean;
}

/** name on the badge / in the lines: male teacher but the name still says "Ms ..." -> use the default male name */
export function shownTeacherName(c: RoomCfg) {
  return c.teacher === 'thay' && /^(ms|miss|mrs)\.?(\s|$)/i.test(c.teacherName) ? GAME.defaultThayName : c.teacherName;
}

export const GAME = {
  // Default class name (on the sign at the top). Change it in the panel.
  defaultChannelName: 'LIVE CLASS',
  defaultRoom: {
    teacherName: 'Ms. Ngan',
    teacherVoice: 'nu',
    motto: 'LISTEN FIRST, THEN TYPE TO SCORE',
    everest: true,
    chuong: true,
    bg: '',
    teacher: 'co',
    supervisor: true,
    supervisorMin: 4,
    dance: 'mix',
    danceText: 'Everyone dance and send hearts to stay healthy! 💪❤️',
    danceSec: 30,
    birthdayText: '🎉 Happy Birthday 🎂',
    standWrong: false,
  } as RoomCfg,
  defaultThayName: 'Mr. Minh', // male teacher selected while the name still says "Ms ..."
  // ---------- Hall monitor ----------
  escortMs: 9000, // the monitor walks in, takes a student to the door, the new student walks to the seat
  escortGapMs: 40_000, // at least this long between two visits
  escortSayEveryMs: 120_000, // automatic visits: the teacher announces it at most every 2 minutes, other visits are silent
  // ---------- Dance recess ----------
  dancers: 10, // students who come up to dance (seated and still active)

  // ---------- One class ----------
  questionsPerRound: 20,
  // 5 plain word questions (2 easy, 1 medium, 2 hard) + 5 emoji puzzles + 4 mental math (getting harder)
  // + 2 spelling + 2 history + 2 riddles in a row (right after the mid-class shout-out). Question 20 is golden (double points).
  roundPlan: [
    'easy', 'dh', 'anh', 'easy', 'math1',
    'dh', 'medium', 'su', 'dh', 'math2',
    'meo', 'meo', 'anh', 'dh', 'math3',
    'hard', 'su', 'dh', 'math4', 'hard',
  ] as const,
  introSec: 5, // teacher's intro at the start of a class
  // ---------- Quick mode: viewers drop in on a break, keep questions flowing ----------
  // true: short reading ("Question 3. Food. <clue>"), no "go!"; when the teacher finishes reading the board appears and the clock runs.
  // false: classic (read, then "go!" shows the letters, clock stopped while she talks)
  quickRead: true,
  closeAfterTopN: 5, // when this many got it right, close the question closeAfterTopSec later. 0 = off
  closeAfterTopSec: 3,
  earlySendGraceMs: 500, // answers sent this much earlier than the board appeared (by send time) do not count
  earlyCheckWindowMs: 3000, // ...but only for comments arriving in the first few seconds after the board appears
  dhFirstLetters: true, // emoji puzzles: show the first letter of each word in the answer boxes
  praiseShort: true, // mid-class shout-out in one line (top 3)
  questionSec: 20, // answer time
  endAfterFirstSec: 0, // 0 = always the full time. e.g. 10: close 10 s after the first correct answer
  // Auto pace: fewer than 5 active players (commented in the last 2 minutes) -> close 8 s after the first correct answer
  smallRoomPlayers: 5,
  smallRoomEndAfterSec: 8,
  activeWindowMs: 120_000,
  // Empty class: 5 minutes with no comment / gift / heart -> next class is "review" (old questions, saves the new ones).
  emptyRoomMs: 5 * 60_000,
  timeGreetEvery: 4, // besides when the time of day changes, greet by time of day every this many classes
  // Filling silence while waiting for word answers: every this often the teacher does something, in turn
  engageEveryMs: 180_000,
  engageOrder: ['love', 'story', 'poll', 'sleep'] as const, // 'sleep': wake up a dozing student (nobody asleep -> a fun fact)
  loveWindowMs: 15_000, // count who types in this window, then thank / read the result

  // ---------- Students on screen ----------
  walkMs: 6000, // flower gift: the student walks up to give it to the teacher, then back
  bubbleMs: 5000, // chat bubble over the head (never shows answers or banned words)
  sleepAfterMs: 5 * 60_000, // silent this long -> dozing 💤, sometimes the teacher wakes them up
  // wrong answer: stand at the front for standQuestions questions; at most standMax students at once
  standWrong: false, // default for a new class; live it follows the "Stand at the front" switch (RoomCfg.standWrong)
  standQuestions: 3,
  standMax: 6,
  bonusSec: 10, // time up and nobody right: reveal 1 letter, add this many seconds
  praiseEvery: 10, // every this many questions: mid-class shout-out for the top 3 with prizes
  praiseSec: 3, // pause after the shout-out
  giftChance: 0.4, // chance the teacher gives a prize to the first correct student / a streak milestone
  deskGifts: 4, // prizes shown per desk (newest)
  warnLeftSec: 5, // "almost out of time" at this many seconds left (clock keeps running)
  revealSec: 5,
  resultsSec: 8,
  superFastSec: 4, // correct within the first 4 seconds: "genius!"

  // ---------- Points ----------
  // fastest 5: 10, 7, 5, 3, 3; later correct answers +1. Golden question x2
  rankPoints: [10, 7, 5, 3, 3],
  latePoints: 1, // correct after the top 5 (often copied from the chat)
  fastestShown: 5, // "Top fastest" board on the answer screen
  // streak praise + bonus at 5, 12, 17 correct in a row
  streakMilestones: [5, 12, 17],
  streakBonus: 5,
  streakNamesRead: 3, // several players hit a streak at once: one line, at most this many names ("and N others")
  requireDiacritics: true, // (Vietnamese edition setting; English answers have no accents so it changes nothing)
  keepHiddenLetters: 2, // hints never reveal more than (letters - 2)
  roastChance: 0.2, // chance the teacher teases one wrong answer when revealing
  monitorEveryQ: 4, // new class monitor: announce at most every this many questions

  // ---------- Recess (after every class) ----------
  recessPlaySec: { rps: 15, callup: 12, pick: 15, roll: 10, heart: 20, dance: 30 }, // dance: from the class settings (danceSec)
  recessResultSec: 5,
  recessBoardSec: 5, // "Top students today" board
  rpsPoints: 2, // beat the teacher at rock-paper-scissors
  callUpPoints: 5, // pop quiz answered right
  rollPoints: 3, // speed roll call
  rollWinners: 10,
  heartTarget: 300, // heart challenge
  heartBoost: 5, // every real heart counts as 5 (300 hearts = 60 real taps) so the class can win; also used for applause

  // ---------- After recess: the class votes for the next topic ----------
  voteSec: 10, // type 1 or 2
  voteTopicQuestions: 5, // the winning topic fills this many plain questions of the next class
  // audience is Gen Z + office workers: a share of plain questions comes from these sets
  hotTopics: ['16-gen-z', '32-office-life', '33-trends', '34-food-and-love'],
  hotShare: 0.5, // share of plain questions drawn from hotTopics; a topic the class voted for still comes first

  // ---------- Teams ----------
  // Before a class: this many seconds to pick a team ("team 1".."team 4", "t2", "3", "team three"). Others get the smallest team.
  // Students who join mid-class are placed right away. 0 = no team picking.
  teamPickSec: 20,
  teamPickEvery: 4, // only classes 1, 5, 9... have team picking (teams are kept between classes)
  teamCount: 4,
  teamRemindLeftSec: 15, // reminder at this many seconds left

  // ---------- Ms. Ngan's outfits ----------
  // after 20 questions (class summary) she changes into another outfit; images in public/assets/nv/co-ngan/<outfit>/
  outfits: ['trang', 'so-mi', 'ao-dai-xanh-ngoc'] as const,

  // ---------- The 2 big shows: Road to Everest, Golden Bell ----------
  // every this many classes a show replaces recess (they alternate), then the topic vote as usual.
  // Type A/B/C/D; everyone right within the time scores, speed does not matter. Questions in src/game/show-bank/.
  showEvery: 4,
  show: {
    gatherSec: 30, // gather / invite into the arena
    revealSec: 5, // answer screen per question
    tieSec: 10, // tiebreaker when the top players are tied
    honorSec: 30, // award ceremony
    topShown: 10,
    everest: {
      warm: { n: 4, sec: 8, pts: 10 }, // First Steps
      code: { hintSec: 15, pts: [30, 20, 10], rescueSec: 10, rescuePts: 5 }, // Base Camp Password: 3 clues + 10 s rescue
      storm: { n: 4, sec: 8, pts: 15 }, // Speed Storm
      peak: { n: 3, stakeSec: 8, sec: 12, stakes: [10, 20] }, // Summit: pick your points before seeing the question
    },
    chuong: {
      warm: { n: 4, sec: 8, pts: 10 }, // Warm-up
      hold: { n: 6, sec: 10, pts: 10 }, // Hold Steady
      rescue: { sec: 10 }, // Rescue: right answer = 1 hint ticket
      final: { n: 3, sec: 15, pts: 20 }, // Final Challenge: type "hint" to remove 2 wrong answers for everyone
      bell: { sec: 15, pts: 30 }, // Golden Bell question
    },
  },

  // ---------- Attendance, birthdays ----------
  attendMilestones: [3, 5, 7, 10, 14, 21, 30], // days in a row -> big praise + prize
  birthdayCooldownMs: 60_000, // at least 1 minute between two birthday wishes (anti-spam)
  birthdayBannerSec: 10,
  goodbyeBannerSec: 25, // "Goodbye" button: the end-of-class banner stays this long

  championsKept: 50, // remember the class monitor of this many recent classes

  seatActiveMs: 10 * 60_000, // same score: a student silent longer than this gives the seat to an active one

  // ---------- Lifetime report card: points add up forever -> move up a grade ----------
  // points needed for grade 1, 2, ... 12, then graduation (13). A good player earns about 150-250 points per class.
  gradePoints: [0, 200, 500, 1000, 1700, 2600, 3700, 5000, 6500, 8200, 10000, 12000, 15000],
  // "Top chatters" today: 1 comment = 1 (at most once per 2 s per person), 1 gift = 10. The formula is never shown.
  talkGapMs: 2000,
  talkPerGift: 10,
  // big rooms: students silent this long are removed when a new class starts (their points are already saved)
  forgetAfterMs: 2 * 60 * 60_000,

  // ---------- Classroom ----------
  seats: 30, // 4 long desks (7, 7, 8, 8 students)
  rowSeats: [7, 7, 8, 8],
  // no seat left: they still play and score, shown in the "In class · Waiting" box
  standing: 0,
  joinKeywords: ['joinclass', 'join'],

  // ---------- Gifts: bouquet tiers + the class flower fund ----------
  // tier by the coins of the gift (diamonds x count). Every coin = 1 flower in the fund.
  // "Gifts for Teacher" board: a few common TikTok gifts, written as gifts — no begging, no promised advantage
  // (TikTok forbids encouraging gifts, especially from kids). match = TikTok gift name (any case),
  // say = what the teacher reads, icon = what the student carries up, thanks = its own thank-you group in lines.ts.
  giftMenu: [
    { match: ['rose'], icon: '🌹', label: 'Rose', say: 'a rose', caption: 'Give a rose', thanks: 'thankRose' as const },
    { match: ['finger heart'], icon: '🫰', label: 'Finger heart', say: 'a finger heart', caption: 'Shoot a heart', thanks: 'thankHeart' as const },
    { match: ['doughnut', 'donut'], icon: '🍩', label: 'Donut', say: 'a donut', caption: 'Share a donut', thanks: 'thankDonut' as const },
  ],
  giftTiers: [
    { min: 1, name: 'a flower', label: '🌹 1 flower', icon: '🌹', size: 1 },
    { min: 10, name: 'a small bouquet', label: '💐 Small bouquet', icon: '💐', size: 1.4 },
    { min: 99, name: 'a huge bouquet', label: '💐 Big bouquet', icon: '💐', size: 2 },
    { min: 500, name: 'a whole flower cart', label: '🌸 Flower cart', icon: '🌸', size: 2.6 },
  ],
  // daily flower fund goals; each goal reached = teacher thanks the class + fireworks
  flowerGoals: [50, 100, 200, 500, 1000, 2000, 5000, 10000],
  giftPileMax: 18, // gifts piled behind the teacher (newest)

  // ---------- Gifts / hearts ----------
  // 0 = gifts give NO advantage in the game (TikTok forbids encouraging kids to gift). e.g. 30: a 30-coin gift reveals a letter.
  hintGiftCoins: 0,
  likesPerClap: 300, // 300 hearts: the whole class claps
  clapSec: 5,
  giftThanksCooldownMs: 30_000,
  bigGiftCoins: 99,

  // ---------- Talking ----------
  greetEveryMs: 8000,
  namesPerGreeting: 3,
  shareReminderEveryMs: 6 * 60_000,
  idleAfterSec: 75, // nobody comments for this long: the teacher nudges
  // Voice rhythm: main lines (question, answer, summary) follow the show, the clock stops while she reads.
  // Extra lines (greetings, thanks, teasing) only while waiting for answers with more than 5 s left.
  chatterMinLeftMs: 5000,
  // max extra lines per question / segment (gift thanks, birthdays, grade-ups do not count)
  chatterPerPhase: 1,
  chatterMaxWaitMs: 35_000, // a greeting can wait about one question, then it is dropped
  giftLineMaxWaitMs: 45_000, // gift thanks wait longer
  maxHoldMs: 25_000, // a segment holds the clock at most this long (in case the voice gets stuck)
};
