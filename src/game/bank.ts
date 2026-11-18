import { parseBank } from './questions';
import { parseCodes, parseMc, type ShowBank } from './show';

// Vite bundles every question file at build time; drop a new .txt into word-bank/ and it is picked up
const files = import.meta.glob('./word-bank/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const QUESTIONS = parseBank(files);

// the 2 big shows: multiple-choice questions + passwords
const show = import.meta.glob('./show-bank/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const showFile = (name: string) => Object.entries(show).find(([p]) => p.endsWith(`/${name}`))?.[1] ?? '';
export const SHOW_BANK: ShowBank = { mc: parseMc(showFile('multiple-choice.txt')), codes: parseCodes(showFile('passwords.txt')) };
