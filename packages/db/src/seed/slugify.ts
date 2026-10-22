/** Letters that Unicode normalisation does not split into a base letter and an accent. */
const LETTERS: Record<string, string> = {
  œ: "oe",
  Œ: "oe",
  æ: "ae",
  Æ: "ae",
  ß: "ss",
  ø: "o",
  Ø: "o",
  ł: "l",
  Ł: "l",
  đ: "d",
  Đ: "d",
};

/** "Café crème" → "cafe-creme". Lowercase ASCII words joined by single hyphens. */
export function slugify(value: string): string {
  return value
    .replace(/[œŒæÆßøØłŁđĐ]/g, (letter) => LETTERS[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
