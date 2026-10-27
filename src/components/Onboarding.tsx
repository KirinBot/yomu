import { useState } from "react";
import { update, useStore } from "../lib/store";
import { navigate } from "../App";

const RULES = [
  {
    title: "Follow the meaning",
    body: "You learn a language by understanding messages, not by studying it. Read for the story at your own pace. The page waits for you; you can always go back a line.",
  },
  {
    title: "Let words come back",
    body: "Don't stop for every new word. Guess from context and keep going. Words return in new situations until one day you just know them. Look one up only when it's truly blocking you.",
  },
  {
    title: "Notice patterns, don't memorise rules",
    body: "Grammar sinks in by meeting the same shapes again and again. Look up a rule only when a real question pops up from reading, then get back to the story.",
  },
  {
    title: "Keep it comprehensible",
    body: "If you finish a page asking “wait, who is this?”, it's too hard. Go easier. Something almost embarrassingly easy that you actually finish beats a hard book you give up on.",
  },
];

const LOOP = [
  ["Preview", "Title, picture, context. Your brain sketches the scene first."],
  ["Read through", "Your only job is to reach the end of the chapter."],
  ["Summarise", "One minute: what happened? This locks it in."],
  ["Read again", "With the gist in place you'll notice grammar you missed."],
  ["Next chapter", "Same loop. The habit is the goal."],
];

function MethodContent() {
  return (
    <>
      <ol className="rules">
        {RULES.map((r, i) => (
          <li key={i}>
            <strong>{r.title}</strong>
            <p className="muted">{r.body}</p>
          </li>
        ))}
      </ol>
      <h3>Every chapter, the same loop</h3>
      <ol className="loop">
        {LOOP.map(([t, d]) => (
          <li key={t}>
            <strong>{t}</strong> <span className="muted">{d}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export function Method() {
  return (
    <div className="page">
      <h1>How to read</h1>
      <MethodContent />
      <p className="muted small">
        Based on Stephen Krashen's comprehensible-input research and the StoryLearning method.
      </p>
    </div>
  );
}

export function Onboarding() {
  const profile = useStore((s) => s.profile);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);
  const [interests, setInterests] = useState(profile.interests);

  const finish = () => {
    update((s) => ({ ...s, profile: { ...s.profile, name: name.trim(), interests, onboarded: true } }));
    navigate("/read/01-tonari-no-heya/0");
  };

  return (
    <div className="page onboarding">
      <p className="eyebrow">読む · yomu · “to read”</p>
      {step === 0 && (
        <>
          <h1>You're not bad at languages.</h1>
          <p className="lead">
            Your brain just needs lots of language it can <em>understand</em>. Yomu gives you short stories at exactly
            your level, every day.
          </p>
          <MethodContent />
          <button className="btn primary big" onClick={() => setStep(1)}>
            Got it →
          </button>
        </>
      )}
      {step === 1 && (
        <>
          <h1>Starting from zero is fine.</h1>
          <p className="lead">
            You don't need to learn kana first. Every word starts with romaji underneath and furigana over kanji, and
            those aids fade word by word as you get to know each word. Tap any word for its meaning and sound.
          </p>
          <label className="field">
            <span>What should we call you?</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </label>
          <label className="field">
            <span>What you love in a story (Claude uses this when writing for you)</span>
            <textarea rows={6} value={interests} onChange={(e) => setInterests(e.target.value)} />
          </label>
          <button className="btn primary big" onClick={finish}>
            Read your first story →
          </button>
          <p className="muted small">
            “The Room Next Door” is about 10 minutes. You can add an API key for personalised stories later in
            Settings.
          </p>
        </>
      )}
    </div>
  );
}
