# LIVE-CLASS (English edition): notes for Claude

> This file describes THIS game only.
> When the channel owner settles a decision (a spoken line, a colour, a rule), add it under "Owner decisions".
> This is the English edition of the Vietnamese game "Lop Hoc Chu". Dates below are from the original project log.

## Idea

A 2D classroom for TikTok LIVE. The teacher (Ms. Ngan, in an ao dai) runs a word quiz: shuffled letters on the blackboard, viewers type the answer in the comments. The fastest right answers score the most points, high scorers sit in the front row.

## Two ways to run it

- **Single HTML file (Blogger / any web page):** `node tools/build-standalone.mjs` builds `dist-standalone/live-class-en.html` (paste into a Blogger post in HTML view) and `dist-standalone/index.html` (full page). `--offline` builds `live-class-en-offline.html` with every image inside (~3 MB). The browser plays the server (`src/standalone/localServer.ts`, saves to localStorage), the teacher talks with the browser's own voices (`src/standalone/speech.ts`), simulated classmates play along (`src/standalone/bots.ts`). Images load from this GitHub repo through jsDelivr, with raw.githubusercontent.com as fallback; `window.LIVE_CLASS_ASSETS` overrides the address. The HTML must stay pure ASCII (Blogger turns non-ASCII into entities and breaks the script): the build escapes everything and fails if anything is left.
- **TikTok LIVE Studio:** `npm install`, then `START-LIVE.bat` (or `npm run dev`). `server.ts` connects to the TikTok live, Edge voices (Jenny / Guy) read the lines.

## Game rules

- Any comment joins the class (name tag above the student). Typing `join` gets a greeting.
- Each class has 20 questions (order in `GAME.roundPlan`): ordinary word questions, emoji puzzles, mental math getting harder, spelling, history, and 2 riddles in a row; question 20 is the golden question (double points). 20 seconds per question. Time up and nobody right: one letter is revealed (never on math) and 10 seconds are added.
- After each class comes recess, one of these games is drawn (never the one just played): rock paper scissors (+2), pop quiz on one seated student (+5), pick a side (just for fun), roll call "here" (first 10 +3), class heart rain, dance break. Then "Top students today".
- Three levels of ranking: class points (seating, cleared every class) · session points (👑 class monitor, ⭐ vice monitors) · weekly honour roll (saved on the server in `data/class-book.json`, or in localStorage in the single-file edition; cleared every new week).
- A comment only counts as an answer when it has exactly as many letters as the answer (spaces ignored), so ordinary chat is never counted as wrong. Only each person's first answer per question counts.
- Points by order of right answers, ranked by the time TikTok stamped on the comment (`createTime`), not by when the bot received it: top 5 get 10 / 7 / 5 / 3 / 3, everyone slower gets +1. Streaks of 5, 12, 17 right answers in a row (`streakMilestones`) get +5 each.
- Gifts are always "flowers for the teacher" (she holds them and says thanks). Gifts give NO advantage in the game (TikTok forbids encouraging children to send gifts) and no points.
- Hearts: every 300 the whole class claps.

## Files

- `src/game/quiz.ts`: game core (phases, scoring, seating). Test: `npx tsx src/game/quiz.check.ts`.
- `src/game/word-bank/*.txt`: about 1,300 questions in 34 topics. Files ending in `-meo` (riddles), `-su` (history), `-anh` (spelling), `-dh` (emoji puzzles) are only asked at their own positions in `roundPlan`. Check: `npx tsx src/game/bank.check.ts` (clues that give the answer away, duplicates, answers over 14 letters, missing "It's a..." lines).
- `src/game/show-bank/`: `multiple-choice.txt` (right answer first, the game shuffles A B C D; groups `[de]` warm-up, `[vua]` medium, `[kho]` hard, `[chuong]` Golden Bell, `[phu]` tiebreaker) and `passwords.txt` for the 2 big shows.
- `src/game/math.ts`: mental math generator, 4 levels. Generated, so it never runs out and is never written to the class book.
- `src/game/lines.ts`: everything the teacher says (dealt like a shuffled deck, so lines rarely repeat). `src/game/config.ts`: all numbers.
- `src/game/teacher-swap.ts`: turns "Ms." lines into "Mr." lines for the male teacher, and puts the teacher's own name in.
- `src/game/sfx.ts`: synthesised sound effects (ting, drum, ticking, bell, gift pop, applause, fanfare, EDM for the big shows). An mp3 with the same name in `public/assets/sfx/` replaces a sound.
- `src/game/GameStage.tsx`: the screen. Desk coordinates are measured on the original 941x1672 background (`ROWS`).
- `src/game/GameControls.tsx`: control buttons, class settings and test buttons ("1000 people guess at once" checks the bot keeps up).
- `src/standalone/`: single-file edition (app shell, in-browser server, browser voice, simulated classmates, motion shim).
- `tools/remove-bg.py` / `tools/remove-bg.mjs`: remove the grey background from the art in `characters/` into `public/assets/nv/`. Run again after changing the art.
- Report page after a live (server mode): http://localhost:3006/report (📊 button on the control page). Files in `data/reports/<day>.json`.
- Test runs that must not touch the real class book: set `DATA_DIR` to another folder.
- The stage page runs the real game and posts snapshots to `/api/game/state`; the control page only redraws that snapshot (so the preview always matches the live).
- `?view=stage&mute=1`: watch the stage without sound.
- Own port **3006** (START-LIVE.bat sets PORT=3006). LIVE Studio link: http://lvh.me:3006/?view=stage.

