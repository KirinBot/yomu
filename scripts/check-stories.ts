// Parse every bundled story and flag tokens a learner can't look up properly.
import { readdirSync, readFileSync } from "node:fs";
import { parseStory, chapterTokens } from "../src/lib/dsl.ts";
import { hasKanji, tokenRomaji, furiganaParts } from "../src/lib/kana.ts";

const dir = new URL("../src/stories/", import.meta.url);
let problems = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
  const story = parseStory(readFileSync(new URL(file, dir), "utf8"), file, "library");
  const ids = new Set(story.patterns.map((p) => p.id));
  console.log(`\n${file}: "${story.title}" — ${story.chapters.length} chapters, ${story.patterns.length} patterns`);
  story.chapters.forEach((ch, i) => {
    const tokens = chapterTokens(ch);
    const sentences = ch.paragraphs.flat();
    console.log(`  ${i + 1}. ${ch.title} | ${ch.titleEn}: ${sentences.length} sentences, ${tokens.length} words`);
    for (const t of tokens) {
      const issue =
        (hasKanji(t.s) && !t.r && "kanji without reading") ||
        (!t.g && "no gloss") ||
        (t.p && !ids.has(t.p) && `unknown pattern ${t.p}`) ||
        (/[a-z]/i.test(t.s) && "latin in surface");
      if (issue) {
        problems++;
        console.log(`     ! ${t.s}: ${issue}`);
      }
    }
    for (const s of sentences) if (!s.en) { problems++; console.log(`     ! missing translation`); }
  });
  if (process.argv.includes("-v"))
    for (const s of story.chapters[0].paragraphs.flat().slice(0, 4))
      console.log("   ", s.tokens.map((t) => tokenRomaji(t) || t.s).join(" "), "|", s.tokens.map((t) => furiganaParts(t.s, t.r).map((p) => (p.ruby ? `[${p.text}|${p.ruby}]` : p.text)).join("")).join(""));
}
console.log(problems ? `\n${problems} problem(s)` : "\nAll stories OK");
process.exit(problems ? 1 : 0);
