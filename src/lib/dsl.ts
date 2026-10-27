// Story format ("Yomu text"). One file = one story. Used for the bundled
// library and for stories Claude writes, so it is deliberately compact.
//
//   title: となりの へや
//   title_en: The Room Next Door
//   level: 0
//   emoji: 🚪
//   hook: One or two sentences of English context shown before reading.
//   tags: mystery, twist
//   pattern: te-imasu | 〜て います | is ~ing | Longer explanation…
//
//   == よる | Night
//   わたし=I は=(topic) すんで@すむ=live#te-imasu います@いる=(is_~ing) 。 || I live.
//
// Each line after "==" is one sentence: space-separated tokens, then " || "
// and an English translation. A blank line starts a new paragraph.
// Token: surface[:reading][@base][=gloss][#pattern]   (underscore = space in gloss)

export interface Token {
  s: string; // surface as written
  r?: string; // hiragana reading, only when surface has kanji
  b?: string; // dictionary form, when different from surface
  g?: string; // short English gloss
  p?: string; // grammar pattern id
  punct: boolean;
}

export interface Sentence {
  tokens: Token[];
  en: string;
}

export interface Chapter {
  title: string;
  titleEn: string;
  paragraphs: Sentence[][];
}

export interface Pattern {
  id: string;
  form: string;
  meaning: string;
  note: string;
}

export interface Story {
  id: string;
  title: string;
  titleEn: string;
  level: number;
  emoji: string;
  hook: string;
  tags: string[];
  patterns: Pattern[];
  chapters: Chapter[];
  source: "library" | "generated";
  createdAt?: number;
}

const PUNCT = /^[。、「」『』！？!?…・（）()〜ー—,.\s]+$/;
const TOKEN = /^([^:@=#]+)(?::([^@=#]+))?(?:@([^=#]+))?(?:=([^#]+))?(?:#(.+))?$/;

export function parseToken(raw: string): Token {
  if (PUNCT.test(raw)) return { s: raw, punct: true };
  const m = TOKEN.exec(raw);
  if (!m) return { s: raw, punct: false };
  const [, s, r, b, g, p] = m;
  return {
    s,
    r: r || undefined,
    b: b && b !== s ? b : undefined,
    g: g ? g.replace(/_/g, " ") : undefined,
    p: p || undefined,
    punct: false,
  };
}

export function parseSentence(line: string): Sentence | null {
  const [jp, en = ""] = line.split("||");
  const tokens = jp.trim().split(/\s+/).filter(Boolean).map(parseToken);
  if (!tokens.some((t) => !t.punct)) return null;
  return { tokens, en: en.trim() };
}

export function parseStory(text: string, id: string, source: Story["source"]): Story {
  const story: Story = {
    id,
    title: "",
    titleEn: "",
    level: 0,
    emoji: "📖",
    hook: "",
    tags: [],
    patterns: [],
    chapters: [],
    source,
  };
  let chapter: Chapter | null = null;
  let para: Sentence[] = [];

  const flush = () => {
    if (chapter && para.length) chapter.paragraphs.push(para);
    para = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("```")) continue;
    if (line.startsWith("==")) {
      flush();
      const [title, titleEn = ""] = line.replace(/^=+/, "").split("|");
      chapter = { title: title.trim(), titleEn: titleEn.trim(), paragraphs: [] };
      story.chapters.push(chapter);
      continue;
    }
    if (!chapter) {
      const m = /^([a-z_]+):\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, key, value] = m;
      if (key === "title") story.title = value;
      else if (key === "title_en") story.titleEn = value;
      else if (key === "level") story.level = Number(value) || 0;
      else if (key === "emoji") story.emoji = value;
      else if (key === "hook") story.hook = value;
      else if (key === "tags") story.tags = value.split(",").map((t) => t.trim()).filter(Boolean);
      else if (key === "pattern") {
        const [pid, form, meaning, note = ""] = value.split("|").map((x) => x.trim());
        if (pid && form) story.patterns.push({ id: pid, form, meaning: meaning ?? "", note });
      }
      continue;
    }
    if (!line) {
      flush();
      continue;
    }
    const sentence = parseSentence(line);
    if (sentence) para.push(sentence);
  }
  flush();
  story.chapters = story.chapters.filter((c) => c.paragraphs.length);
  return story;
}

export const wordKey = (t: Token) => t.b ?? t.s;

export function chapterTokens(ch: Chapter): Token[] {
  return ch.paragraphs.flat().flatMap((s) => s.tokens).filter((t) => !t.punct);
}