## Owner decisions

- 20 seconds per question (2026-11-04), always the full time unless enough students are right.
- The class name can be changed on the control page (shown on the sign).
- Teasing: the teacher teases one wrong answer by name on part of the questions; a right answer within the first 4 seconds gets over-the-top praise; after 75 s of silence she says something.
- Points drop with the order of right answers, so copying an answer from the chat is only worth 1 point.
- Students sit with their BACKS to the audience, facing the teacher (2026-11-04). The art only has front views, so the back is the front image flipped with the head removed (`sau-*.webp`), and the hair is drawn in SVG in `src/game/Hair.tsx`: 4 boys' styles, 6 girls' styles, 12 hair colours. The style is fixed per account name.
- No seat left: students still play; the head count shows seated / waiting.
- Red banner with yellow letters above the board: "LISTEN FIRST, THEN TYPE TO SCORE" (can be changed in Class settings).
- Seating: high class points sit at the front; on equal points, active students (a comment within 10 minutes) sit before long-quiet ones, then join order (seats do not jump on every comment).
- Voice follows the show: main lines (class intro, question, answer + teasing at the reveal, summary, recess) are read at once and the clock is HELD while she reads (the 20 seconds start after the question). Greetings, gift thanks, follow thanks and praise for the first right answer are only said while waiting for answers with more than 5 seconds left (`chatterWindow`, `chatterMinLeftMs`); if they wait too long they are dropped.
- 4 mental math questions per class: the board shows the sum in big chalk, viewers type the number; the answer reads the whole sum ("36 plus 47 equals 83").
- Rewards the teacher hands out are listed in `REWARDS` in lines.ts; they fly from her hand onto the student's desk (at most 4 per desk, cleared every class).
- Riddles: 2 in a row mid-class, labelled "🤪 Riddle", with their own reveal / nobody / tease lines. Answers that can be written in several ways list the other spellings.
- History questions: textbook facts only. Details that sources disagree on stay out of the clues.
- "🚫 Drop this question" button (control page): drops the current question, nobody scores, next question, never asked again (class book `banned`). Editing the answer in the file makes it a new question. Math cannot be dropped.
- Automatic pace: with fewer than 5 active players (comment within 2 minutes) a right answer closes the question 8 s later; busy rooms run the full 20 s.
- Attendance: the first comment of each session is recorded; from day 2 the teacher recognises the student, milestones 3, 5, 7, 10, 14, 21, 30 days get loud praise + a gift. The name tag shows 🎒 days.
- Birthdays: a comment with "birthday" (but not "happy"/"wish"/"congrats") gets a wish, a cake 🎂 on the desk, applause and a 10 s banner. Once per student per session, at least 1 minute apart. The control page has a box for the owner to wish someone by name.
- Topic vote: after recess, 15 s to vote between 2 topics (type 1 or 2); the winner fills the ordinary word questions of the next class.
- Sounds are synthesised in the browser, quieter than the teacher (sfx volume 0.35).
- Class monitor / vice monitor only count the 20 questions of the current class; the race starts over every class. At the end of recess a board shows the monitor of every class (👑xN for repeat monitors). The weekly honour roll keeps adding up.
- Spelling questions: the reveal reads the English word in the English voice ("| E: word | F:" in the lines).
- Empty class: 5 minutes without comments/gifts/hearts makes the next class a "review" (old questions, no new ones used); when someone joins, new questions from the next one.
- Greeting by time of day: morning 5-10, noon 10-13, afternoon 13-17, evening 17-22, late night 22-5; greets when the part of the day changes or every 4 classes.
- "Love the teacher? Type 1": every 4 minutes, only while waiting for word answers (not math, where numbers count as answers); counted for 15 s, hearts float up, she thanks by name.
- All-day lives: the server reconnects to TikTok after a drop (15 s, 30, 60, at most every 2 minutes) and remembers the account in settings.json; "Disconnect" stops that. START-LIVE.bat restarts the server if it stops.
- "🏆 Top students this class" note pinned top-left above the teacher: only this class's points, top 4.
- Filling silence (every 100 s while waiting for word answers), rotating: "type 1" / fun fact / fun poll / waking up a dozing student.
- Student interaction: gifts make the student walk up to the teacher and back, the flowers go in the vase on her desk (at most 12); the first right answer jumps; comments show as a 5 s bubble (never answers or banned words); 5 minutes quiet shows 💤.
- Hearts x5 (`GAME.heartBoost`) for the class applause milestones.
- Long desks + benches: 4 rows of 7, 7, 8, 8 = 30 seats (`GAME.rowSeats`), students drawn smaller (KID = 0.82), desks drawn in SVG over the single desks of the background (`LongDesk`). 45 seats were tried on 2026-11-07 and rejected (everything too small); keep 30.
- Edge voice gets blocked (error 429) when called in bursts: the server sends one line at a time, shares identical lines, waits 2/5/10 s and retries; then falls back to Google English (never cached). Logged as "[backup voice]".
- Teacher art: `characters/co-giao-ngan/` (16 poses), background removed into `public/assets/nv/co-ngan/`. Pose by situation in `teacherPose` (GameStage.tsx): introducing, pointing at the board while waiting, thumbs up when someone is right, shrug when nobody is, scratching her head for extra time, laughing behind her hand for flowers, both arms up for gifts / the golden question, clapping, waving at team pick. Pink name badge "🌸 Ms. Ngan" on her chest.
- Teams: 4 teams, picked in `team` phase (`GAME.teamPickSec`) by typing "team 1".."team 4" / "t2" / "3" / "team three", changes allowed. With 15 s left she reads the team sizes. At the end everyone without a team goes to the smallest one (counting students active in the last 10 minutes). Students joining mid-class get a team at once. Teams are kept across classes.
- Team race: team points = sum of the class points of its students. "🚩 Team race" board pinned right of the blackboard, the leader gets 👑. The best team of each class wins a 🚩 (ties all win). Name tags show a team colour dot (1 red, 2 blue, 3 green, 4 yellow).
- Lifetime report card: points keep adding up on the server (class book `life`) -> grade 1..12, then graduated (`GAME.gradePoints`), shown as L2, L3.. on the name tag; a new grade gets a wish + 🎓 on the desk. Badges for right answers: 50 math, 30 history, 30 riddles, 30 spelling, 300 total. Typing "reportcard" makes the teacher read it (once per 5 minutes per student).
- "💬 Top chatters" today on the right above the first row: 1 comment = 1 (at most once per 2 s per student), 1 gift = 10. Shows the score next to the name, NOT how it is counted.
- Busy rooms: students quiet for over 2 hours are removed from the class at the next class (their points are on the server). Tested with 13,000 people: 0.8 ms per frame.
- Teacher personality (lines.ts): 26, Gen Z teacher, sassy but sweet, teases but loves her students. Running jokes: broke at the end of the month, bubble tea addict, scared of Mondays and parent meetings, secret crush on the PE teacher, hates people who copy answers from the chat. The audience is Gen Z + office workers (salary, deadlines, bosses, meetings, sales, crushes). Rewards are bubble tea, coffee, free-delivery vouchers, instant noodles...
- Gifts: every coin = 1 flower in "💝 Class fund" today (milestones 50/100/200/500/1000...; a milestone gets a banner + fireworks + thanks). Tiers by coins: 1 flower 🌹, from 10 a small bunch 💐, from 99 a big bunch, from 500 a flower cart 🌸. The student walks up with the flowers and back, she thanks by tier. No zoom, no close-up frame. Gifts are lined up at the left door behind her (at most 18).
- Emoji puzzles: in `31-emoji-dh.txt`, the clue column is the emoji string shown big on the board, no shuffled letters, the emoji are not read out. The first letter of each word is shown in the answer boxes (`dhFirstLetters`).
- Outfits: white / shirt (`so-mi`) / jade ao dai (`ao-dai-xanh-ngoc`), changing at random after each class (`GAME.outfits`). Shirt and jade poses have other names: mapped through `OUTFIT_POSE` in GameStage.tsx.
- 2 big shows replace recess every `GAME.showEvery` classes, alternating "Road to Everest" and "Golden Bell", followed by the topic vote. "Play now" button on the control page. Type A/B/C/D ("answer b", "pick c" work too); everyone right within the time scores, one answer per account per question; points go to the session + report card. Same voice rhythm as class: her reading holds the clock, "go" starts it.
  - Everest: gather 30 s · First steps 4 questions 8 s +10 · Base camp password, 3 clues 15 s (30/20/10 points, one guess per clue), unsolved means a 10 s rescue (first letter shown, +5, "Guide" title) · Speed storm 4 questions 8 s +15 · Summit 3 questions, betting 10 or 20 before each (no bet = 10) · tiebreaker if the top is tied · honours: 🚩 Everest summiter, ⛰️ climbing team (top 10). The top 10 climb a mountain under the board.
  - Golden Bell: warm-up 4 questions 8 s +10 · hold on 6 questions 10 s +10 · rescue for the room 1 question (hint ticket, "Helper" title) · final challenge 3 questions 15 s +20 (ticket holders type "hint": 2 wrong options removed for everyone, once per question) · Golden Bell question 30 points (right = rings the bell) · tiebreaker · honours 🔔 Bell keeper, 💪 Iron player. Titles show as icons on the name tag for the whole session.
  - Music: synthesised EDM (kick, clap, hi-hat, bass, arp; Everest 128 BPM, Golden Bell 140 BPM), backs off while she talks, full while waiting, rushing in the last 5 s. Plus whoosh, boom, chimes and gong.
