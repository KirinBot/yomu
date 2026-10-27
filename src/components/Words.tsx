import { useState } from "react";
import { kanaToRomaji } from "../lib/kana";
import { update, useStore, wordStatus, type WordInfo, type WordStatus } from "../lib/store";
import { speak } from "../lib/tts";

type Tab = "saved" | WordStatus;
const TABS: { v: Tab; label: string }[] = [
  { v: "saved", label: "Saved" },
  { v: "learning", label: "Learning" },
  { v: "known", label: "Known" },
];

export function Words() {
  const words = useStore((s) => s.words);
  const [tab, setTab] = useState<Tab>("saved");
  const all = Object.values(words);
  const filter = (t: Tab) => (w: WordInfo) => (t === "saved" ? w.saved : wordStatus(w) === t);
  const list = all.filter(filter(tab)).sort((a, b) => b.seen - a.seen);

  const patch = (w: WordInfo, p: Partial<WordInfo>) =>
    update((s) => ({ ...s, words: { ...s.words, [w.key]: { ...w, ...p } } }));

  return (
    <div className="page">
      <h1>Words</h1>
      <p className="muted">
        No flashcards on purpose. Save a word and it comes back in the next stories written for you. A word counts as
        known once you've met it in several chapters without looking it up.
      </p>
      <div className="seg wide">
        {TABS.map((t) => (
          <button key={t.v} className={tab === t.v ? "on" : ""} onClick={() => setTab(t.v)}>
            {t.label} <span className="muted small">{all.filter(filter(t.v)).length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="muted empty">
          {tab === "saved" ? "Tap a word while reading and press ☆ Save." : "Nothing here yet. Keep reading."}
        </p>
      ) : (
        <ul className="word-list">
          {list.map((w) => (
            <li key={w.key}>
              <button className="icon-btn" onClick={() => speak(w.r)} aria-label="Hear">
                🔊
              </button>
              <div className="word-main">
                <span className="jp-inline big">{w.key}</span>
                <span className="muted small">
                  {w.r !== w.key ? `${w.r} · ` : ""}
                  {kanaToRomaji(w.r)}
                </span>
              </div>
              <div className="word-gloss">
                <span>{w.g}</span>
                <span className="muted small">
                  seen {w.seen}× · looked up {w.lookups}×
                </span>
              </div>
              <button className="icon-btn" onClick={() => patch(w, { saved: !w.saved })} aria-label="Save">
                {w.saved ? "★" : "☆"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
