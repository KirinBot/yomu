import { useRef, useState } from "react";
import { generateStory, levelInfo } from "../lib/claude";
import { addGenerated, useStore, wordStatus } from "../lib/store";
import { navigate } from "../App";

const IDEAS = [
  "A lighthouse keeper who lies to the ships",
  "Two strangers swap umbrellas every rainy morning",
  "A robot that is told to forget one person",
  "A lost-property office that keeps something it shouldn't",
  "A grandmother's recipe with one ingredient missing",
  "The last day of a small-town train line",
];

export function Generate() {
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const words = useStore((s) => s.words);
  const [theme, setTheme] = useState("");
  const [chapters, setChapters] = useState(3);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ chars: 0, chapter: 0 });
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const recycle = Object.values(words).filter((w) => w.saved && wordStatus(w) !== "known").length;

  const run = async () => {
    setBusy(true);
    setError("");
    setProgress({ chars: 0, chapter: 0 });
    abort.current = new AbortController();
    try {
      const text = await generateStory({ theme, chapters, onProgress: setProgress, signal: abort.current.signal });
      const id = addGenerated(text);
      navigate(`/story/${id}`);
    } catch (e) {
      if (!abort.current?.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!settings.apiKey)
    return (
      <div className="page">
        <h1>New story</h1>
        <div className="callout">
          Claude writes each story for your level, your taste and the words you're learning. Add an Anthropic API key
          in Settings to turn this on. Until then, the starter library and the free readers linked under Stories will
          keep you going.
        </div>
        <button className="btn primary" onClick={() => navigate("/settings")}>
          Open Settings
        </button>
      </div>
    );

  return (
    <div className="page">
      <h1>New story</h1>
      <p className="muted">
        Written for <strong>{levelInfo(profile.level).name}</strong>, about {profile.chapterSentences} sentences per
        chapter, in the style you described.
        {recycle > 0 && ` ${recycle} saved word${recycle === 1 ? "" : "s"} will come back.`}
      </p>

      <label className="field">
        <span>Idea or theme (optional)</span>
        <textarea
          rows={2}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Leave empty to be surprised"
          disabled={busy}
        />
      </label>
      <div className="ideas">
        {IDEAS.map((i) => (
          <button key={i} className="chip" onClick={() => setTheme(i)} disabled={busy}>
            {i}
          </button>
        ))}
      </div>

      <div className="row">
        <span>Chapters</span>
        <div className="seg">
          {[2, 3, 4, 5].map((n) => (
            <button key={n} className={chapters === n ? "on" : ""} onClick={() => setChapters(n)} disabled={busy}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {busy ? (
        <div className="card generating">
          <div className="spinner" />
          <div>
            <strong>{progress.chapter ? `Writing chapter ${progress.chapter} of ${chapters}…` : "Planning the story…"}</strong>
            <p className="muted small">This usually takes one to three minutes. {progress.chars.toLocaleString()} characters so far.</p>
          </div>
          <button className="btn ghost" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn primary big" onClick={run}>
          ✍️ Write my story
        </button>
      )}
      {error && <div className="callout error">{error}</div>}
    </div>
  );
}
