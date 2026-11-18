// =====================================================
//  MS. NGAN'S SCRIPT (English edition). Every situation has several lines; the game deals them like a
//  shuffled deck (the whole pile is used before any line repeats), so long lives rarely sound repetitive.
//  To add a line: copy one line inside the right group. Viewer names are always cleaned first —
//  NEVER paste a raw comment into these lines.
//  Check: npx tsx src/game/quiz.check.ts (counts lines per group, finds duplicates)
//
//  CHARACTER SHEET (keep this voice when writing new lines):
//  - Ms. Ngan, 26, a Gen Z teacher. Sassy but sweet: teases a lot, loves her students, never actually insults anyone.
//  - Calls viewers "class", "everyone", "you guys". Speaks in the first person ("I", "me").
//  - Main audience: Gen Z and office workers. Talks about payday, deadlines, the boss, meetings, Mondays,
//    bubble tea, online sales, crushes.
//  - Running jokes (regulars wait for them): broke before payday; bubble tea with ALL the toppings;
//    dreads Mondays and parent-teacher meetings; secret crush on the PE teacher; hates people who copy
//    answers from the chat.
//  - Catchphrases: "10 points, you're welcome", "wrong, but so confident — respect", "I'll dock your pay... I mean, your points".
//  - "|" splits a line into parts, "^" makes a part louder, "E:" reads a part with the English-word voice, "F:" back to the teacher.
// =====================================================

type L0 = string[];
type L1 = ((a: string) => string)[];
type L2 = ((a: string, b: string) => string)[];
type L3 = ((a: string, b: string, c: string) => string)[];

// Prizes the teacher hands out: she says the name, the icon flies onto the student's desk
export const REWARDS = [
  { name: 'a bubble tea with all the toppings', icon: '🧋' },
  { name: 'an iced latte', icon: '☕' },
  { name: 'a free-shipping voucher', icon: '🎟️' },
  { name: 'an emergency pack of instant noodles for the end of the month', icon: '🍜' },
  { name: 'a lollipop for stress relief', icon: '🍭' },
  { name: 'a hot dumpling', icon: '🥟' },
  { name: 'a slice of cake', icon: '🍰' },
  { name: 'a big red one hundred', icon: '💯' },
  { name: 'a shiny gold star', icon: '🌟' },
  { name: 'a long-distance hug from me', icon: '🤗' },
  { name: 'an imaginary day off', icon: '🏖️' },
  { name: 'a certificate I printed at home', icon: '📜' },
  { name: 'a teddy bear', icon: '🧸' },
  { name: 'a paper crown', icon: '👑' },
];

