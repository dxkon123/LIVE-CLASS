import { containsBanned } from './bannedWords';

/**
 * TikTok nickname -> a name the voice can read.
 *   'Lily 🌸'          -> 'Lily'
 *   '𝑵𝒐𝒂𝒉'            -> 'Noah'          (fancy letters back to plain letters)
 *   'sam99'            -> 'sam nine nine'  (digits are read one by one)
 *   'MiaRose'          -> 'Mia Rose'
 *   name with a banned word -> 'friend'
 * Only for READING. On screen use maskBanned.
 */

const DIGITS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

// names typed without spaces are left alone in English (no reliable way to split them)
const NAME_STARTS: string[] = [];

const MAX_WORDS = 5; // very long names: read the first 5 words

export function speakableName(nickname: string): string {
  if (!nickname) return 'friend';

  let clean = nickname
    .normalize('NFKC') // fancy Unicode letters (bold, italic, script) -> plain letters
    .replace(/[\u{FE00}-\u{FE0F}‍⃣]/gu, '') // emoji variation selectors
    .replace(/[^\p{L}\p{M}\p{N}\s._-]/gu, ' ') // emoji, symbols
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || containsBanned(clean)) return 'friend';
  if (/^user\d{4,}$/i.test(clean)) return 'friend'; // TikTok default names (user5639920112) sound odd when read

  clean = clean
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2') // MinhTuan -> Minh Tuan
    .replace(/(\p{L})(\d)/gu, '$1 $2') // an99 -> an 99
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/[._-]+/g, ' ');

  const out: string[] = [];
  for (const w of clean.split(/\s+/).filter(Boolean)) {
    if (/^\d+$/.test(w)) {
      // numbers are read digit by digit; longer than 4 digits are skipped
      if (w.length <= 4) out.push(w.split('').map((d) => DIGITS[d]).join(' '));
      continue;
    }
    const start = /^[a-z]+$/.test(w) ? NAME_STARTS.find((p) => w.startsWith(p) && w.length - p.length >= 2) : undefined;
    if (start) out.push(start, w.slice(start.length));
    else out.push(w);
  }

  const spoken = out.slice(0, MAX_WORDS).join(' ').trim();
  return spoken || 'friend';
}
