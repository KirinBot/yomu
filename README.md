# Yomu 読む

A Japanese reading app built on comprehensible input (Krashen / StoryLearning):
short stories at your level, tap-to-look-up, words that come back, strict mode,
read-along audio, and a preview → read → summarise → reread loop.

## Run it

    npm install
    npm run dev        # http://localhost:5199

`npm run check-stories` validates the bundled stories in `src/stories/`.

## How it works

- **Stories** are plain-text files (format documented at the top of `src/lib/dsl.ts`).
  Every word carries its reading, dictionary form, gloss and grammar pattern, so lookups
  need no dictionary. Claude writes new stories in the same format.
- **Word tracking** (`src/lib/store.ts`): each finished chapter counts one encounter per
  word. A word becomes *known* after ~6 encounters with 4+ since your last lookup.
  Romaji and furigana ("auto") disappear word by word once a word is known.
- **Adaptive level**: your "how well did you follow it" rating after each chapter moves
  your level (0–5) and chapter length, which drive the next generated story.
- **Saved words** are passed to Claude to reuse 2–3 times in the next story.
- **Data** lives in the browser's localStorage (export/import a backup in Settings).
  The API key is stored there too and sent only to Anthropic.

## Natural voices (optional)

Settings → Audio takes an Azure AI Speech key and region. Sentences are then read by
a neural voice (Nanami by default) instead of the device voice. Each clip is saved in
IndexedDB (keyed by voice, speed and text), so rereads are free and work offline. If
Azure fails (bad key, quota), Yomu says so and falls back to the built-in voice.

## Deploying (for phone use)

Live at https://kirinbot.github.io/yomu/ (GitHub Pages, served from the `gh-pages` branch).

To publish changes: commit to `main`, then run `npm run deploy`. It checks the stories,
builds, and force-pushes `dist/` to `gh-pages`; the site updates about a minute later.
Open copies notice the new version when brought to the foreground (`src/lib/update.ts`).

Each device keeps its own progress; use Settings → Export/Import to move it.