- "🎪 Class events" board next to the channel name: lists the 2 shows, the next one highlighted, "Next: after class N" / "Right after this class!" (blinking) / "Happening now". At the start of a class that ends with a show she warns by voice (`showSoon`).
- Top 5 fastest board at the reveal: name, time to the millisecond (from "go"; TikTok time converted with the skew measured from comments, so it can be a few hundred ms high), points; last line "N more right, +1 each".
- The teacher talks less (owner 2026-11-04): one extra line per question / part (`GAME.chatterPerPhase`), the rest expire; gift thanks, birthdays and grade-ups are not capped. Engagement calls every 3 minutes (`engageEveryMs`). New class monitor announced at most every 4 questions (`monitorEveryQ`).
- Blurry text on the live (2026-11-04): switching the stage to CSS `zoom` with a pre-scaled background was TRIED and looked much worse on the live; `transform: scale` is back. Do not try that again.
- Streak praise only at 5, 12, 17; several students at once share one line with at most 3 names (`streakNamesRead`).
- Class settings (control page, "🏫 Class settings" in GameControls.tsx): teacher name, voice (female / male), red banner text, Everest / Golden Bell on/off, custom background. Saved in settings.json under `room` (localStorage in the single-file edition), sent as `roomCfg`, defaults in `GAME.defaultRoom`. With both shows off `nextShow()` is null, recess instead, events board hidden. Custom backgrounds go to `data/backgrounds/` (not in git); the game draws its own blackboard on them.
- Male teacher (2026-11-07): "Teacher" in Class settings picks Ms. Ngan / male teacher (`RoomCfg.teacher`). Art in `characters/thay-giao` (8 poses) -> `public/assets/nv/thay`. Male voice for everything; "Ms." lines become "Mr." lines (`teacher-swap.ts`); a name still starting with "Ms." becomes `GAME.defaultThayName` (Mr. Minh). Poses map through `THAY_POSE`.
- Hall monitor (2026-11-07): a seated student quiet for longer than `supervisorMin` minutes (default 4) is walked out by the hall monitor, one at a time, at least 25 s apart; an active student waiting for a seat takes the place (highest class points, then most interaction). Nobody waiting means nobody is walked out. Walked-out students rejoin the queue when they comment. Not during team pick, big shows or dancing. Art: `characters/thay-giam-thi` -> `public/assets/nv/giam-thi/01-dung.webp`; without it the male teacher is borrowed with another shirt colour and a red "HALL MONITOR" armband. She announces him at most every 2 minutes (`escortSayEveryMs`). Hearts count as interaction.
- Dance break at recess (2026-11-07, game `dance`): 10 seated students dance in front of the board, banner text can be changed, synthesised dance music, counts REAL hearts (no multiplier); half way she reads the count and praises the top sender, at the end a summary + thanks + applause. No points. Settings: off / mixed / every recess, length 10–120 s.
- Class heart rain at recess (2026-11-07): no 300 goal and no multiplier, every real heart counts; at the end she reads the total and thanks the top sender.
- Standing up front for wrong answers: switch "😅 Stand up front" in Class settings (`RoomCfg.standWrong`, default OFF). Off: wrong answers are only teased; switched off mid-class, everyone standing sits down at once.
- Birthday banner text can be changed (`birthdayText`); `{name}` inserts the name.
- Class settings are read BEFORE the first class (the first line used to say the default name).
- "Typed the right answer but it did not count" (fixed 2026-11-07): the early-answer check now only measures clock skew from comments with a real TikTok timestamp (`ChatIn.realTime`; test events carry `test: true`) and only checks comments arriving in the first 3 s after the board shows (`earlyCheckWindowMs`). An answer with the right letters but missing accents does not use up the turn.
- Two voices at once (fixed 2026-11-05): a dropped line is now fully cancelled. Open the stage page in ONE place only (LIVE Studio).

