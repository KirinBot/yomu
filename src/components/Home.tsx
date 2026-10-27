import { useMemo } from "react";
import { levelInfo } from "../lib/claude";
import { generatedStories, LIBRARY, useStore, wordStatus } from "../lib/store";
import { navigate } from "../App";

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function Home() {
  const profile = useStore((s) => s.profile);
  const progress = useStore((s) => s.progress);
  const generated = useStore((s) => s.generated);
  const stats = useStore((s) => s.stats);
  const words = useStore((s) => s.words);

  const all = useMemo(() => [...generatedStories(generated), ...LIBRARY], [generated]);
  const current = useMemo(() => {
    const started = all
      .filter((s) => progress[s.id] && !progress[s.id].finished)
      .sort((a, b) => (progress[b.id].logs.at(-1)?.at ?? 0) - (progress[a.id].logs.at(-1)?.at ?? 0));
    return started[0] ?? all.find((s) => !progress[s.id]);
  }, [all, progress]);

  const wordList = Object.values(words);
  const known = wordList.filter((w) => wordStatus(w) === "known").length;
  const saved = wordList.filter((w) => w.saved).length;
  const todayMin = Math.round((stats.days[dayKey(new Date())] ?? 0) / 60);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), min: (stats.days[dayKey(d)] ?? 0) / 60 };
  });
  const maxMin = Math.max(15, ...week.map((w) => w.min));
  const level = levelInfo(profile.level);
  const next = current ? progress[current.id]?.next ?? 0 : 0;

  return (
    <div className="page">
      <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1>{profile.name ? `おかえり, ${profile.name}.` : "おかえり."}</h1>

      {current ? (
        <button className="today-card" onClick={() => navigate(`/read/${current.id}/${next}`)}>
          <span className="big-emoji">{current.emoji}</span>
          <span className="today-text">
            <span className="eyebrow">{next ? "Continue reading" : "Start reading"}</span>
            <span className="jp-title small">{current.title}</span>
            <span className="muted">
              {current.titleEn} · chapter {next + 1} of {current.chapters.length}
            </span>
          </span>
          <span className="arrow">→</span>
        </button>
      ) : (
        <button className="today-card" onClick={() => navigate("/new")}>
          <span className="big-emoji">✍️</span>
          <span className="today-text">
            <span className="eyebrow">You've read everything</span>
            <span>Have Claude write a new story for you</span>
          </span>
          <span className="arrow">→</span>
        </button>
      )}

      <div className="stats">
        <Stat value={`${todayMin}`} label="minutes today" />
        <Stat value={stats.wordsRead.toLocaleString()} label="words read" />
        <Stat value={`${known}`} label="words known" />
        <Stat value={`${saved}`} label="saved words" />
      </div>

      <div className="card">
        <div className="row">
          <strong>This week</strong>
          <span className="muted small">aim for ~15 min a day</span>
        </div>
        <div className="week">
          {week.map((d, i) => (
            <div key={i} className="day">
              <div className="bar" style={{ height: `${Math.max(3, (d.min / maxMin) * 64)}px` }} />
              <span className="muted small">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div>
            <p className="eyebrow">Your level</p>
            <strong>{level.name}</strong> <span className="muted small">({profile.level.toFixed(1)} / 5)</span>
          </div>
          <button className="btn" onClick={() => navigate("/new")}>
            New story
          </button>
        </div>
        <p className="muted small">
          Adjusts after every chapter from how well you followed it. Too hard → easier stories. Too easy → richer ones.
        </p>
      </div>

      <a className="card link-card" href="#/method">
        <strong>How to read</strong>
        <span className="muted small">Follow the meaning · let words come back · notice patterns · keep it easy</span>
      </a>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="muted small">{label}</span>
    </div>
  );
}
