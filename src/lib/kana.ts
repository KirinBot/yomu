import type { Token } from "./dsl";

export const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export const isKana = (c: string) => /[぀-ゟ゠-ヿ]/.test(c);
export const hasKanji = (s: string) => /[一-鿿々]/.test(s);

const BASE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "o", ん: "n", ゔ: "vu",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
};

const SMALL_Y: Record<string, string> = { ゃ: "a", ゅ: "u", ょ: "o" };
const SMALL_V: Record<string, string> = { ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o" };

export function kanaToRomaji(input: string): string {
  const s = toHiragana(input);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];
    if (c === "っ") {
      const r = next ? kanaToRomaji(next + (s[i + 2] && SMALL_Y[s[i + 2]] ? s[i + 2] : "")) : "";
      out += r.startsWith("ch") ? "t" : r[0] ?? "";
      continue;
    }
    if (c === "ー") {
      const m = /[aeiou]$/.exec(out);
      out += m ? m[0] : "-";
      continue;
    }
    const base = BASE[c];
    if (base === undefined) {
      out += c;
      continue;
    }
    if (next && SMALL_Y[next]) {
      const stem = base.endsWith("i") ? base.slice(0, -1) : base;
      const glide = /^(sh|ch|j)$/.test(stem) ? "" : "y";
      out += stem + glide + SMALL_Y[next];
      i++;
      continue;
    }
    if (next && SMALL_V[next] && /^(f|v|t|d|sh|ch|j|w|u)/.test(base)) {
      out += base.replace(/[aeiou]$/, "") + SMALL_V[next];
      i++;
      continue;
    }
    if (c === "ん" && next && /^[aeiouy]/.test(BASE[next] ?? "")) {
      out += "n'";
      continue;
    }
    out += base;
  }
  return out;
}

const PARTICLE_ROMAJI: Record<string, string> = { は: "wa", へ: "e", を: "o" };

/** Hiragana reading of a token (kana tokens are their own reading). */
export const readingOf = (t: Token) => t.r ?? toHiragana(t.s);

export function tokenRomaji(t: Token): string {
  if (t.punct) return "";
  return PARTICLE_ROMAJI[t.s] ?? kanaToRomaji(readingOf(t));
}

export interface RubyPart {
  text: string;
  ruby?: string;
}

/** Put furigana only over the kanji part: 食べます/たべます → [食|た]べます. */
export function furiganaParts(surface: string, reading?: string): RubyPart[] {
  if (!reading || !hasKanji(surface)) return [{ text: surface }];
  const hs = toHiragana(surface);
  let pre = 0;
  while (pre < hs.length && pre < reading.length && isKana(hs[pre]) && hs[pre] === reading[pre]) pre++;
  let suf = 0;
  while (
    suf < hs.length - pre &&
    suf < reading.length - pre &&
    isKana(hs[hs.length - 1 - suf]) &&
    hs[hs.length - 1 - suf] === reading[reading.length - 1 - suf]
  )
    suf++;
  const parts: RubyPart[] = [];
  if (pre) parts.push({ text: surface.slice(0, pre) });
  parts.push({
    text: surface.slice(pre, surface.length - suf),
    ruby: reading.slice(pre, reading.length - suf),
  });
  if (suf) parts.push({ text: surface.slice(surface.length - suf) });
  return parts;
}

export const HIRAGANA_ROWS = [
  "あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの",
  "はひふへほ", "まみむめも", "や・ゆ・よ", "らりるれろ", "わ・・・を", "ん",
];
export const DAKUTEN_ROWS = ["がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ"];
export const COMBO_ROWS = [
  ["きゃ", "きゅ", "きょ"], ["しゃ", "しゅ", "しょ"], ["ちゃ", "ちゅ", "ちょ"],
  ["にゃ", "にゅ", "にょ"], ["ひゃ", "ひゅ", "ひょ"], ["みゃ", "みゅ", "みょ"],
  ["りゃ", "りゅ", "りょ"], ["ぎゃ", "ぎゅ", "ぎょ"], ["じゃ", "じゅ", "じょ"],
  ["びゃ", "びゅ", "びょ"], ["ぴゃ", "ぴゅ", "ぴょ"],
];

export const toKatakana = (s: string) =>
  s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