## Quick mode (owner approved 2026-11-05)

Most viewers drop in during a break and just want to answer and race; long talk loses them. Switched with `GAME.quickRead` and the numbers in config.ts.
- Reading: "Question 3. A 7-letter word. <clue>". Spelling: "Spelling! A 5-letter word." Emoji puzzles: "Emoji puzzle! <kind>, N letters." No "go" line.
- The board (clue, shuffled letters, answer boxes) only appears AFTER she finishes reading, and only then answers count; the clock is held while she reads. Answers typed before that do NOT count and do not use up the turn. While she reads the board only shows "Question N" + "Listen".
- Answers SENT before the board appeared (judged by TikTok time + skew) do not count, even if they arrive later (`earlySendGraceMs`). Class questions only, not the big shows.
- 5 right answers close the question 3 s later (`closeAfterTopN`, `closeAfterTopSec`). The answer shows for 5 s (`revealSec`), wrong answers are teased 20% of the time.
- Mid-class praise only after question 10, one line reading the top 3 (`praiseShort`, `praiseQuick`); gifts still go on the desks.
- Team pick 20 s, only in class 1, 5, 9... (`teamPickEvery`). A big show every 4 classes (`showEvery`). Recess + vote ~35 s. Class intro 5 s, summary 8 s.
- While asking: fixed line "💬 Type the answer in the comments · fastest +10" under the Fastest box. Bigger clock (78px). Right answers get a "+10" floating above the student (`gain`).
- Report page has "👀 Viewers per part": every 15 s (part, viewers) is written to `data/reports/<day>-viewers.json`, and viewer change per minute is computed per part, to see which part makes people leave.
- Super-fast praise (right within 4 s), over the top with a shouted part ("^"): math "math genius" (`superFastMath`), spelling (`superFastEnglish`), others `superFast`. Priority, always said.
- With 5 s left she only says a short "Almost out of time!".
- Voice: a line without "M:"/"F:" is the female voice too. Default speed 1.0, adjustable with "Voice speed" on the control page.
- The older tests (quiz.check.ts) run with the old pace (`FAST` at the top of the file); quick mode is tested at the end.
- Riddle segment: 2 riddles in a row at questions 11, 12, right after the praise at question 10. Before question 11 a funny intro (`riddleSegment`), question 12 a short "riddle number two" (`riddleSecond`). While she introduces it the board shows "🤪 RIDDLE TIME · 2 in a row · they still score · Get ready"; labels "🤪 Riddle 1/2", "2/2".
- "For Teacher" board (owner 2026-11-05): narrow column right of the board under the Class fund, 3 items 🌹 Give a rose · 🫰 Shoot a heart · 🍩 Share a donut (`GAME.giftMenu`). Written as a gift list: NO pushing, NO promise of points or advantages (TikTok forbids encouraging gifts). Sending that exact item makes the student carry it up, it is displayed behind her, and she uses its own reply (`thankHeart`, `thankRose`, `thankDonut`). Big gifts (99+ coins) still use the tier thanks.
- Top chatters restart with every new live session: the server remembers the TikTok room id (`today.talkRoom`); a different room id clears the chat points, reconnecting to the same live keeps them.
- Morning greeting: only says good morning and to eat breakfast before work. NEVER invites people who are driving or waiting at a red light to play.
- "👋 Say goodbye (end of live)" button: one goodbye line (`goodbye`; with a class leader `goodbyeTop` names them), applause, end-of-class banner for 25 s (`goodbyeBannerSec`). The game keeps running; the owner ends the live.