export const LINES = {
  // ---------- Start of class ----------
  intro: [
    'Settle down, class! Ms. Ngan is here. Fastest correct answer gets the most points, and copying from the chat? I see everything.',
    'New class! Twenty questions, and the last one is worth double. If you are skipping work, skip it properly and study with me.',
    'Phones away, everyone... oh wait, this class runs on phones. Never mind, straight to question one.',
    'Hello class! Today is a little harder than yesterday, because yesterday you guys hurt my feelings.',
    'Class is in! Fastest correct answer gets ten points, slower gets fewer, and copying from the chat gets exactly one point. For effort.',
    'This class has everything: math, spelling, history, riddles, emoji puzzles. It is a buffet, so help yourselves.',
    'Class monitor, tell everyone to stand up. Actually, forget it, we are all tired. Sit down, question one.',
    'If you are dozing, wake up. If you are in an online meeting, mute yourself. New class, scores start from zero.',
    'I am in a great mood because payday is coming. So I will be nice this class... for about five minutes.',
    'The front row is empty! Smart people, come sit up front. Lazy people, sit in the back with me.',
    'The best team wins the class. The losing team buys me bubble tea. I am kidding... probably.',
    'Eyes on the board, class. I scrambled the letters, just like my life at the end of the month. Your job is to put them back in order.',
  ] as L0,

  goldenIntro: [
    'Last question! The golden question, double points. Losing? Turn it around now. Winning? Start sweating.',
    'Here comes the golden question! Double points, and the leaderboard can flip like the price of gold.',
    'Focus, everyone, the last one is worth double. Miss it in the front row and you lose your seat like you lose your salary.',
    'Golden question! I am more nervous than when I am waiting for my paycheck.',
    'Last question, double points. Type fast, but type it right!',
  ] as L0,

  // after reading the question, the teacher starts the clock
  go: [
    'Go!',
    'Clock is running! Go!',
    'Timer on, go!',
    'Three, two, one, go!',
    'Type away, class, go!',
    'Starting the clock, go!',
    'Deadline mode, go!',
  ] as L0,

  // 5 seconds left: short reminder only, no jokes
  timeWarn: [
    'Almost out of time!',
    'Time is almost up, class!',
    'Last few seconds!',
    'Hurry, time is almost up!',
  ] as L0,

  // a student who answered wrong comes up to stand next to the teacher as a fun cheerleader
  roastStand: [
    (n) => `${n} was so close! Come stand next to me and cheer the class on for a few questions!`,
    (n) => `Oops, ${n} slipped a little! Come up to the front and give the class some energy.`,
    (n) => `I invite ${n} to join my special cheer squad for a bit. You will win it back next question!`,
    (n) => `${n}, come stand by the board and help me cheer the class on for a few questions!`,
  ] as L1,
  // wake up a student who has been silent for a long time
  wakeUp: [
    (n) => `Hey ${n}, are you on a break? Wake up and play with me!`,
    (n) => `${n}, I made bubble tea! Wake up and guess some words with the class.`,
    (n) => `Everyone wave at ${n} to wake them up! Must have been working really hard last night.`,
  ] as L1,

  // ---------- Getting people to interact (while waiting for answers) ----------
  loveCall: [
    'If you love your teacher, type the number one, class!',
    'Everyone who loves Ms. Ngan, type one so I can survive until payday!',
    'If you are studying with me right now, type one, I am counting!',
    'If you think I look pretty today, type one. If you do not think so, type one anyway.',
    'I need a little energy, class. Type one for me!',
  ] as L0,
  // c = how many typed, n = a few names
  loveThanks: [
    (c, n) => `Wow, ${c} of you love me, I am touched! Thank you ${n}, that is better than payday.`,
    (c, n) => `${c} people typed one! Thank you ${n}, my battery is fully charged now.`,
    (c, n) => `I saw that! ${n} and friends, ${c} people in total love me. No bubble tea needed today.`,
  ] as L2,

  // fun poll results: l = most popular choice, c = votes
  pollResult: [
    (l, c) => `Results are in: ${l} wins with ${c} votes!`,
    (l, c) => `I counted, ${l} takes it with ${c} votes. The other side, go recruit some allies.`,
    (l, c) => `Oh, ${l} dominates our class, ${c} votes. Noted.`,
  ] as L2,
  pollTie: [
    (c) => `${c} votes and it is a perfect tie! Our class is so fair.`,
    (c) => `A tie, ${c} votes split evenly. I am not judging, I do not want enemies.`,
  ] as L1,

  // fun facts and English tips (1-2 sentences) while waiting for answers. Only facts that are definitely true.
  funFact: [
    'Did you know an octopus has three hearts? Still fewer than the number of times my heart breaks at the end of the month.',
    'Horses can sleep standing up. Just like some of you in afternoon meetings.',
    'Dolphins sleep with one eye open to stay alert. Office workers, please learn this skill.',
    'Honey stored properly basically never goes bad. Unlike promises of a pay raise.',
    'The Sun is actually a star, it just looks big because it is the closest one. Like a deadline: the closer, the bigger.',
    'Your heart beats about one hundred thousand times a day. Probably double when your crush texts you.',
    'Penguins cannot fly, but they are amazing swimmers. Everyone has their own strengths, so do not be sad.',
    'Oceans cover about seventy percent of the Earth. My wallet covers about zero percent of my wishes.',
    'A rainbow has seven colors: red, orange, yellow, green, blue, indigo and violet. Say them all and I will give you ten spirit points.',
    'Bananas are berries, but strawberries are not. Botany is as confusing as my schedule.',
    'A group of flamingos is called a flamboyance. Our class is a flamboyance of geniuses.',
    'Sloths can hold their breath longer than dolphins. Not by trying hard, just by being chill.',
    'Word tip: the word | E: deadline | F: is one everybody in this class already knows by heart.',
    'Word tip: | E: procrastinate | F: means to delay something. I will explain it in detail tomorrow.',
    'Word tip: | E: weekend | F: is the most beautiful word in the English language, in my opinion.',
    'Word tip: | E: hangry | F: means angry because you are hungry. That is me at four in the afternoon.',
    'Word tip: | E: serendipity | F: means a happy accident. Like finding money in an old jacket.',
    'Word tip: | E: overtime | F: is the scariest word in the office. Say it quietly.',
  ] as L0,

  // ---------- Empty class: review with old questions ----------
  reviewIntro: [
    'It is so quiet in here, let us review some old questions. If you just walked in, say hi and I will bring out new ones right away.',
    'Review time! I am asking some old questions again. If you are scrolling by, try one and see if you still remember.',
    'This is a review class. Type join class and I will switch to new questions, no hard feelings, I promise.',
  ] as L0,
  reviewEnd: [
    'Oh, someone joined! Review is over, new questions coming up.',
    'The class is filling up! Enough review, time for fresh questions.',
    'We have people! I thought I would be teaching alone until morning.',
  ] as L0,

  // ---------- Greeting by time of day (at the start of a class) ----------
  timeMorning: [
    'Good morning, class! Remember to eat a proper breakfast before you go to work.',
    'Morning, everyone! Have you had breakfast yet? Eat something first, then go to work.',
    'Good morning! Eat breakfast and drink some water before work, do not run on an empty stomach.',
  ] as L0,
  timeNoon: [
    'Lunch time, class! What are you eating today? Please do not say instant noodles again.',
    'It is lunch break. If you have fifteen minutes before your nap, spend them with me.',
    'So hot outside! Stay in the air conditioning and study with me.',
  ] as L0,
  timeAfternoon: [
    'Good afternoon, class! Raise your hand if you are just waiting for the end of the work day.',
    'Afternoon is the sleepiest time of the day, so I will ask a few questions to wake you up.',
    'It is three or four in the afternoon. If you are craving bubble tea like me, type one.',
  ] as L0,
  timeEvening: [
    'Good evening, class! Work is over, this is our time now. Play with me!',
    'Evening already. Dinner is done and you are lying down scrolling, right? Now that you found me, stay for a class.',
    'Our class is so lively in the evening. Who is going to be class monitor this time?',
  ] as L0,
  timeNight: [
    'It is late, class. If you are still up, you are probably chasing a deadline, so I will keep you company.',
    'It is getting late. One more class and then bed, okay? Work tomorrow.',
    'Still awake at this hour means unfinished work, or texting someone special. I am just asking, I will not tell.',
  ] as L0,

  // ---------- "Goodbye" button (the host presses it before ending the live) ----------
  goodbye: [
    'Ding ding ding! That is the final bell, class! Pack your bags, eat well and sleep well. Remember to follow the channel and turn on notifications so you never miss the next class!',
    'Class dismissed, everyone! Sleep well, no deadline nightmares, and may your paycheck be huge tomorrow. If you have not followed yet, follow the channel now so you get a ping when class starts again!',
    'That is all for today! I am off to get a bubble tea with all the toppings. Hit the follow button so you get notified early next time and grab a front row seat. Bye bye, class!',
    'The bell has rung and today\'s class is over! I love you all so much. Go rest and recharge, and follow the channel so you can join the next competition. Goodbye, class!',
    'Time to go home, my little geniuses! Everyone did great today, ten spirit points for all of you. Do not forget to follow the channel so your phone rings the moment I go live!',
  ] as L0,
  // the top student of the current class gets a shout-out
  goodbyeTop: [
    (n) => `Ding ding ding! That is the final bell, class! A special shout-out to ${n} for leading the class today! Follow the channel now so you get notified early next time and get your revenge!`,
    (n) => `Class dismissed! Give a huge round of applause to today's champion, ${n}! Sleep well, no deadlines, and follow the channel so you get a ping when I go live again!`,
    (n) => `Time for me to close the classroom! ${n} was amazing today and held the front seat the whole time. Follow the channel and turn on notifications so you can take the monitor seat back next time. Bye bye!`,
  ] as L1,
  // ---------- Thank-you lines for the gifts in the "Gifts for Teacher" board, n = name ----------
  thankHeart: [
    (n) => `Oh, ${n} shot a heart right at me! I love you lots, ${n}.`,
    (n) => `Ah, right in the heart, ${n}! I am sending a giant heart right back to you.`,
    (n) => `${n} is sending me hearts! My heart is fluttering, thank you ${n}.`,
    (n) => `Here comes ${n}'s heart! I hope everything goes smoothly for you today, ${n}.`,
    (n) => `Bullseye, right in my heart! A thousand hearts back to ${n}, have a wonderful day.`,
    (n) => `One heart from ${n} and I am not tired anymore. Eat well and sleep well, ${n}.`,
    (n) => `Wow, ${n} shot me a heart! I accept and return it double, may only good luck find you.`,
  ] as L1,
  thankRose: [
    (n) => `${n} gave me such a pretty rose! Thank you, I hope your day is full of joy.`,
    (n) => `Oh, ${n}'s rose smells so nice! Going straight into my vase. Stay as fresh as a flower, ${n}.`,
    (n) => `Thank you ${n}, I will take good care of this rose. Have a smooth day.`,
    (n) => `${n}, I am so touched! May you always bloom like this rose.`,
    (n) => `With ${n}'s rose I am teaching with twice the energy. Thank you, stay safe.`,
  ] as L1,
  thankDonut: [
    (n) => `Ooh, ${n} brought me a donut! As sweet as your heart, ${n}, thank you.`,
    (n) => `${n}'s donut! One bite for me, one bite for the class. May every day be sweet for you.`,
    (n) => `Thank you for the donut, ${n}! I was starving, perfect timing.`,
    (n) => `${n} spoils me so much! A round donut, may everything go round and smooth for you.`,
    (n) => `A donut! ${n} knows I have a sweet tooth. Thank you, have a sweet day.`,
  ] as L1,
  thankTier0: [
    (n, g) => `Thank you so much ${n}, ${g}, how pretty. Now I have the motivation to teach until payday.`,
    (n, g) => `${n} gave me ${g}! I will not complain about my salary today.`,
    (n, g) => `Thank you ${n}, I will keep ${g} safe and not let the PE teacher see it.`,
  ] as L2,
  thankTier1: [
    (n, g) => `Wow, ${n} gave me ${g}! Thank you so much.`,
    (n, g) => `${g}, so beautiful, ${n}! You made my whole day.`,
  ] as L2,
  thankTier2: [
    (n, g) => `Oh my gosh, ${n} gave me ${g}! I am so touched, everyone clap for ${n}!`,
    (n, g) => `${g}, really ${n}? Thank you so, so much, I am the happiest teacher today.`,
  ] as L2,
  thankTier3: [
    (n, g) => `I cannot believe it, ${n} gave me ${g}! Thank you from the bottom of my heart, everyone cheer for ${n}!`,
    (n, g) => `${n}, ${g}! Our class has a major sponsor now. Thank you, truly!`,
  ] as L2,
  // the class fund reached a goal (g = number of flowers)
  fundGoal: [
    (g) => `Our class fund has ${g} flowers today! Thank you all so much for your kindness, teaching you is so much fun.`,
    (g) => `The class fund reached ${g} flowers! I treasure every single one. Thank you, class!`,
  ] as L1,

  // ---------- Report card: new grade (g = "grade 3" / "graduated"), new badge (b = "🧮 Math Whiz") ----------
  gradeUp: [
    (n, g) => `Congratulations, ${n} moved up to ${g}! Everyone clap, that was faster than a promotion at work.`,
    (n, g) => `${n} is so smart, now in ${g}! Here is your graduation cap.`,
    (n, g) => `${n} just reached ${g}! Hard work does get you promoted, at least in my class.`,
  ] as L2,
  badgeNew: [
    (n, b) => `${n} just earned the ${b} badge! Put it on your resume.`,
    (n, b) => `New badge for ${n}: ${b}. Everyone clap!`,
  ] as L2,

  // ---------- Happy birthday (someone types "it's my birthday") ----------
  birthday: [
    (n) => `Oh, today is ${n}'s birthday! Everyone, let us wish them a happy birthday! Here is a cake from me.`,
    (n) => `Happy birthday ${n}! May this year bring a pay raise, fewer deadlines and lots of fun. Everyone clap!`,
    (n) => `Today is a special day for ${n}! Wishing you a joyful year full of love. Cake is on the desk!`,
    (n) => `Class, it is ${n}'s birthday! Let us sing for them. I put a cake on your desk.`,
    (n) => `Happy birthday ${n}! May you answer every question right this year and only meet kind bosses.`,
  ] as L1,

  // ---------- Attendance: coming to class several days in a row (d = days) ----------
  attendBack: [
    (n, d) => `Oh, ${n} is back! ${d} days in a row, more reliable than going to work.`,
    (n, d) => `I remember ${n}, you were here yesterday too. ${d} days in a row now.`,
    (n, d) => `${n} came back! ${d} days in a row, I am touched.`,
    (n, d) => `Hi ${n}, that is day ${d} in a row. Our class has a true fan.`,
  ] as L2,
  // n name, d days, g prize
  attendMilestone: [
    (n, d, g) => `Class, ${n} has come ${d} days in a row without missing one! Here is ${g} for perfect attendance.`,
    (n, d, g) => `Here is our most dedicated student: ${n}, ${d} days in a row! The prize is ${g}.`,
    (n, d, g) => `${d} days in a row, ${n} is amazing! I am giving you ${g}, everyone learn from this.`,
  ] as L3,

  // ---------- The host pressed "Skip this question" ----------
  banned: [
    'Oops, that question was not a good one, let us skip it. Pretend I never said it.',
    'I am changing this question, next one coming right up.',
    'Forget that one, here is a much better question.',
  ] as L0,

  // ---------- The class votes for the next topic (a, b = 2 topics) ----------
  voteIntro: [
    (a, b) => `What should we study next, class? Type one for ${a}, type two for ${b}.`,
    (a, b) => `You decide! One is ${a}, two is ${b}. It is like a company meeting, except here your vote actually counts.`,
    (a, b) => `Pick the topic for the next class: one, ${a}. Two, ${b}. Whichever gets more votes wins.`,
  ] as L2,
  voteResult: [
    (t) => `The class has spoken! This class is all about ${t}.`,
    (t) => `${t} wins! I will ask lots of questions about ${t} for you.`,
    (t) => `By popular vote, this class has lots of ${t} questions. Get ready!`,
  ] as L1,
  voteNobody: [
    'Nobody voted, so I will pick the questions myself.',
    'No votes? Then I will mix all the topics. If you complain, vote next time.',
  ] as L0,

  // ---------- Teams: time to pick a team before the class ----------
  teamIntro: [
    'Before we start, Ms. Ngan is splitting the class into four teams. Type team 1, team 2, team 3 or team 4 in the comments. If you do not pick, I will place you.',
    'Pick your team, class! Four teams, type team 1, team 2, team 3 or team 4. Anyone who does not choose, Ms. Ngan will place for you.',
    'Team competition time! Type team and a number, for example team 3. You have twenty seconds.',
  ] as L0,
  teamRemind: [
    (a) => `Fifteen seconds left to pick a team, class. ${a}`,
    (a) => `Team picking is almost over! ${a} If you have not picked yet, hurry up.`,
    (a) => `Quick, pick a team! ${a}`,
  ] as L1,
  teamClose: [
    (a, b) => `Time is up for team picking! ${a} ${b} Let the competition begin!`,
    (a, b) => `Ms. Ngan is locking in the teams. ${a} ${b} The team with the most points wins this class.`,
    (a, b) => `Done! ${a} ${b} Work together, do not let one teammate carry the whole team.`,
  ] as L2,
  teamWin: [
    (t, s) => `The winner of this class is ${t} with ${s} points. Great job, Ms. Ngan awards you the team flag!`,
    (t, s) => `Team competition: ${t} comes first with ${s} points. Give it up for ${t}!`,
    (t, s) => `${t} wins with ${s} points! Other teams, take the flag back next class.`,
  ] as L2,
  teamNobody: [
    'No team scored this class, try harder next time.',
    'All four teams scored zero. I am as sad as a Monday morning.',
  ] as L0,

  // ---------- The two big shows: Road to Everest, Golden Bell ----------
  // announced at the start of a class: the show comes right after this class (g = show name)
  showSoon: [
    (g) => `Announcement, class: right after this class it is ${g}! Study hard now so you can win later.`,
    (g) => `Everyone, after this class we play ${g}. If you have not followed the channel, follow now so you do not miss it.`,
    (g) => `Get ready, at the end of this class it is ${g}, and the questions are harder than usual!`,
  ] as L1,
  showIntroEverest: [
    'Class, no recess today, we are going mountain climbing! Welcome to the Road to Everest. Type A, B, C or D. Everyone who is right scores, no need to be fast, just be right. Climbing team, assemble!',
    'Let us change it up a bit. Ms. Ngan is in her climbing gear, we are playing Road to Everest. Type one letter, A, B, C or D, only once per question. Whoever reaches the top gets a flag!',
    'The Road to Everest begins! The questions are a bit harder than usual, every right answer takes you higher. One answer per question, if you type twice I only count the first.',
  ] as L0,
  showIntroChuong: [
    'Recess is special today, we are playing Golden Bell! Type A, B, C or D. Everyone who is right scores, nobody gets eliminated. The highest score gets to hold Ms. Ngan\'s bell!',
    'It is Golden Bell time! Type one answer per question, A, B, C or D. Nobody is out, play until the end and you can still ring the bell.',
    'Ms. Ngan has the bell in her hand. Golden Bell begins, the questions are a bit harder than in class, and you only get one answer per question.',
  ] as L0,
  evWarm: [
    'Stage one, First Steps. Four warm-up questions, eight seconds each, ten points for a right answer.',
    'First Steps, everyone, four easy questions, every right answer climbs ten points.',
  ] as L0,
  evCode: [
    'Stage two, the Base Camp Password. I read three clues. Guess it on the first clue for thirty points, the second for twenty, the third for ten. Type the word straight into the comments.',
    'We reached the camp, and we need the password to go on. Three clues, the earlier you guess, the more points. One guess per clue per person.',
  ] as L0,
  evStorm: [
    'Stage three, Speed Storm! Four questions, eight seconds each, fifteen points a right answer. Hold on to the rope.',
    'The storm is here, everyone! Four lightning questions, fifteen points each, daydream and the wind blows you back down.',
  ] as L0,
  evPeak: [
    'Final stage, the Summit! Before each question you choose your points, type ten or twenty. Right answers add exactly what you chose, wrong answers lose nothing. No choice counts as ten.',
    'The summit is close! Three last questions, pick your bet before you see the question: type ten or twenty. Big risk, big reward.',
  ] as L0,
  evStake: [
    'Choose your points for the next question, type ten or twenty.',
    'How much are you betting? Type ten or twenty.',
    'Feeling brave, type twenty. Playing it safe, type ten.',
  ] as L0,
  chWarm: [
    'Part one, Warm-up. Four questions, eight seconds each, ten points for a right answer.',
    'Let us warm up, class, four warm-up questions, ten points each.',
  ] as L0,
  chHold: [
    'Part two, Hold Steady. Six general knowledge questions, ten seconds each, ten points for a right answer.',
    'Now it is Hold Steady, six questions in a row. Stay calm, read the options carefully, then type.',
  ] as L0,
  chRescue: [
    'The Rescue question! No points for this one, but everyone who is right gets a hint ticket. In the Final Challenge, type hint and I will remove two wrong answers for the whole room.',
    'Rescue time, everyone. Get this right and you earn a hint ticket to help the whole class on a hard question later.',
  ] as L0,
  chFinal: [
    'Part three, the Final Challenge. Three hard questions, fifteen seconds each, twenty points for a right answer. If you have a ticket, type hint.',
    'The Final Challenge is here, twenty points per question. If you have a hint ticket, save the class!',
  ] as L0,
  chBell: [
    'And here is the Golden Bell question, thirty points! Get it right and you ring the bell with Ms. Ngan.',
    'The Golden Bell question, the decider, thirty points. Take a deep breath, everyone.',
  ] as L0,
  showGo: [
    'Go!',
    'Type your answer!',
    'Choose now, everyone!',
    'Your turn, class!',
  ] as L0,
  showReveal: [
    (a, n) => `The answer is ${a}. ${n} of you got it right, amazing!`,
    (a, n) => `Correct answer: ${a}. ${n} people got it right.`,
    (a, n) => `${a} is the answer. ${n} of you were right, love you.`,
  ] as L2,
  showNobody: [
    (a) => `The answer is ${a}. Nobody got it, I fooled the whole class on this one.`,
    (a) => `Not a single right answer. It is ${a}, write it down.`,
  ] as L1,
  codeIntro: [
    (n) => `The password has ${n} letters. Here is clue number one.`,
    (n) => `The keyword has ${n} letters, here is the first clue.`,
  ] as L1,
  codeRescue: [
    (f, n) => `Nobody has cracked it, so I am opening a ten second rescue! The password starts with ${f} and has ${n} letters.`,
    (f, n) => `Rescue for the whole room! The first letter is ${f}, ${n} letters. Crack it and you become the guide.`,
  ] as L2,
  codeReveal: [
    (a, n, x) => `The password is ${a}! ${n} of you cracked it, the fastest was ${x}.`,
    (a, n, x) => `The keyword is ${a}. Well done ${x}, ${n} people unlocked the camp in total.`,
  ] as L3,
  codeNobody: [
    (a) => `The password is ${a}. Nobody cracked it, the whole team rests at the camp a little longer.`,
    (a) => `The answer is ${a}. That was hard, I found it hard too.`,
  ] as L1,
  ticketWin: [
    (n) => `${n} of you got a hint ticket. Remember to type hint in the Final Challenge.`,
    (n) => `${n} people earned a rescue ticket, save it for a hard question.`,
  ] as L1,
  ticketUse: [
    (x) => `${x} used a hint ticket! I am removing two wrong answers for everyone.`,
    (x) => `Thanks for the rescue, ${x}, two wrong answers just disappeared.`,
  ] as L1,
  bellRing: [
    (n) => `${n} of you got the Golden Bell question right, Ms. Ngan is ringing the bell for you!`,
    (n) => `Ding ding! ${n} people earned the right to ring the bell!`,
  ] as L1,
  showTie: [
    (x, s) => `Oh, ${x} are tied on ${s} points. Tiebreaker question, only the tied players can answer.`,
    (x, s) => `It is a tie! ${x} all have ${s} points, here comes a tiebreaker.`,
  ] as L2,
  honorEverest: [
    (x, s) => `Today's Everest conqueror is ${x} with ${s} points! I am planting your flag on the summit. The top ten join the Climbing Team!`,
    (x, s) => `The flag is on the summit! Congratulations ${x}, ${s} points. Everyone clap for the Climbing Team!`,
  ] as L2,
  honorChuong: [
    (x, s) => `Today's bell keeper is ${x} with ${s} points! Here is the golden bell, ding ding!`,
    (x, s) => `Congratulations ${x}, ${s} points, ring that bell! The top ten get the Iron Player badge.`,
  ] as L2,
  honorNobody: [
    (g) => `${g} is over and nobody scored. Next time, play along with me, class.`,
    (g) => `That is the end of ${g}, no points this time, I will be waiting next time.`,
  ] as L1,
  honorThanks: [
    (n) => `Thank you to the ${n} players who played with me.`,
    (n) => `${n} of you joined in today, that makes me so happy.`,
  ] as L1,

  // ---------- Riddles ----------
  // opening the riddle segment in the middle of class (2 questions in a row): a little intro first
  riddleSegment: [
    'Riddle time, class! Two questions in a row, scored as usual. Think straight and you miss it, think sideways and you get it.',
    'Time to test your brains! Two trick riddles, still scored, and the answers are full of surprises.',
    'Payday is not here yet, so let us do riddles for fun! Two in a row, full points, let us see who is the sharpest.',
    'Brain twister time! Two riddles, read every word on the board carefully, class.',
    'Get ready, class, two super fun riddles are coming, guess right and you are a legend!',
    'Two riddles in a row! Get both right and I crown you the riddle champion of the class.',
  ] as L0,
  // second riddle of the segment (short, no long intro)
  riddleSecond: [
    'Second riddle, even trickier.',
    'Here is riddle number two, read carefully.',
    'One more riddle, stay sharp.',
  ] as L0,
  riddleReveal: [
    (answer, rest) => `The answer is ${answer}! Who got tricked, raise your hand? ${rest}`,
    (answer, rest) => `${answer}, class! It is a riddle, thinking straight gets you nowhere. ${rest}`,
    (answer, rest) => `It is ${answer}! If you got it, your brain is lightning fast. ${rest}`,
    (answer, rest) => `And the answer is, ${answer}! Just a little trick. ${rest}`,
  ] as L2,
  riddleNobody: [
    (a) => `Hehe, I fooled the entire class! The answer is ${a}.`,
    (a) => `It is ${a}. It is a riddle, you have to think backwards.`,
    (a) => `${a}! One win for the teacher, I am happy today.`,
    (a) => `Nobody? It is ${a}. I am tricking you again next time, be ready.`,
  ] as L1,
  riddleWrong: [
    (n) => `${n} fell for my trick, hehe. No worries, riddles are tough.`,
    (n) => `${n}'s answer sounded so logical, and still walked right into my trap.`,
    (n) => `Oops, ${n} fell into the trap! Think a little differently.`,
  ] as L1,

  // ---------- Spelling questions ----------
  // "| E: word | F:" = read the word with the English-word voice, then the teacher continues
  englishReveal: [
    (answer, rest) => `The word is | E: ${answer} | F: Say it with me, class. ${rest}`,
    (answer, rest) => `It is spelled | E: ${answer}. ${answer}! | F: Well done. ${rest}`,
    (answer, rest) => `The answer is | E: ${answer} | F: Use this word in a job interview and you will impress them. ${rest}`,
    (answer, rest) => `This word is | E: ${answer} | F: Great spelling, everyone. ${rest}`,
  ] as L2,
  englishNobody: [
    (a) => `That one was tricky. The word is | E: ${a} | F: Say it with me, class.`,
    (a) => `Nobody? The word is | E: ${a}. ${a}! | F: Remember it next time.`,
    (a) => `The answer is | E: ${a} | F: Vocabulary homework for everyone tonight.`,
  ] as L1,

  // ---------- Emoji picture puzzles ----------
  pictureReveal: [
    (answer, rest) => `This picture is ${answer}, class! ${rest}`,
    (answer, rest) => `Emoji puzzle: ${answer}! Look closely and you see it. ${rest}`,
    (answer, rest) => `The answer is ${answer}. Clever picture, right? I am complimenting myself. ${rest}`,
  ] as L2,

  // ---------- History questions ----------
  historyReveal: [
    (answer, rest) => `The answer is ${answer}! You remember your history lessons so well. ${rest}`,
    (answer, rest) => `It is ${answer}, class. History is so interesting. ${rest}`,
    (answer, rest) => `${answer}! If you got it, you never slept through history class. ${rest}`,
    (answer, rest) => `And the answer is ${answer}. Remember it, class. ${rest}`,
  ] as L2,

  // ---------- Mental math ----------
  mathIntro: [
    'Math question! If you calculate your salary often, this one is for you.',
    'Change of pace, it is math time. Type the number in the comments.',
    'Mental math! No calculators, no asking the accountant.',
    'A break from letters, let us do some math. Just type the number.',
    'Math question coming. If you get it wrong, now you know why your money never lasts the month.',
  ] as L0,
  mathBonus: [
    'Nobody has it yet? I will give you ten more seconds.',
    'Tough one, huh. Ten more seconds, calculate fast.',
    'Not enough fingers to count on? Ten more seconds.',
    'Ten more seconds. No calculators, I can see everything.',
  ] as L0,
  // answer = the whole sum, e.g. "36 plus 47 equals 83"
  mathReveal: [
    (answer, rest) => `${answer}. ${rest}`,
    (answer, rest) => `And the answer is, ${answer}. ${rest}`,
    (answer, rest) => `Here it is: ${answer}. ${rest}`,
    (answer, rest) => `${answer}, faster than a banking app. ${rest}`,
  ] as L2,
  mathNobody: [
    (a) => `Nobody worked it out? ${a}, class.`,
    (a) => `${a}. No wonder everyone is broke by the end of the month.`,
    (a) => `${a}! The math teacher would be heartbroken to hear this.`,
    (a) => `${a}. Times tables review for everyone tonight.`,
  ] as L1,
  mathWrong: [
    (n) => `${n} was off by just a little! Win it back on the next math question.`,
    (n) => `${n}, did you hit the wrong key? Try again next question.`,
    (n) => `${n} slipped a tiny bit, but I still love the speed!`,
    (n) => `${n} was so close to the right number, keep going next time.`,
  ] as L1,

  // ---------- While asking ----------
  firstCorrect: [
    (n) => `Wow, so fast! ${n} got it first. Ten points, you are welcome.`,
    (n) => `${n} got it right! Ten points, faster than a paycheck hitting the bank.`,
    (n) => `${n} is done while the rest of the class is still staring at the letters. Legendary.`,
    (n) => `${n} is lightning fast. Everyone else, fight for second place.`,
    (n) => `We have a correct answer! It is ${n}. Anyone else?`,
    (n) => `${n} got it! Work that fast and your boss will love you.`,
    (n) => `Spot on, ${n}! Come sit in the front row.`,
    (n) => `${n} grabs ten points. Hurry up, class, before it is all gone.`,
    (n) => `Who allowed ${n} to be this smart? Correct!`,
    (n) => `Oh my, ${n}! I did not even get a sip of my bubble tea yet.`,
    (n) => `${n} scores first. Who is coming second?`,
    (n) => `Correct, ${n}! I see class monitor potential, or department manager potential.`,
    (n) => `${n} is right. Smart, fast typer, I wonder if you are single?`,
    (n) => `Bravo, ${n}! Such a quick brain, must have just had coffee.`,
  ] as L1,

  // correct within the first 4 seconds
  superFast: [
    (n) => `A genius! ${n} heard the question and answered right away.`,
    (n) => `Oh my gosh, ${n} is so fast! We have a pro in this class, everyone.`,
    (n) => `${n} is lightning fast. Typing like that, you must text your crush a lot.`,
    (n) => `I did not even blink and ${n} already got it. Incredible.`,
    (n) => `Everyone clap for the pro, ${n}! Faster reflexes than when the boss calls your name.`,
    (n) => `${n}, what do you eat to be this smart? Share the menu with the class.`,
    (n) => `Superhero ${n} has arrived! An answer in just a few seconds.`,
    (n) => `I bow to ${n}. That fast, you must never miss a flash sale.`,
    // over-the-top praise: "|" splits the line, "^" parts are shouted
    (n) => `Oh my goodness! | ^${n} is the genius of the century! | The question just appeared and boom, answer, I bow down!`,
    (n) => `Stop! Everybody stop! | ^Genius ${n} has appeared! | Ministry of Education, we found a talent!`,
    (n) => `Unbelievable! | ^${n} is faster than Google! | I propose ${n} graduates today!`,
    (n) => `Class, | ^${n} is not a normal human! | Must be an alien sneaking into my class!`,
    (n) => `I have goosebumps! | ^${n} is off the charts! | Who taught you to be this smart, I want their number!`,
  ] as L1,
  // super fast on a math question: math prodigy (over the top)
  superFastMath: [
    (n) => `Oh my! | ^Math prodigy ${n}! | The calculator was not even switched on and you already had the answer!`,
    (n) => `Oh my goodness! | ^${n} is a human calculator! | Accounting firms, hire this talent now!`,
    (n) => `Stop! | ^Professor ${n} has spoken! | Ten years teaching math and I have never seen anyone this fast!`,
    (n) => `Class, | ^${n} calculates faster than a computer! | I nominate ${n} for the international math olympiad!`,
    (n) => `Wow! | ^Supercomputer brain ${n}! | You must have learned the times tables before you were born!`,
  ] as L1,
  // super fast on a spelling question: spelling champion (over the top)
  superFastEnglish: [
    (n) => `Oh my gosh! | ^Spelling champion ${n}! | Faster than a dictionary, everyone!`,
    (n) => `Wow! | ^${n} is the king of words, or the queen of words! | Can I call you teacher now?`,
    (n) => `Stop everything! | ^${n} spells like the wind! | You must have been a dictionary in a past life!`,
    (n) => `Oh my goodness! | ^Word wizard ${n} is here! | You would win any spelling bee!`,
    (n) => `Class! | ^${n} is a walking dictionary! | I had not even opened my book and you were done!`,
  ] as L1,

  quietHalfway: [
    'Why so quiet, class? Is it that hard?',
    'Are you all thinking, or are you skipping work in another tab?',
    'Nobody has it yet. I am a little sad, as sad as my wallet at the end of the month.',
    'Look carefully at the letters on the board, the answer is right there.',
    'Just type a guess, I do not take points away for wrong answers.',
    'Our class is so smart, why is everyone silent on this one?',
    'Where is the back row? You are great at chatting, so answer something!',
    'Half the time is gone. I am waiting as nervously as I wait for my crush to text back.',
  ] as L0,

  bonus: [
    'Too hard, class? I will reveal one more letter and give you ten more seconds.',
    'Okay, okay, I am nice, I will reveal a letter. Only ten more seconds.',
    'The class is stuck. One more letter as a hint, hurry!',
    'Time is up and nobody got it. I am extending the deadline by ten seconds, plus one letter.',
    'One more letter for you. If you still cannot get it, I am going for bubble tea.',
    'Really stuck? One more letter and ten seconds. You can do it.',
    'You guys are making me nervous. One more letter, ten more seconds.',
    'Here is another letter. Look closely and you will get it, class.',
  ] as L0,

  // ---------- Showing the answer ----------
  reveal: [
    (answer, rest) => `The answer is ${answer}. ${rest}`,
    (answer, rest) => `The right word is ${answer}, class. ${rest}`,
    (answer, rest) => `${answer}! That is it. ${rest}`,
    (answer, rest) => `And the answer is, ${answer}. ${rest}`,
    (answer, rest) => `This one is ${answer}. ${rest}`,
    (answer, rest) => `Put the letters back in order and you get ${answer}. ${rest}`,
  ] as L2,
  // the "rest" of the line above: who was fastest
  revealTop: [
    (n) => `First place on this one: ${n}.`,
    (n) => `The fastest was ${n}.`,
    (n) => `Ten points go to ${n}.`,
    (n) => `${n} wins this question.`,
  ] as L1,
  revealCount: [
    (c) => `${c} people got it right.`,
    (c) => `${c} correct answers in total.`,
    (c) => `${c} of you got it, so smart.`,
  ] as L1,

  revealNobody: [
    (a) => `Nobody guessed it? The answer is ${a}, class.`,
    (a) => `It is ${a}! That one was a bit of a challenge, win it back next question.`,
    (a) => `The answer is ${a}. Remember this word so you get full points next time.`,
    (a) => `${a}, class. Let us remember this fun word.`,
    (a) => `Nobody got it. The answer is ${a}. The next one is easier.`,
    (a) => `It is ${a}. No worries, you will bounce right back next question.`,
    (a) => `The answer is ${a}. I picked a sneaky one this time.`,
    (a) => `${a}! Save your energy for the next one, class.`,
    (a) => `It is ${a}. Warm up those fingers for the next question.`,
    (a) => `The answer is ${a}. No problem, try again next time.`,
  ] as L1,

  roastWrong: [
    (n) => `${n} almost had it! Win back ten points next question.`,
    (n) => `${n} slipped a tiny bit. I still love that you jumped in first!`,
    (n) => `I saw ${n} type super fast, fix one letter and it is perfect.`,
    (n) => `${n}, that answer was close, get your points back next time.`,
    (n) => `${n} was wrong, but so confident, I respect it. Ten spirit points.`,
    (n) => `${n} is so enthusiastic. Look a little closer next time and the points are yours.`,
    (n) => `${n}, that word was a bit unusual, right? The next one is easier.`,
    (n) => `${n} missed this one, but I give you bravery points.`,
    (n) => `${n} is probably watching the live and hunting a flash sale at the same time, so a finger slipped.`,
    (n) => `${n} had such a creative guess! Too bad it is not my answer.`,
    (n) => `${n} was wrong, but daring to answer deserves praise.`,
    (n) => `${n}, look at the letters on the board again, you were so close.`,
    (n) => `${n} types like lightning, keep that speed next time and you will be first.`,
    (n) => `I remember ${n} always answers. Go get those ten points next time!`,
    (n) => `${n} is probably working and watching at the same time, so one letter slipped.`,
    (n) => `So close, ${n}. Get ready to win it back next question.`,
  ] as L1,

  // streak of correct answers (milestones 5, 12, 17: GAME.streakMilestones). n = name, k = streak
  streak: [
    (n, k) => `${n} got ${k} in a row! Five bonus points.`,
    (n, k) => `${n} is on fire, ${k} in a row without a miss. Plus five points.`,
    (n, k) => `A streak of ${k} for ${n}! Five bonus points.`,
    (n, k) => `${n}, ${k} in a row, this month's targets hit early. Plus five points.`,
    (n, k) => `Can anyone stop ${n}? ${k} in a row, plus five points.`,
  ] as L2,
  // several players hit a streak on the same question: one line. n = "Mia, Leo and Sam" / "Mia, Leo, Sam and 2 others"
  streakGroup: [
    (n, k) => `${n} all got ${k} in a row! Five points each.`,
    (n, k) => `The ${k} streak club: ${n}. Five points each.`,
    (n, k) => `So many pros in this class: ${n}, ${k} without a miss. Five points for all of you.`,
    (n, k) => `${n} kept it up for ${k} in a row, five bonus points each.`,
  ] as L2,
  // extra line after streakGroup when some of them also got a prize on their desk
  streakGroupGift: [
    'Some of you also got a prize on your desk.',
    'If you got a prize, check your desk.',
    'I also sneaked prizes onto a few desks.',
  ],

  goldenWinner: [
    (n) => `${n} takes the golden question, twenty points!`,
    (n) => `The golden question goes to ${n}! Double points.`,
    (n) => `${n} turns it around on the last question. Twenty points.`,
    (n) => `The golden question belongs to ${n}. Excellent!`,
  ] as L1,

  // ---------- Prizes (placed on the desk). g = prize name, e.g. "a bubble tea with all the toppings" ----------
  firstCorrectGift: [
    (n, g) => `${n} got it! Here is ${g} for you.`,
    (n, g) => `Great job ${n}! I am putting ${g} on your desk.`,
    (n, g) => `${n} was fastest! The prize is ${g}.`,
    (n, g) => `I am giving ${n} ${g}, if you want one too, answer faster.`,
    (n, g) => `${n} was first, here is ${g}. I am only this generous today.`,
    (n, g) => `${n} is so smart, here is ${g}. Do not show your boss.`,
  ] as L2,
  streakGift: [
    (n, g, k) => `${k} in a row, ${n}! Five more points, plus ${g}.`,
    (n, g, k) => `${n}, ${k} in a row! Five points and ${g}, a bonus hotter than a year-end bonus.`,
    (n, g, k) => `A ${k} streak for ${n}! Five points, and ${g} right on your desk.`,
  ] as L3,
  goldenGift: [
    (n, g) => `The golden question belongs to ${n}! Double points, plus ${g}.`,
    (n, g) => `${n} wins the golden question! Twenty points and ${g}.`,
  ] as L2,

  // ---------- Mid-class pause: shout-out to the best students, prizes, then the next question ----------
  praiseIntro: [
    'Let us pause for a moment. Here are the best students so far this class.',
    'Five second break, I am checking the scores like I check my paycheck.',
    'Before the next question, prizes for the top students.',
    'Quick pause, class. Who is leading right now?',
  ] as L0,
  // quick mode: the mid-class shout-out in one line. n = "Mia 40 points, Leo 35 points, Sam 30 points"
  praiseQuick: [
    (n) => `Halfway there! The top three are ${n}. Your prizes are on your desks.`,
    (n) => `Mid-class scores: ${n}. Those three get prizes, everyone else, catch up!`,
    (n) => `Who is leading? ${n}. Prizes handed out, let us keep going!`,
  ] as L1,
  // n name, s points, g prize
  praiseFirst: [
    (n, s, g) => `In first place is ${n}, ${s} points. Here is ${g}.`,
    (n, s, g) => `Leading right now is ${n} with ${s} points. The prize is ${g}.`,
    (n, s, g) => `Top of the class right now: ${n}, ${s} points. I am putting ${g} on your desk.`,
  ] as L3,
  praiseSecond: [
    (n, s, g) => `Second place is ${n}, ${s} points, and gets ${g}.`,
    (n, s, g) => `Right behind is ${n} with ${s} points, here is ${g}.`,
  ] as L3,
  praiseThird: [
    (n, s, g) => `Third place is ${n}, ${s} points, receiving ${g}.`,
    (n, s, g) => `Third is ${n}, ${s} points. Here is ${g} for you.`,
  ] as L3,
  // invite interaction, then wait a few seconds before the next question
  praiseOutro: [
    'Everyone else, keep going. If you want a prize, say hi to your teacher.',
    'If you did not get a prize, send me some hearts and try harder next question.',
    'Everyone clap for the top students. If you want bubble tea, type bubble tea so I can count.',
    'Lots of prizes left, answer fast and you get one. Next question coming.',
  ] as L0,

  // ---------- End of class ----------
  results: [
    (n, s) => `Class is over! The top student this class is ${n} with ${s} points. Everyone clap!`,
    (n, s) => `Class summary: ${n} is first with ${s} points. Amazing!`,
    (n, s) => `There is the bell. First place goes to ${n}, ${s} points.`,
    (n, s) => `${n} wins this class with ${s} points. Your photo goes on the wall of fame, nicer than an employee badge photo.`,
    (n, s) => `Congratulations ${n}, ${s} points, this class's certificate is yours.`,
    (n, s) => `Everyone tried hard, but ${n} tried the hardest. ${s} points, top of the class!`,
    (n, s) => `Time is up! ${n} scored ${s} points. Work this hard and you will be promoted.`,
    (n, s) => `The winner of this class is ${n} with ${s} points. Everyone else, win it back next class.`,
  ] as L2,
  resultsNobody: [
    'Nobody scored this class. Let us try harder next time.',
    'Not a single point. I am going to buy bubble tea to cheer myself up, then teach it all again.',
    'Class is over and the scoreboard is empty. Is our class hibernating?',
    'So sad, nobody got a single question. After recess we try again.',
    'No worries, next class is revenge time.',
  ] as L0,

  newMonitor: [
    (n) => `We have a new class monitor, it is ${n}!`,
    (n) => `${n} takes the lead this class and becomes class monitor.`,
    (n) => `New class monitor! ${n} is now first this class.`,
    (n) => `The monitor title goes to ${n}. Old monitor, try to take it back.`,
    (n) => `${n} is class monitor now. Promoted so fast, I am jealous.`,
    (n) => `The leaderboard changed, ${n} is class monitor.`,
  ] as L1,

  // end of recess: class monitor of the last class (every class starts from zero)
  championBoard: [
    (n) => `The class monitor of the last class was ${n}. Who takes the seat next?`,
    (n) => `${n} was just class monitor. New class, scores reset, everyone has a chance.`,
    (n) => `Congratulations to class monitor ${n}! Everyone, take the title back next class.`,
  ] as L1,
  // n name, k times as class monitor
  championAgain: [
    (n, k) => `${n} has been class monitor ${k} times! Can anyone beat ${n}?`,
    (n, k) => `${n} again, class monitor ${k} times! Held that seat longer than my boss holds his.`,
    (n, k) => `${k} times class monitor, ${n} is incredible. If you want the throne, come next class.`,
  ] as L2,
  weekBoard: [
    (n) => `On this week's wall of fame, first place is ${n}.`,
    (n) => `Top of the whole week is ${n}. Come back tomorrow to keep it.`,
    (n) => `${n} is leading this week. If you want to pass them, come to class more often.`,
  ] as L1,

  // ---------- Gifts, follows, greetings ----------
  thankGift: [
    (n, g) => `Thank you ${n} for ${g}.`,
    (n, g) => `Oh, ${g} from ${n}, my favorite student.`,
    (n, g) => `${n} gave me ${g}. Students like this, I adore.`,
    (n, g) => `Thank you ${n}! ${g} is so pretty, I am keeping it safe.`,
    (n, g) => `${n}, I am keeping ${g} as a memory.`,
    (n, g) => `I got ${g} from ${n}. Thank you.`,
    (n, g) => `${n} gave me ${g}. No salary complaints today.`,
    (n, g) => `Flowers from ${n}. Thank you, I am so happy today.`,
    (n, g) => `Nobody is like ${n}, smart and kind to their teacher. Thank you.`,
    (n, g) => `${n} sent ${g}. No extra points, but I will remember your face.`,
    (n, g) => `Thank you ${n}, ${g} brightens up the whole classroom.`,
    (n, g) => `${n}, thank you so much. If the PE teacher found out, he would be jealous.`,
  ] as L2,
  bigGift: [
    (n) => `Oh my, ${n} sent such a big gift! Everyone clap for them.`,
    (n) => `${n} went big. I am so touched I could cry.`,
    (n) => `A big gift from ${n}! I name you honorary class entertainment captain.`,
    (n) => `${n}, I cannot accept this... okay, I accept. Thank you!`,
    (n) => `Everyone, look at ${n} and learn. Thank you so much.`,
    (n) => `${n} sent a fancy gift. You get a front row seat in my heart.`,
  ] as L1,
  giftHint: [
    (n) => `${n} asked me to reveal one more letter, thank them, class.`,
    (n) => `Thanks to ${n}'s gift, I am revealing one more letter for everyone.`,
    (n) => `${n} rescues the class, one more letter revealed.`,
    (n) => `${n} sent a gift, so the whole class gets a letter.`,
    (n) => `Thank you ${n}! One more letter on the board, who can guess it?`,
    (n) => `${n} treats the class to a letter. Say thank you, everyone.`,
  ] as L1,
  thankFollow: [
    (n) => `Thank you ${n} for following the channel.`,
    (n) => `${n} just followed our class. Welcome, new student!`,
    (n) => `Thanks for following, ${n}, come to class on time tomorrow, do not be late like you are for work.`,
    (n) => `${n} is on the attendance list now. Thank you.`,
    (n) => `New student ${n} just followed. Everyone say hi.`,
    (n) => `${n} followed the channel, I remember you now.`,
  ] as L1,
  greeting: [
    (names) => `Welcome to class, ${names}. Type the answer in the comments and you can play right away.`,
    (names) => `${names}, you are late, but I will let it slide this time. Sit down and play.`,
    (names) => `Our class just got bigger with ${names}. Welcome.`,
    (names) => `${names} just walked in. Find a seat, the next question is coming.`,
    (names) => `Oh, look who just arrived: ${names}. The class is so lively.`,
    (names) => `Hi ${names}. Want a front row seat? Answer lots of questions right.`,
    (names) => `Present today: ${names}. Successfully skipped work, now study.`,
    (names) => `Welcome ${names}! New here? Just look at the board and unscramble the word.`,
  ] as L1,
  share: [
    'Having fun? Share the live and invite your friends to compete with our class.',
    'A full class is more fun, share the live with your coworkers, the boss will never know.',
    'Whoever brings a friend to class, I will remember your contribution. Hit share.',
    'Share the live with that friend who always brags about being smart and let them try.',
    'Follow the channel so you can come to class on time tomorrow, everyone.',
    'Fill the screen with hearts, class, enough hearts and everyone gets a round of applause.',
    'Invite more friends, we still have lots of empty seats.',
    'No seat yet? Answer lots of questions right to get a seat in class.',
  ] as L0,
  idle: [
    'So quiet in here, is everyone asleep?',
    'Is anyone still here? It is as empty as the office on a Friday afternoon.',
    'Did the whole class go out for snacks or what?',
    'It is so quiet I can hear the ceiling fan.',
    'Type something, class, I am lonely standing up here.',
    'If you are still awake, type here so I know.',
    'Are you thinking about the answer, or scrolling another live?',
    'I will count to three, if nobody types, homework for everyone. One... two...',
    'Wait, did the internet drop, or did the whole class drop?',
    'So quiet, it feels like a meeting when the boss asks if anyone has questions.',
  ] as L0,
  clap: [
    'That is enough hearts, everyone clap!',
    'The screen is full of hearts! Applause for our class!',
    'Thank you for the hearts, class, I am so happy. Applause!',
    'So many hearts, let us celebrate with a round of applause.',
  ] as L0,

  // ---------- Recess ----------
  recessIntro: [
    'Recess! Fifteen minutes... no wait, one minute. Play a game with me.',
    'Ding ding ding, recess time! I have a great game for you.',
    'Little break, class, think of it as a break in the middle of a meeting.',
    'Recess! Put your deadlines aside and play with me.',
    'Studying is tiring, let us take a break. This game is easy, everyone can play.',
  ] as L0,

  rpsIntro: [
    'Rock, paper, scissors with me! Type rock, paper or scissors. Beat me and you get two points.',
    'Let us play rock, paper, scissors. Type rock, paper or scissors in the comments. I go last.',
    'Rock, paper, scissors time! Only one try each: rock, paper or scissors.',
    'Who dares to challenge me? Type rock, paper or scissors. Win and get two points.',
  ] as L0,
  rpsReveal: [
    (pick, rest) => `I choose ${pick}! ${rest}`,
    (pick, rest) => `One, two, three, I throw ${pick}. ${rest}`,
    (pick, rest) => `Rock, paper, scissors, shoot: ${pick}! ${rest}`,
    (pick, rest) => `I am going with ${pick}. ${rest}`,
  ] as L2,
  rpsWin: [
    (c) => `${c} of you beat me, two points each.`,
    (c) => `${c} people won, I lose fair and square.`,
    (c) => `I lost to ${c} people. Two points for each of you.`,
  ] as L1,
  rpsLose: [
    (c) => `${c} of you did not beat me this round. Get me back next time!`,
    (c) => `I got lucky against ${c} people. Still got it.`,
    (c) => `${c} people tied or let me win this round. Thank you, class!`,
  ] as L1,
  rpsNobody: [
    'Nobody played with me. I will play rock, paper, scissors against the board then.',
    'You guys let me win this one, right?',
    'Nobody threw anything. I win by default.',
  ] as L0,

  callUp: [
    (n) => `Pop quiz! I invite ${n} to the board. You have fifteen seconds.`,
    (n) => `Where is ${n}? Come up and answer for me. Fifteen seconds.`,
    (n) => `Today I am calling on ${n}. Only ${n} can answer this one.`,
    (n) => `${n}, it is your turn for the pop quiz. Everyone, quiet while they answer.`,
    (n) => `Let me check the list... ${n}! Come to the board.`,
    (n) => `${n}, try this question at the board. Fifteen seconds, five points if you are right.`,
    (n) => `${n} to the board! Everyone else, cheer them on.`,
    (n) => `A friendly pop quiz, I choose ${n}. Stay calm, be confident, grab five points!`,
  ] as L1,
  callUpRight: [
    (n) => `${n} got it right! Five points, back to your seat.`,
    (n) => `Excellent ${n}! Five points for that answer.`,
    (n) => `${n} studied well. Correct, five points.`,
    (n) => `Spot on, ${n}! Everyone clap for them.`,
    (n) => `${n} passed the pop quiz. I can relax now.`,
    (n) => `Correct, ${n}. I tried to make it hard and it did not work.`,
  ] as L1,
  callUpWrong: [
    (n) => `${n} did not get this one. Back to your seat, win it back next time.`,
    (n) => `Oh ${n}, that one was a surprise, right? No worries.`,
    (n) => `${n}'s answer was not quite right. Grab those five points next time.`,
    (n) => `So close, ${n}, almost had it.`,
    (n) => `${n}, the answer was a little different. Take a rest and win it back next time.`,
    (n) => `That one was tricky so ${n} slipped a little. I still love the courage.`,
    (n) => `${n} answered so confidently. Spirit points for you.`,
    (n) => `Not quite, ${n}. Everyone clap to cheer them up!`,
  ] as L1,
  callUpSilent: [
    (n) => `${n} did not type in time. Must be a little busy.`,
    (n) => `Time is up and ${n} did not answer. I will save the chance for next time.`,
    (n) => `Where did ${n} go? Probably getting some water, see you next question.`,
    (n) => `${n} did not answer in time. Back to your seat and get ready for the next class.`,
    (n) => `${n} must be getting a drink. Next time then.`,
    (n) => `Fifteen seconds flew by and ${n} did not type. Next time.`,
    (n) => `${n}'s hands are busy, back to your seat.`,
    (n) => `${n} did not answer in time. Everyone cheer for them next question.`,
  ] as L1,

  pickIntro: [
    (a, b) => `Pick a side! ${a} or ${b}? Type one for ${a}, two for ${b}.`,
    (a, b) => `Split the class: one is ${a}, two is ${b}. Type the number.`,
    (a, b) => `The hardest question today: ${a} or ${b}? Type one or two.`,
    (a, b) => `Let us vote. Number one is ${a}, number two is ${b}.`,
  ] as L2,
  pickResult: [
    (win, pct) => `Team ${win} wins with ${pct} percent.`,
    (win, pct) => `${pct} percent of the class chose ${win}. So lively!`,
    (win, pct) => `Result: ${win} wins, ${pct} percent.`,
    (win, pct) => `Our class chose ${win}, a full ${pct} percent.`,
  ] as L2,
  pickRoast: [
    (lose) => `Team ${lose} was a little short on allies today, bring more friends next time.`,
    (lose) => `If you chose ${lose}, you have unique taste.`,
    (lose) => `Team ${lose} is smaller, but the spirit is just as strong.`,
    (lose) => `Both choices are great, team ${lose}, do not be sad.`,
    (lose) => `${lose} is good too, the class just switched tastes today.`,
    (lose) => `Team ${lose}, stay true to your passion, I support you!`,
  ] as L1,
  pickTie: [
    'A tie! Our class is split right down the middle.',
    'Both sides are even. No arguing, we choose both.',
  ] as L0,
  pickNobody: [
    'Nobody picked a side. Our class is so neutral.',
    'No votes yet. I will choose for you.',
  ] as L0,

  rollIntro: [
    'Speed roll call! Type here as fast as you can. The first ten get three points.',
    'If you are here, type here! The ten fastest get points, faster than clocking in.',
    'Roll call, type here. Be quick and get three points.',
    'Roll call! Type here. The first ten people get three points.',
  ] as L0,
  rollResult: [
    (names) => `Fastest at roll call: ${names}. Three points each.`,
    (names) => `First to arrive: ${names}. Three points.`,
    (names) => `${names} answered roll call the fastest. Plus three points.`,
    (names) => `First ones here: ${names}. Well done.`,
  ] as L1,
  rollNobody: [
    'Nobody is here? Then who am I teaching?',
    'Roll call and no answers. The whole class skipped school.',
  ] as L0,

  // heart challenge: the screen just counts, as many hearts as you send
  heartIntro: [
    'Hearts for the class! Tap the screen to send hearts, every single one gets counted.',
    'Heart recess! Send as many as you can, let us see how many hearts our class gets.',
    'Hearts, hearts! Everyone tap the screen and send hearts, I am counting them all.',
    'Send hearts to power up the class! The counter is running.',
  ] as L0,
  // c = total hearts, n = top heart sender (empty = nobody)
  heartDone: [
    (c, n) => `The class sent ${c} hearts! ${n ? `Thank you ${n} for sending the most, ` : ''}thank you so much, everyone.`,
    (c, n) => `Wow, ${c} hearts! ${n ? `${n} is our number one heart sender. ` : ''}Thank you, class.`,
    (c, n) => `Summary: ${c} hearts! Our class is so united. ${n ? `Special thanks to ${n}.` : ''}`,
  ] as L2,
  heartNobody: [
    'No hearts yet. Next time remember to tap the screen and send hearts for the class.',
    'Nobody sent hearts? I am a little sad, send me some next time.',
  ] as L0,

  // ---------- Dance recess ----------
  danceIntro: [
    'Recess! Everyone come up and dance. Everyone watching, send hearts to keep our class healthy!',
    'Music on! Come up and dance, and if you are watching, send hearts to cheer everyone on.',
    'Sitting all day hurts your back, stand up and dance, class! Send hearts to power everyone up.',
    'Party recess! The class is dancing, the more hearts fly, the healthier we get.',
  ] as L0,
  // mid-dance: c = hearts so far, n = top heart sender (empty = nobody)
  danceCheer: [
    (c, n) => `${c} hearts already! ${n ? `${n} is sending hearts like crazy. ` : ''}Keep them coming, class!`,
    (c, n) => `${c} hearts, keep dancing! ${n ? `I see ${n} sending hearts nonstop.` : 'If you have not sent any yet, tap the screen now.'}`,
    (c, n) => `The counter says ${c} hearts! ${n ? `${n} is leading the heart race. ` : ''}Party on, class!`,
  ] as L2,
  // end of dance: c = total hearts, n = top heart sender
  danceThanks: [
    (c, n) => `Recess is over! The class sent ${c} hearts, so healthy. ${n ? `Thank you ${n} for sending the most, ` : ''}thank you so much, everyone!`,
    (c, n) => `Summary: ${c} hearts! Thank you for the energy, class. ${n ? `Special thanks to ${n}.` : ''} Back to your seats.`,
    (c, n) => `Wow, ${c} hearts! Great dancing and lots of hearts. ${n ? `${n} is today's number one heart sender. ` : ''}Thank you, class!`,
  ] as L2,
  danceNobody: [
    'We danced and nobody sent hearts. Back to your seats, remember to cheer for the class next time.',
    'Not a single heart, dancing alone is a bit awkward. Back to your seats, class.',
  ] as L0,

  // ---------- The hall monitor gives an idle student a break and their seat to someone new: a = leaving, b = coming in ----------
  escort: [
    (a, b) => `The hall monitor is here to help! ${a} is on a little break, so ${b} gets the seat for now.`,
    (a, b) => `The hall monitor brings ${b}, our super active classmate, to a seat! Thanks ${a} for sharing, when you are back just comment and you get a seat.`,
    (a, b) => `${a} is resting for a bit, so the hall monitor invites ${b} to take a seat and study with us.`,
    (a, b) => `The hall monitor says: please take a seat, ${b}! ${a} is having a water break, comment once and you are back in class.`,
  ] as L2,
  // nobody waiting for a seat (host pressed the test button): just give the student a break
  escortAlone: [
    (a) => `The hall monitor invites ${a} to take a little water break. When you are back, just comment once and you get your seat right away.`,
    (a) => `${a} is resting for a bit, comment when you are back and the hall monitor will find you a seat.`,
  ] as L1,
};

