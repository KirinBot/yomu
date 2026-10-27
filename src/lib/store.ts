import { useSyncExternalStore } from "react";
import { chapterTokens, parseStory, wordKey, type Story, type Token } from "./dsl";
import { readingOf } from "./kana";

// Everything lives in this browser's localStorage, namespaced per profile so a
// second reader (e.g. a sibling) can get their own progress later.

export type Aid = "auto" | "always" | "off";
export type Rating = 1 | 2 | 3 | 4; // lost · gist · most · easy
export type LengthFeel = "short" | "right" | "long";

export interface WordInfo {
  key: string; // dictionary form
  s: string; // a surface form seen in text
  r: string; // reading (hiragana)
  g: string; // gloss
  seen: number; // encounters in finished chapters
  lookups: number;
  seenAtLookup: number; // value of `seen` at the last lookup
  saved: boolean;
  manual?: "known" | "learning";
}

export interface ChapterLog {
  ch: number;
  rating: Rating;
  summary: string;
  at: number;
}

export interface StoryProgress {
  next: number; // index of the next chapter to read
  logs: ChapterLog[];
  finished: boolean;
}

export interface State {
  profile: {
    name: string;
    onboarded: boolean;
    level: number; // 0 – 5, fractional; adapts after every chapter
    chapterSentences: number; // target sentences per chapter for generated stories
    interests: string;
  };
  settings: {
    apiKey: string;
    model: string;
    effort: "low" | "medium" | "high";
    romaji: Aid;
    furigana: Aid;
    spacing: boolean;
    strict: boolean;
    fontSize: number;
    voiceURI: string;
    rate: number;
    azureKey: string;
    azureRegion: string;
    azureVoice: string;
  };
  words: Record<string, WordInfo>;
  progress: Record<string, StoryProgress>;
  generated: { id: string; text: string; createdAt: number }[];
  stats: { seconds: number; wordsRead: number; chapters: number; days: Record<string, number> };
}

export const DEFAULT_INTERESTS = [
  "Intellectually stimulating, but not unnecessarily complicated.",
  "Emotionally meaningful, without feeling overly sentimental.",
  "Morally ambiguous, where there isn't always a clear hero or villain.",
  "Unpredictable, with twists that genuinely change your perspective.",
  "Layered, where there's more beneath the surface than the plot itself.",
].join("\n");

const initial = (): State => ({
  profile: { name: "", onboarded: false, level: 0, chapterSentences: 12, interests: DEFAULT_INTERESTS },
  settings: {
    apiKey: "",
    model: "claude-opus-5-5",
    effort: "high",
    romaji: "auto",
    furigana: "auto",
    spacing: true,
    strict: false,
    fontSize: 24,
    voiceURI: "",
    rate: 0.8,
    azureKey: "",
    azureRegion: "",
    azureVoice: "ja-JP-NanamiNeural",
  },
  words: {},
  progress: {},
  generated: [],
  stats: { seconds: 0, wordsRead: 0, chapters: 0, days: {} },
});

const PROFILE_KEY = "yomu:profile";
const profileId = () => localStorage.getItem(PROFILE_KEY) || "default";
const storageKey = () => `yomu:v1:${profileId()}`;

function load(): State {
  const base = initial();
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<State>;
    return {
      ...base,
      ...saved,
      profile: { ...base.profile, ...saved.profile },
      settings: { ...base.settings, ...saved.settings },
      stats: { ...base.stats, ...saved.stats },
    };
  } catch {
    return base;
  }
}

let state = load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

function emit() {
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, 200);
}

export function update(fn: (s: State) => State) {
  state = fn(state);
  emit();
}

export const getState = () => state;

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

// ---------- words ----------

export type WordStatus = "new" | "learning" | "known";

export function wordStatus(w: WordInfo | undefined): WordStatus {
  if (!w) return "new";
  if (w.manual) return w.manual;
  // Known = met it plenty of times, and several times since you last needed to look it up.
  if (w.seen >= 6 && w.seen - w.seenAtLookup >= 4) return "known";
  return w.seen >= 2 || w.lookups > 0 ? "learning" : "new";
}

