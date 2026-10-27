import { useMemo } from "react";
import type { Story } from "../lib/dsl";
import { LEVELS } from "../lib/claude";
import { deleteGenerated, generatedStories, knownShare, LIBRARY, useStore } from "../lib/store";
import { navigate } from "../App";

const MORE_READING = [
  {
    name: "Tadoku free graded readers",
    url: "https://tadoku.org/japanese/en/free-books-en/",
    note: "Free illustrated Japanese readers from level 0 up, many with audio. The best free next step.",
  },
  {
    name: "Satori Reader",
    url: "https://www.satorireader.com/",
    note: "Paid. Serialised dramas and mysteries with tap-to-look-up, written for learners. Closest to your taste once you're past the basics.",
  },
  {
    name: "NHK News Web Easy",
    url: "https://www3.nhk.or.jp/news/easy/",
    note: "Real news rewritten in simple Japanese with furigana and audio. Good from upper-beginner level.",
  },
  {
    name: "Watanoc",
    url: "https://watanoc.com/",
    note: "Free short, illustrated articles about daily life in Japan, sorted by JLPT level.",
  },
];

export function Library() {
  const generated = useStore((s) => s.generated);
  const progress = useStore((s) => s.progress);
  const words = useStore((s) => s.words);
  const mine = useMemo(() => generatedStories(generated), [generated]);

  const card = (s: Story) => {
    const p = progress[s.id];
    const next = p?.next ?? 0;
    const share = knownShare(s, Math.min(next, s.chapters.length - 1), words);
    return (
      <button key={s.id} className="story-card" onClick={() => navigate(`/story/${s.id}`)}>
        <span className="big-emoji">{s.emoji}</span>
        <span className="story-meta">
          <span className="jp-title small">{s.title}</span>
          <span className="muted">{s.titleEn}</span>
          <span className="small muted">
            {LEVELS[Math.min(LEVELS.length - 1, s.level)]?.name} · {s.chapters.length} chapters
            {p?.finished ? " · finished ✓" : p ? ` · on chapter ${next + 1}` : ""}
            {!p?.finished && share > 0 ? ` · ~${Math.round(share * 100)}% known` : ""}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="page">
      <div className="row">
        <h1>Stories</h1>
        <button className="btn primary" onClick={() => navigate("/new")}>
          ✍️ New story
        </button>
      </div>

      {mine.length > 0 && (
        <>
          <h3>Written for you</h3>
          <div className="list">{mine.map(card)}</div>
        </>
      )}

      <h3>Starter library</h3>
      <div className="list">{LIBRARY.map(card)}</div>

      <h3>More reading, outside the app</h3>
      <div className="list">
        {MORE_READING.map((m) => (
          <a key={m.url} className="card link-card" href={m.url} target="_blank" rel="noreferrer">
            <strong>{m.name} ↗</strong>
            <span className="muted small">{m.note}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function StoryPage({ story }: { story: Story }) {
  const progress = useStore((s) => s.progress[story.id]);
  const next = progress?.next ?? 0;

  return (
    <div className="page">
      <button className="btn ghost" onClick={() => navigate("/library")}>
        ← Stories
      </button>
      <div className="story-hero">
        <div className="big-emoji">{story.emoji}</div>
        <h1 className="jp-title">{story.title}</h1>
        <p className="muted">{story.titleEn}</p>
        <p className="hook">{story.hook}</p>
        <p className="small muted">{story.tags.join(" · ")}</p>
      </div>

      <button
        className="btn primary big"
        onClick={() => navigate(`/read/${story.id}/${progress?.finished ? 0 : next}`)}
      >
        {progress?.finished ? "Read again from the start" : next ? `Continue · chapter ${next + 1}` : "Start reading"}
      </button>

      <h3>Chapters</h3>
      <ol className="chapters">
        {story.chapters.map((c, i) => {
          const log = progress?.logs.filter((l) => l.ch === i).at(-1);
          const unlocked = i <= next;
          return (
            <li key={i}>
              <button className="chapter-row" disabled={!unlocked} onClick={() => navigate(`/read/${story.id}/${i}`)}>
                <span className="jp-inline">{c.title}</span>
                <span className="muted small">{unlocked ? c.titleEn : "…"}</span>
                {log && <span className="small">✓</span>}
              </button>
              {log?.summary && <p className="muted small summary">“{log.summary}”</p>}
            </li>
          );
        })}
      </ol>

      {story.source === "generated" && (
        <button
          className="btn ghost danger"
          onClick={() => {
            if (confirm("Delete this story? Your word progress stays.")) {
              deleteGenerated(story.id);
              navigate("/library");
            }
          }}
        >
          Delete story
        </button>
      )}
    </div>
  );
}