// Fun polls while waiting for an answer: type ONE letter (word answers are always 2+ letters, so no mix-ups). key = lowercase.
export interface Poll {
  ask: string;
  opts: { key: string; label: string }[];
}
export const POLLS: Poll[] = [
  {
    ask: 'Where is everyone watching from? Asia type A, Europe type E, the Americas type M, somewhere else type O!',
    opts: [{ key: 'a', label: 'Asia' }, { key: 'e', label: 'Europe' }, { key: 'm', label: 'the Americas' }, { key: 'o', label: 'somewhere else' }],
  },
  {
    ask: 'What are you doing right now? Working type W, eating type E, lying in bed scrolling type B!',
    opts: [{ key: 'w', label: 'team working' }, { key: 'e', label: 'team eating' }, { key: 'b', label: 'team lying in bed' }],
  },
  {
    ask: 'Dog people type D, cat people type C!',
    opts: [{ key: 'd', label: 'team dogs' }, { key: 'c', label: 'team cats' }],
  },
  {
    ask: 'Work or school? Working type W, studying type S, happily unemployed type U!',
    opts: [{ key: 'w', label: 'team work' }, { key: 's', label: 'team school' }, { key: 'u', label: 'team happily unemployed' }],
  },
  {
    ask: 'Bubble tea type B, coffee type C. Which one keeps you alive?',
    opts: [{ key: 'b', label: 'team bubble tea' }, { key: 'c', label: 'team coffee' }],
  },
  {
    ask: 'Pizza type P, burgers type B, noodles type N. What is your favorite?',
    opts: [{ key: 'p', label: 'team pizza' }, { key: 'b', label: 'team burgers' }, { key: 'n', label: 'team noodles' }],
  },
  {
    ask: 'Single type S, taken type T, it is complicated type C. Be honest, class!',
    opts: [{ key: 's', label: 'team single' }, { key: 't', label: 'team taken' }, { key: 'c', label: 'team it is complicated' }],
  },
  {
    ask: 'Still have money at the end of the month type Y, totally broke type N. Just asking.',
    opts: [{ key: 'y', label: 'team still has money' }, { key: 'n', label: 'team broke' }],
  },
  {
    ask: 'Happy on Mondays type H, tired on Mondays type T!',
    opts: [{ key: 'h', label: 'team loves Mondays' }, { key: 't', label: 'team fears Mondays' }],
  },
  {
    ask: 'Asleep before midnight type E, night owl type N. I bet team N wins.',
    opts: [{ key: 'e', label: 'team early sleepers' }, { key: 'n', label: 'team night owls' }],
  },
];