const blankWord = (t: Token): WordInfo => ({
  key: wordKey(t),
  s: t.s,
  r: readingOf(t),
  g: t.g ?? "",
  seen: 0,
  lookups: 0,
  seenAtLookup: 0,
  saved: false,
});

function patchWord(t: Token, fn: (w: WordInfo) => WordInfo) {
  const key = wordKey(t);
  update((s) => {
    const prev = s.words[key] ?? blankWord(t);
    return { ...s, words: { ...s.words, [key]: fn(prev) } };
  });
}

export const recordLookup = (t: Token) =>
  patchWord(t, (w) => ({ ...w, lookups: w.lookups + 1, seenAtLookup: w.seen, g: w.g || t.g || "" }));

export const toggleSaved = (t: Token) => patchWord(t, (w) => ({ ...w, saved: !w.saved }));

export const setManual = (t: Token, manual: WordInfo["manual"]) =>
  patchWord(t, (w) => ({ ...w, manual }));

// ---------- reading progress ----------

const today = () => new Date().toISOString().slice(0, 10);

export function addReadingTime(seconds: number) {
  update((s) => ({
    ...s,
    stats: {
      ...s.stats,
      seconds: s.stats.seconds + seconds,
      days: { ...s.stats.days, [today()]: (s.stats.days[today()] ?? 0) + seconds },
    },
  }));
}

const RATING_STEP: Record<Rating, number> = { 1: -0.35, 2: 0, 3: 0.12, 4: 0.3 };
const LENGTH_STEP: Record<LengthFeel, number> = { short: 3, right: 0, long: -3 };

export function finishChapter(story: Story, ch: number, rating: Rating, summary: string, length: LengthFeel) {
  const tokens = chapterTokens(story.chapters[ch]);
  update((s) => {
    const words = { ...s.words };
    for (const t of tokens) {
      const key = wordKey(t);
      const w = words[key] ?? blankWord(t);
      words[key] = { ...w, seen: w.seen + 1, g: w.g || t.g || "" };
    }
    const prev = s.progress[story.id] ?? { next: 0, logs: [], finished: false };
    const next = Math.max(prev.next, ch + 1);
    return {
      ...s,
      words,
      profile: {
        ...s.profile,
        level: Math.min(5, Math.max(0, s.profile.level + RATING_STEP[rating])),
        chapterSentences: Math.min(40, Math.max(6, s.profile.chapterSentences + LENGTH_STEP[length])),
      },
      progress: {
        ...s.progress,
        [story.id]: {
          next,
          logs: [...prev.logs, { ch, rating, summary, at: Date.now() }],
          finished: next >= story.chapters.length,
        },
      },
      stats: { ...s.stats, wordsRead: s.stats.wordsRead + tokens.length, chapters: s.stats.chapters + 1 },
    };
  });
}

export function addGenerated(text: string): string {
  const id = `gen-${Date.now().toString(36)}`;
  update((s) => ({ ...s, generated: [{ id, text, createdAt: Date.now() }, ...s.generated] }));
  return id;
}

export function deleteGenerated(id: string) {
  update((s) => ({ ...s, generated: s.generated.filter((g) => g.id !== id) }));
}

// ---------- stories ----------

const libraryFiles = import.meta.glob("../stories/*.txt", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

export const LIBRARY: Story[] = Object.entries(libraryFiles)
  .map(([path, text]) => parseStory(text, path.split("/").pop()!.replace(".txt", ""), "library"))
  .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));

const parsedCache = new Map<string, Story>();
export function generatedStories(gen: State["generated"]): Story[] {
  return gen.map((g) => {
    let st = parsedCache.get(g.id);
    if (!st) {
      st = { ...parseStory(g.text, g.id, "generated"), createdAt: g.createdAt };
      parsedCache.set(g.id, st);
    }
    return st;
  });
}

export const findStory = (id: string) =>
  LIBRARY.find((s) => s.id === id) ?? generatedStories(state.generated).find((s) => s.id === id);

/** Share of a chapter's word tokens you already know (0–1). */
export function knownShare(story: Story, ch: number, words: State["words"]): number {
  const tokens = chapterTokens(story.chapters[ch] ?? { paragraphs: [] } as never);
  if (!tokens.length) return 0;
  return tokens.filter((t) => wordStatus(words[wordKey(t)]) === "known").length / tokens.length;
}
