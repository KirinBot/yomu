import { parseStory } from "./dsl";
import { getState, wordStatus } from "./store";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 — best stories (~$0.10–0.25 each)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — cheaper (~$0.05–0.12 each)" },
];

export const LEVELS = [
  {
    name: "First steps",
    spec: "Absolute beginner. Use only very common words (roughly the first 300 words of Japanese). Write almost everything in hiragana/katakana; allow only a handful of very common kanji (人, 日, 一, 二, 三, 上, 中, 手, 女, 子, 年, 時). Polite です/ます forms only (present, past, negative). Sentences of 3–8 words. Repeat key words and sentence shapes often. Short dialogue lines in plain form are fine if glossed.",
  },
  {
    name: "Beginner",
    spec: "Beginner, JLPT N5. Common N5 vocabulary and N5 kanji. です/ます plus て-form (〜て います, 〜て ください, 〜て、…), 〜たい, 〜から (because), 〜が (but). Sentences of 4–10 words. Plain form only in dialogue.",
  },
  {
    name: "Upper beginner",
    spec: "Upper beginner, JLPT N5–N4. Plain form allowed in narration. 〜と おもう, 〜た ことが ある, 〜たら, 〜ながら, potential form, simple relative clauses. N4 kanji. Sentences up to ~12 words.",
  },
  {
    name: "Pre-intermediate",
    spec: "Pre-intermediate, JLPT N4. Natural plain-form narration, relative clauses, 〜ば / 〜なら, 〜そう / 〜よう, passive and causative sparingly. Kanji up to N4 with some N3.",
  },
  {
    name: "Intermediate",
    spec: "Intermediate, JLPT N3. Natural written Japanese for graded readers; varied sentence length; N3 grammar and kanji; idiomatic expressions explained by context.",
  },
  {
    name: "Upper intermediate",
    spec: "Upper intermediate, JLPT N2. Near-native graded prose with literary touches, while keeping the plot easy to follow.",
  },
];

export const levelInfo = (level: number) => LEVELS[Math.min(LEVELS.length - 1, Math.floor(level))];

const FORMAT = `Output the story in this exact plain-text format and nothing else (no markdown, no commentary):

title: <Japanese title, kana-heavy at low levels>
title_en: <English title>
level: <integer level>
emoji: <one emoji>
hook: <1–2 English sentences of setting/context shown BEFORE reading, no spoilers>
tags: <3 comma-separated English tags>
pattern: <id> | <Japanese form> | <short meaning> | <one or two sentence explanation with an example from the story>
(2–4 pattern lines: the grammar patterns that recur most in this story)

== <Japanese chapter title> | <English chapter title>
<sentence line>
<sentence line>

<blank line = new paragraph>

Sentence line = space-separated tokens, then " || ", then a natural English translation.
Token = surface[:reading][@dictionaryform][=gloss][#patternid]
- Split into words the way a learner's dictionary would: nouns, particles, verbs (inflected verb + auxiliary may be split, e.g. ないて@なく=cry#te-imasu います@いる=(is_~ing)#te-imasu).
- :reading is REQUIRED whenever the surface contains kanji, in hiragana (人:ひと). Omit it for kana-only tokens.
- @dictionaryform only when the surface is inflected (たべました@たべる).
- =gloss is a SHORT English meaning in context; use _ for spaces. Particles get grammatical glosses in parentheses: は=(topic) が=(subject) を=(object) に=to/at で=at/by の=(of) と=and か=(question) よ=(you_know).
- #patternid when the token is part of one of the declared patterns.
- Punctuation (。、「」？！……) is its own token with nothing attached.
- Never use these characters inside a token except as separators: space : @ = # |

Example:
== よる | Night
わたし=I は=(topic) ひとりで=alone すんで@すむ=live#te-imasu います@いる=(is_~ing)#te-imasu 。 || I live alone.
「 だいじょうぶ=okay です=is か=(question) 。 」 || "Are you all right?"`;

export interface GenerateOptions {
  theme: string;
  chapters: number;
  onProgress?: (info: { chars: number; chapter: number }) => void;
  signal?: AbortSignal;
}

function buildPrompt(opts: GenerateOptions) {
  const { profile, words } = getState();
  const level = Math.floor(profile.level);
  const all = Object.values(words);
  const recycle = all
    .filter((w) => w.saved && wordStatus(w) !== "known")
    .concat(all.filter((w) => !w.saved && wordStatus(w) === "learning").sort((a, b) => b.lookups - a.lookups))
    .slice(0, 15);
  const known = all.filter((w) => wordStatus(w) === "known").slice(0, 400);

  return `Write an original graded-reader short story in Japanese for one specific learner.

THE LEARNER
- Native English speaker learning Japanese through comprehensible input (reading stories, not drills).
- Level ${level} — ${LEVELS[level].name}: ${LEVELS[level].spec}
- Target: the learner should already know or be able to guess ~95% of the words. New words must be guessable from context and should reappear 2–4 times across the story in different situations, so the meaning becomes clear without a dictionary.
- Each chapter: about ${profile.chapterSentences} sentences, ${opts.chapters} chapters in total, each chapter ending with a reason to read the next.

WHAT THEY LOVE IN A STORY
${profile.interests}

${opts.theme.trim() ? `REQUESTED THEME / IDEA\n${opts.theme.trim()}\n` : ""}
CRAFT
- Keep language simple but the story intelligent: show, don't explain; let the reader infer motives; earn the twist through earlier details.
- Avoid clichés, moralising, and melodrama. No happy-ending bow unless earned.
- Recycle grammar shapes so patterns become familiar by repetition.
${recycle.length ? `\nWORDS TO BRING BACK (the learner is still learning these — use each naturally 2–3 times):\n${recycle.map((w) => `${w.key} (${w.g})`).join(", ")}\n` : ""}${known.length ? `\nWORDS THEY ALREADY KNOW (lean on these):\n${known.map((w) => w.key).join("、")}\n` : ""}
${FORMAT}`;
}

export async function generateStory(opts: GenerateOptions): Promise<string> {
  const { settings } = getState();
  if (!settings.apiKey) throw new Error("Add your Anthropic API key in Settings first.");
  const { default: Anthropic } = await import("@anthropic-ai/sdk"); // loaded only when writing a story
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });

  const stream = client.beta.messages.stream(
    {
      model: settings.model,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: settings.effort },
      messages: [{ role: "user", content: buildPrompt(opts) }],
    },
    { signal: opts.signal },
  );

  let text = "";
  stream.on("text", (delta) => {
    text += delta;
    opts.onProgress?.({ chars: text.length, chapter: (text.match(/^==/gm) ?? []).length });
  });

  const message = await stream.finalMessage().catch((e: unknown) => {
    const status = (e as { status?: number }).status;
    if (status === 401) throw new Error("Anthropic rejected that API key. Check it in Settings.");
    if (status === 429) throw new Error("Rate limited by Anthropic. Wait a minute and try again.");
    if (status === 529 || (status ?? 0) >= 500) throw new Error("Anthropic is busy right now. Try again shortly.");
    throw e;
  });
  if (message.stop_reason === "refusal") throw new Error("Claude declined to write this one. Try a different theme.");
  let out = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  if (message.stop_reason === "max_tokens") {
    // Drop the half-written last chapter rather than end mid-sentence.
    const last = out.lastIndexOf("\n==");
    if (last > out.indexOf("\n==")) out = out.slice(0, last);
  }
  if (!parseStory(out, "check", "generated").chapters.length)
    throw new Error("The story came back in an unexpected format. Please try again.");
  return out;
}
