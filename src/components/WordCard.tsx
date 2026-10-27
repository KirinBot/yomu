import { useState } from "react";
import { wordKey, type Pattern, type Sentence, type Token } from "../lib/dsl";
import { furiganaParts, readingOf, tokenRomaji } from "../lib/kana";
import { setManual, toggleSaved, useStore, wordStatus } from "../lib/store";
import { speak } from "../lib/tts";
import { tokenSpeech } from "./Text";

interface Props {
  token: Token;
  sentence: Sentence;
  pattern?: Pattern;
  onClose: () => void;
  onPlayFrom: () => void;
}

const STATUS_LABEL = { new: "New word", learning: "Learning", known: "Known" };

export function WordCard({ token, sentence, pattern, onClose, onPlayFrom }: Props) {
  const w = useStore((s) => s.words[wordKey(token)]);
  const status = wordStatus(w);
  const [showSentence, setShowSentence] = useState(false);
  const [showPattern, setShowPattern] = useState(false);

  return (
    <div className="sheet" role="dialog" aria-label="Word details">
      <div className="sheet-head">
        <div>
          <div className="card-word">
            {furiganaParts(token.s, token.r).map((p, i) =>
              p.ruby ? (
                <ruby key={i}>
                  {p.text}
                  <rt>{p.ruby}</rt>
                </ruby>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </div>
          <div className="card-reading">
            {token.r && <span>{readingOf(token)}</span>}
            <span className="muted">{tokenRomaji(token)}</span>
            <button className="icon-btn" onClick={() => speak(tokenSpeech(token))} aria-label="Hear word">
              🔊
            </button>
          </div>
        </div>
        <button className="icon-btn close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="card-gloss">{token.g ?? "—"}</div>
      {token.b && (
        <div className="muted small">
          Dictionary form: <span className="jp-inline">{token.b}</span>
        </div>
      )}

      {pattern && (
        <button className="pattern-chip" onClick={() => setShowPattern((v) => !v)}>
          Pattern: <span className="jp-inline">{pattern.form}</span> · {pattern.meaning}
          {showPattern && <span className="pattern-note">{pattern.note}</span>}
        </button>
      )}

      <div className="card-status">
        <span className={`status-dot ${status}`} /> {STATUS_LABEL[status]}
        {w && w.seen > 0 && <span className="muted"> · met in {w.seen} chapter{w.seen === 1 ? "" : "s"}</span>}
      </div>

      {showSentence && <div className="card-translation">{sentence.en}</div>}

      <div className="card-actions">
        <button className={`btn ${w?.saved ? "primary" : ""}`} onClick={() => toggleSaved(token)}>
          {w?.saved ? "★ Saved — it'll come back" : "☆ Save word"}
        </button>
        <button className="btn" onClick={() => setShowSentence((v) => !v)}>
          {showSentence ? "Hide sentence" : "Translate sentence"}
        </button>
        <button className="btn" onClick={onPlayFrom}>
          ▶ Listen from here
        </button>
        {status !== "known" ? (
          <button className="btn ghost" onClick={() => setManual(token, "known")}>
            I know this
          </button>
        ) : (
          <button className="btn ghost" onClick={() => setManual(token, "learning")}>
            Still learning
          </button>
        )}
      </div>
    </div>
  );
}
