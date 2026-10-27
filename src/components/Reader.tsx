import { useEffect, useMemo, useRef, useState } from "react";
import type { Sentence, Story, Token } from "../lib/dsl";
import {
  addReadingTime,
  finishChapter,
  knownShare,
  recordLookup,
  update,
  useStore,
  type Aid,
  type LengthFeel,
  type Rating,
} from "../lib/store";
import { speakSequence, ttsAvailable } from "../lib/tts";
import { navigate } from "../App";
import { SentenceView, sentenceSpeech } from "./Text";
import { WordCard } from "./WordCard";

type Phase = "preview" | "read" | "reflect" | "after" | "reread";

const RATINGS: { v: Rating; label: string; hint: string }[] = [
  { v: 1, label: "I got lost", hint: "Wasn't sure who or what was happening" },
  { v: 2, label: "I got the gist", hint: "Followed the main events, missed details" },
  { v: 3, label: "I followed most of it", hint: "A few unknown words, no problem" },
  { v: 4, label: "Easy", hint: "Barely needed help" },
];
const LENGTHS: { v: LengthFeel; label: string }[] = [
  { v: "short", label: "Too short" },
  { v: "right", label: "Just right" },
  { v: "long", label: "Too long" },
];

export function Reader({ story, ch }: { story: Story; ch: number }) {
  const chapter = story.chapters[ch];
  const settings = useStore((s) => s.settings);
  const words = useStore((s) => s.words);
  const progress = useStore((s) => s.progress[story.id]);
  const [phase, setPhase] = useState<Phase>("preview");
  const [selected, setSelected] = useState<{ token: Token; index: number } | null>(null);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [showAa, setShowAa] = useState(false);
  const stopRef = useRef<() => void>(() => {});

  const sentences = useMemo(() => chapter?.paragraphs.flat() ?? [], [chapter]);
  const isLast = ch >= story.chapters.length - 1;
  const lastSummary = progress?.logs.filter((l) => l.ch === ch - 1).at(-1)?.summary;
  const share = useMemo(() => knownShare(story, ch, words), [story, ch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPhase("preview");
    setSelected(null);
    window.scrollTo(0, 0);
  }, [story.id, ch]);

  // Reading time: count visible seconds while the text is on screen.
  useEffect(() => {
    if (phase !== "read" && phase !== "reread") return;
    let pending = 0;
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") pending += 5;
      if (pending >= 30) {
        addReadingTime(pending);
        pending = 0;
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      if (pending) addReadingTime(pending);
    };
  }, [phase]);

  useEffect(() => () => stopRef.current(), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!chapter) return <div className="page">Chapter not found.</div>;

  const playFrom = (i: number) => {
    stopRef.current();
    stopRef.current = speakSequence(sentences.map(sentenceSpeech), i, setSpeaking);
  };
  const togglePlay = () => (speaking !== null ? stopRef.current() : playFrom(0));

  const onTap = (token: Token, index: number, el: HTMLElement) => {
    if (settings.strict) {
      setToast("Strict mode is on — keep reading, let the story carry you.");
      return;
    }
    if (selected?.token === token) return setSelected(null);
    setSelected({ token, index });
    recordLookup(token);
    // Keep the tapped word visible above the word card.
    if (el.getBoundingClientRect().bottom > window.innerHeight * 0.55)
      requestAnimationFrame(() => el.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  const setSetting = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) =>
    update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));

  const reading = phase === "read" || phase === "reread";
  let index = -1;

  return (
    <div className="reader" style={{ ["--jp-size" as string]: `${settings.fontSize}px` }}>
      <header className="reader-bar">
        <button className="icon-btn" onClick={() => navigate(`/story/${story.id}`)} aria-label="Back">
          ←
        </button>
        <div className="reader-title">
          <span className="jp-inline">{chapter.title}</span>
          <span className="muted small">
            {ch + 1}/{story.chapters.length}
            {phase === "reread" ? " · second read" : ""}
          </span>
        </div>
        {reading && ttsAvailable() && (
          <button className={`icon-btn${speaking !== null ? " on" : ""}`} onClick={togglePlay} aria-label="Play audio">
            {speaking !== null ? "⏸" : "▶"}
          </button>
        )}
        <button
          className={`icon-btn${settings.strict ? " on" : ""}`}
          onClick={() => setSetting("strict", !settings.strict)}
          title="Strict mode: no lookups"
          aria-label="Strict mode"
        >
          {settings.strict ? "🔒" : "🔓"}
        </button>
        <button className="icon-btn" onClick={() => setShowAa((v) => !v)} aria-label="Reading aids">
          Aa
        </button>
      </header>

      {showAa && (
        <div className="aa-panel">
          <AidRow label="Romaji" value={settings.romaji} onChange={(v) => setSetting("romaji", v)} />
          <AidRow label="Furigana" value={settings.furigana} onChange={(v) => setSetting("furigana", v)} />
          <label className="row">
            <span>Word spacing</span>
            <input type="checkbox" checked={settings.spacing} onChange={(e) => setSetting("spacing", e.target.checked)} />
          </label>
          <label className="row">
            <span>Text size</span>
            <input
              type="range"
              min={18}
              max={36}
              value={settings.fontSize}
              onChange={(e) => setSetting("fontSize", Number(e.target.value))}
            />
          </label>
          <label className="row">
            <span>Voice speed {settings.rate.toFixed(2)}×</span>
            <input
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={settings.rate}
              onChange={(e) => setSetting("rate", Number(e.target.value))}
            />
          </label>
          <p className="muted small">
            “Auto” shows the aid only on words you don't know yet, so the training wheels come off word by word.
          </p>
        </div>
      )}

      {phase === "preview" && (
        <section className="page preview">
          <div className="big-emoji">{story.emoji}</div>
          <p className="eyebrow">Chapter {ch + 1}</p>
          <h1 className="jp-title">{chapter.title}</h1>
          <p className="muted">{chapter.titleEn}</p>
          {ch === 0 ? (
            <p className="hook">{story.hook}</p>
          ) : lastSummary ? (
            <p className="hook">
              <span className="muted small">Your summary of last chapter</span>
              <br />“{lastSummary}”
            </p>
          ) : null}
          <div className="callout">
            <strong>Your one job: reach the end.</strong> Follow the story, not every word. If you can guess a word, keep
            going; it'll come back. Look things up only when you're truly stuck.
          </div>
          {share > 0 && (
            <p className="muted small">You already know about {Math.round(share * 100)}% of the words in this chapter.</p>
          )}
          <button className="btn primary big" onClick={() => setPhase("read")}>
            Start reading
          </button>
        </section>
      )}

      {reading && (
        <section className={`page text${selected ? " with-sheet" : ""}`}>
          {phase === "reread" && (
            <div className="callout soft">
              Second read. The gist is in place, so notice how sentences are built. Underlined words belong to the
              story's recurring patterns; tap one to see it.
            </div>
          )}
          {chapter.paragraphs.map((para, pi) => (
            <p key={pi} className="para">
              {para.map((sentence: Sentence) => {
                index++;
                const i = index;
                return (
                  <SentenceView
                    key={i}
                    sentence={sentence}
                    words={words}
                    settings={settings}
                    active={speaking === i}
                    selected={selected?.token}
                    highlightPatterns={phase === "reread"}
                    onTap={(t, el) => onTap(t, i, el)}
                  />
                );
              })}
            </p>
          ))}
          <button
            className="btn primary big end-btn"
            onClick={() => {
              stopRef.current();
              setSelected(null);
              setPhase(phase === "read" ? "reflect" : "after");
            }}
          >
            {phase === "read" ? "I reached the end →" : "Done →"}
          </button>
        </section>
      )}

      {phase === "reflect" && (
        <Reflect
          onDone={(rating, summary, length) => {
            finishChapter(story, ch, rating, summary, length);
            setPhase("after");
          }}
        />
      )}

      {phase === "after" && (
        <After
          story={story}
          ch={ch}
          isLast={isLast}
          onReread={() => {
            setPhase("reread");
            window.scrollTo(0, 0);
          }}
        />
      )}

      {selected && reading && (
        <WordCard
          token={selected.token}
          sentence={sentences[selected.index]}
          pattern={story.patterns.find((p) => p.id === selected.token.p)}
          onClose={() => setSelected(null)}
          onPlayFrom={() => playFrom(selected.index)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function AidRow({ label, value, onChange }: { label: string; value: Aid; onChange: (v: Aid) => void }) {
  return (
    <div className="row">
      <span>{label}</span>
      <div className="seg">
        {(["auto", "always", "off"] as Aid[]).map((v) => (
          <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function Reflect({ onDone }: { onDone: (r: Rating, summary: string, l: LengthFeel) => void }) {
  const [summary, setSummary] = useState("");
  const [rating, setRating] = useState<Rating | null>(null);
  const [length, setLength] = useState<LengthFeel>("right");
  return (
    <section className="page reflect">
      <p className="eyebrow">Pause & summarise</p>
      <h2>What happened?</h2>
      <p className="muted">
        One minute is enough. Who was there, what happened, any cliffhanger? English is fine, Japanese is a bonus.
      </p>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        placeholder="She hears someone crying through the wall every night…"
      />
      <h3>How well could you follow it?</h3>
      <div className="choices">
        {RATINGS.map((r) => (
          <button key={r.v} className={`choice${rating === r.v ? " on" : ""}`} onClick={() => setRating(r.v)}>
            <strong>{r.label}</strong>
            <span className="muted small">{r.hint}</span>
          </button>
        ))}
      </div>
      <h3>Chapter length</h3>
      <div className="seg wide">
        {LENGTHS.map((l) => (
          <button key={l.v} className={length === l.v ? "on" : ""} onClick={() => setLength(l.v)}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="muted small">Your answers tune the level and length of the next stories written for you.</p>
      <button className="btn primary big" disabled={!rating} onClick={() => rating && onDone(rating, summary.trim(), length)}>
        Save & continue
      </button>
    </section>
  );
}

function After({ story, ch, isLast, onReread }: { story: Story; ch: number; isLast: boolean; onReread: () => void }) {
  const chapter = story.chapters[ch];
  const counts = new Map<string, number>();
  for (const s of chapter.paragraphs.flat()) {
    const ids = new Set(s.tokens.map((t) => t.p).filter(Boolean) as string[]);
    ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  }
  const met = story.patterns.filter((p) => counts.has(p.id)).sort((a, b) => counts.get(b.id)! - counts.get(a.id)!);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="page after">
      <div className="big-emoji">{isLast ? "🎉" : "✓"}</div>
      <h2>{isLast ? "You finished the story." : "Chapter done."}</h2>
      {met.length > 0 && (
        <>
          <h3>Patterns you kept bumping into</h3>
          <p className="muted small">No need to study these. Just notice them; open one only if you're curious.</p>
          <ul className="patterns">
            {met.map((p) => (
              <li key={p.id}>
                <button className="pattern-row" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <span className="jp-inline">{p.form}</span>
                  <span className="muted">{p.meaning}</span>
                  <span className="count">×{counts.get(p.id)}</span>
                </button>
                {open === p.id && <p className="pattern-note">{p.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="stack">
        <button className="btn big" onClick={onReread}>
          Read it again <span className="muted small">(recommended)</span>
        </button>
        {!isLast ? (
          <button className="btn primary big" onClick={() => navigate(`/read/${story.id}/${ch + 1}`)}>
            Next chapter →
          </button>
        ) : (
          <>
            <button className="btn primary big" onClick={() => navigate("/new")}>
              Write me a new story →
            </button>
            <button className="btn ghost" onClick={() => navigate("/library")}>
              Back to library
            </button>
          </>
        )}
      </div>
    </section>
  );
}
