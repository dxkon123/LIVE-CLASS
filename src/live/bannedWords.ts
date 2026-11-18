/**
 * Words that must never be spoken or shown on the live (vulgar, sexual, drugs, gambling, violence, scams).
 * Single words are compared token by token, so ordinary words that merely contain a banned word
 * ("class", "Scunthorpe") are not caught.
 * Shortcut: a fixed list misses creative spellings (f.u.c.k, sh1t); extend BANNED_TOKENS when one slips through.
 */

// Single words, lowercase, compared token by token
const BANNED_TOKENS = new Set([
  'fuck', 'fck', 'fuk', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bitches', 'dick', 'cock', 'pussy', 'cunt',
  'asshole', 'bastard', 'slut', 'whore', 'wtf', 'stfu', 'nigger', 'nigga', 'faggot', 'retard', 'sex', 'sexy', 'porn', 'nude', 'nudes',
  'xxx', 'boobs', 'kys', 'onlyfans', 'cocaine', 'heroin', 'meth',
  // gambling, scams
  'casino', 'scam',
]);

// Multi-word phrases, compared on the lowercase text with single spaces
const BANNED_PHRASES = [
  'kill yourself', 'go die', 'send money', 'bank transfer', 'free money', 'crypto giveaway', 'sports betting',
];

const normalize = (text: string) => text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
const tokensOf = (text: string) => normalize(text).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

export function containsBanned(text: string): boolean {
  if (!text) return false;
  const tokens = tokensOf(text);
  if (tokens.some((t) => BANNED_TOKENS.has(t))) return true;
  const joined = ` ${tokens.join(' ')} `;
  return BANNED_PHRASES.some((p) => joined.includes(` ${p} `));
}

// For text shown on screen: banned words become ***
export function maskBanned(text: string): string {
  if (!containsBanned(text)) return text;
  let out = text.replace(/[\p{L}\p{M}\p{N}]+/gu, (w) => (BANNED_TOKENS.has(w.normalize('NFC').toLowerCase()) ? '***' : w));
  for (const p of BANNED_PHRASES) {
    out = out.replace(new RegExp(p.replace(/ /g, '\\s+'), 'giu'), '***');
  }
  return out;
}
