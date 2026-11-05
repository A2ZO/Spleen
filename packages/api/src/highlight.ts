/*
 * Which part of a suggestion matches the query, for bold text. Pure and safe for client
 * bundles (`@spleen/api/highlight`, like `@spleen/api/errors`), so the Expo app reuses it.
 * Accent- and case-insensitive like the search itself: "beton" bolds "Béton".
 */

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Folded text and, for each folded character, the index of its original character. */
function fold(text: string) {
  let folded = "";
  const origin: number[] = [];
  let i = 0;
  for (const char of text) {
    const plain = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let k = 0; k < plain.length; k++) origin.push(i);
    folded += plain;
    i += char.length;
  }
  return { folded, origin };
}

const isWordStart = (s: string, at: number) => at === 0 || !/[\p{L}\p{N}]/u.test(s[at - 1]!);

export function highlightParts(text: string, q: string): HighlightPart[] {
  const { folded, origin } = fold(text);
  const terms = [
    ...new Set(
      fold(q.replace(/^@/, ""))
        .folded.split(/\s+/)
        .filter((t) => t.length > 0),
    ),
  ];
  const marked = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    // Every occurrence starting a word; else the first one anywhere.
    const found: number[] = [];
    for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + 1)) {
      if (isWordStart(folded, at)) found.push(at);
    }
    if (found.length === 0 && folded.includes(term)) found.push(folded.indexOf(term));
    for (const at of found) {
      const from = origin[at]!;
      const last = origin[at + term.length - 1]!;
      // Up to the end of the last original character (a surrogate pair is 2 code units).
      const to = last + (text.codePointAt(last)! > 0xffff ? 2 : 1);
      marked.fill(true, from, to);
    }
  }
  const parts: HighlightPart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts.at(-1);
    if (last && last.match === marked[i]) last.text += text[i];
    else parts.push({ text: text[i]!, match: marked[i]! });
  }
  return parts;
}