// "Pick a side" questions for recess
export const PICK_TOPICS: [string, string][] = [
  ['pizza', 'burgers'],
  ['bubble tea', 'coffee'],
  ['dogs', 'cats'],
  ['the beach', 'the mountains'],
  ['summer', 'winter'],
  ['instant noodles with egg', 'instant noodles with sausage'],
  ['sleeping in', 'waking up early'],
  ['spicy food', 'no spicy food'],
  ['working from home', 'going to the office'],
  ['movies', 'video games'],
  ['sandwiches', 'sushi'],
  ['texting', 'calling'],
  ['high pay but busy', 'okay pay but relaxed'],
  ['home cooking', 'eating out'],
  ['long hair', 'short hair'],
  ['bike', 'car'],
  ['morning meetings', 'afternoon meetings'],
  ['your crush texts first', 'you text first'],
  ['ice cream', 'cake'],
  ['ballads', 'dance music'],
  ['fried chicken', 'pizza'],
  ['staying home on weekends', 'going out on weekends'],
  ['waiting for a sale', 'buying it now'],
  ['chocolate', 'vanilla'],
  ['love', 'money'],
  ['durian', 'jackfruit'],
  ['iced tea', 'lemonade'],
  ['the city', 'the countryside'],
  ['iPhone', 'Android'],
  ['TikTok', 'YouTube'],
];
