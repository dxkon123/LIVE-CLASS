// Switching the class teacher to the male teacher (Mr. Minh): lines are written for Ms. Ngan in the first person,
// so only a few words change: "Ms." -> "Mr.", "pretty" -> "handsome", "queen of words" -> "king of words".
// The PE-teacher crush stays (it works either way).

const NAME_UP = '\u0001';
const NAME_LOW = '\u0002';

/** female wording -> male wording (keeps upper/lower case). The teacher's own name is replaced separately. */
export function thayHoa(s: string): string {
  return s
    .replace(/\bMs\.(?=\s)/g, 'Mr.')
    .replace(/\bMS\.(?=\s)/g, 'MR.')
    .replace(/\bpretty today\b/g, 'handsome today')
    .replace(/\bthe king of words, or the queen of words\b/g, 'the king of words')
    .replace(/\bher climbing gear\b/g, 'his climbing gear')
    .replace(/\bher hand\b/g, 'his hand');
}

/** A teacher line: put in the name chosen in the panel instead of "Ms. Ngan", male teacher -> male wording */
export function teacherText(text: string, name: string, thay: boolean): string {
  let t = text.split('Ms. Ngan').join(NAME_UP).split('ms. Ngan').join(NAME_LOW);
  if (thay) t = thayHoa(t);
  return t.split(NAME_UP).join(name).split(NAME_LOW).join(name);
}
